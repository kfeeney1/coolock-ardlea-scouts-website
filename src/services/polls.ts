import {
  collection,
  collectionGroup,
  doc,
  increment,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserFacingError } from "./applicationErrors.ts";
import {
  GROUP_POLL_SECTIONS,
  canCreatePollForLeader,
  canManagePollForLeader,
  normalizePollOptions,
  pollDeadlinePassed,
  normalizePollQuestion,
  pollManagerScopeSubsets,
  resolvePollSections,
  uniquePollIds,
  type PollAudienceType,
  type PollLeaderActor,
  type PollRecord,
  type PollScopeType
} from "./pollLogic.ts";
import { isGroupLeadershipAppointment } from "../security/scoutingAppointments.ts";

export type CreatePollInput = {
  question: string;
  options: string[];
  audienceType: PollAudienceType;
  scopeType: PollScopeType;
  sections: string[];
  closesAt?: string;
};

function mapPoll(id: string, data: Record<string, unknown>): PollRecord | null {
  if (typeof data.question !== "string" || !Array.isArray(data.options)
    || (data.audienceType !== "leaders" && data.audienceType !== "parents")
    || (data.scopeType !== "group" && data.scopeType !== "sections")
    || !Array.isArray(data.scopeSections)
    || (data.status !== "draft" && data.status !== "published" && data.status !== "closed")
    || typeof data.createdBy !== "string") return null;
  return {
    id,
    question: data.question,
    options: data.options.filter((item): item is string => typeof item === "string"),
    audienceType: data.audienceType,
    scopeType: data.scopeType,
    scopeSections: data.scopeSections.filter((item): item is string => typeof item === "string"),
    status: data.status,
    createdBy: data.createdBy,
    createdAt: data.createdAt,
    publishedAt: data.publishedAt,
    closedAt: data.closedAt,
    closesAt: data.closesAt
  };
}

async function fetchAudienceIndexIds(section: string | undefined, audienceType: PollAudienceType, scopeType?: PollScopeType, publishedOnly = false, scopeSectionOptions?: readonly (readonly string[])[]): Promise<string[]> {
  const constraints = [
    ...(section ? [where("section", "==", section)] : []),
    where("audienceType", "==", audienceType),
    ...(scopeType ? [where("scopeType", "==", scopeType)] : []),
    ...(scopeSectionOptions ? [where("scopeSections", "in", scopeSectionOptions.map((sections) => [...sections]))] : []),
    ...(publishedOnly ? [where("status", "==", "published")] : [])
  ];
  const snapshot = await getDocs(query(collectionGroup(db, "audienceSections"), ...constraints));
  return snapshot.docs.map((item) => item.data().pollId).filter((id): id is string => typeof id === "string");
}

async function loadPollRecords(pollIds: readonly string[]): Promise<PollRecord[]> {
  const records = await Promise.all(uniquePollIds(pollIds).map(async (pollId) => {
    const snapshot = await getDoc(doc(db, "polls", pollId));
    return snapshot.exists() ? mapPoll(snapshot.id, snapshot.data()) : null;
  }));
  return records.filter((poll): poll is PollRecord => Boolean(poll));
}

export async function loadParentPolls(sections: readonly string[]): Promise<PollRecord[]> {
  if (!auth.currentUser) return [];
  const ids = await Promise.all([...new Set(sections)].map((section) => fetchAudienceIndexIds(section, "parents", undefined, true)));
  const polls = await loadPollRecords(ids.flat());
  return polls.filter((poll) => poll.audienceType === "parents" && poll.status === "published");
}

export async function loadLeaderPolls(actor: PollLeaderActor): Promise<PollRecord[]> {
  if (!auth.currentUser) return [];
  const groupManager = actor.role === "admin" || actor.role === "super-admin" || isGroupLeadershipAppointment(actor.scoutingRole);
  const querySections = groupManager ? [...GROUP_POLL_SECTIONS] : actor.sections;
  // Group managers are authorised to discover every poll audience index. Query
  // each audience once rather than repeating the same group poll in all five
  // section queries and fetching both scope types separately (25 queries).
  // Root documents are still fetched and authorised individually below.
  const publishedLeaderQueries = groupManager ? [] : querySections.map((section) =>
    fetchAudienceIndexIds(section, "leaders", undefined, true)
  );
  const managerQueries = groupManager
    ? [fetchAudienceIndexIds(undefined, "leaders"), fetchAudienceIndexIds(undefined, "parents")]
    : (() => {
      const permittedScopes = pollManagerScopeSubsets(actor.sections);
      const scopeChunks: string[][][] = [];
      for (let index = 0; index < permittedScopes.length; index += 30) {
        scopeChunks.push(permittedScopes.slice(index, index + 30));
      }
      return scopeChunks.flatMap((scopeOptions) => [
        // Exact-scope alternatives make each collection-group query provably readable
        // under Firestore Rules, even when other polls overlap only part of this leader's sections.
        fetchAudienceIndexIds(undefined, "leaders", "sections", false, scopeOptions),
        fetchAudienceIndexIds(undefined, "parents", "sections", false, scopeOptions)
      ]);
    })();
  const ids = await Promise.all([...publishedLeaderQueries, ...managerQueries]);
  const polls = await loadPollRecords(ids.flat());
  return polls.filter((poll) => canManagePollForLeader(poll, actor) || (poll.audienceType === "leaders" && poll.status === "published"));
}

export async function createPollDraft(actor: PollLeaderActor, input: CreatePollInput, requestId: string = crypto.randomUUID()): Promise<string> {
  const question = normalizePollQuestion(input.question);
  const options = normalizePollOptions(input.options);
  const groupManager = actor.role === "admin" || actor.role === "super-admin" || isGroupLeadershipAppointment(actor.scoutingRole);
  const authorisedSections = groupManager ? ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"] : actor.sections;
  const scopeSections = resolvePollSections(input.scopeType, input.sections, authorisedSections);
  if (!canCreatePollForLeader(input.scopeType, scopeSections, actor)) {
    throw new UserFacingError("You can create polls only within your authorised section scope. Group-wide polls require group leadership or admin access.");
  }
  const closesAt = input.closesAt ? new Date(input.closesAt) : null;
  if (closesAt && (!Number.isFinite(closesAt.getTime()) || closesAt.getTime() <= Date.now())) {
    throw new UserFacingError("Choose a closing date in the future, or leave it blank.");
  }
  const user = auth.currentUser;
  if (!user) throw new UserFacingError("Sign in as an active leader to create a poll.");
  // Keep the same document ID for retries of one submission. Firestore rules
  // permit draft creation but reject overwriting an existing poll, so a retry
  // can never create a second poll with the same submission ID.
  const pollRef = doc(db, "polls", requestId);
  const batch = writeBatch(db);
  batch.set(pollRef, {
    question,
    options,
    audienceType: input.audienceType,
    scopeType: input.scopeType,
    scopeSections,
    status: "draft",
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp(),
    ...(closesAt ? { closesAt: Timestamp.fromDate(closesAt) } : {})
  });
  options.forEach((option, optionIndex) => batch.set(doc(pollRef, "results", String(optionIndex)), { option, optionIndex, count: 0 }));
  scopeSections.forEach((section) => batch.set(doc(pollRef, "audienceSections", section), {
    pollId: pollRef.id,
    section,
    audienceType: input.audienceType,
    scopeType: input.scopeType,
    scopeSections,
    status: "draft"
  }));
  await batch.commit();
  return pollRef.id;
}

export async function publishPoll(actor: PollLeaderActor, poll: PollRecord): Promise<void> {
  if (!canManagePollForLeader(poll, actor)) throw new UserFacingError("This poll is outside your authorised management scope.");
  const pollRef = doc(db, "polls", poll.id);
  const batch = writeBatch(db);
  batch.update(pollRef, { status: "published", publishedAt: serverTimestamp(), updatedBy: actor.uid, updatedAt: serverTimestamp() });
  poll.scopeSections.forEach((section) => batch.update(doc(pollRef, "audienceSections", section), { status: "published" }));
  await batch.commit();
}

export async function closePoll(actor: PollLeaderActor, poll: PollRecord): Promise<void> {
  if (!canManagePollForLeader(poll, actor)) throw new UserFacingError("This poll is outside your authorised management scope.");
  const pollRef = doc(db, "polls", poll.id);
  const batch = writeBatch(db);
  batch.update(pollRef, { status: "closed", closedAt: serverTimestamp(), updatedBy: actor.uid, updatedAt: serverTimestamp() });
  poll.scopeSections.forEach((section) => batch.update(doc(pollRef, "audienceSections", section), { status: "closed" }));
  await batch.commit();
}

export async function loadMyPollResponse(pollId: string): Promise<{ option: string; createdAt?: unknown } | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snapshot = await getDoc(doc(db, "polls", pollId, "responses", uid));
  return snapshot.exists() && typeof snapshot.data().option === "string"
    ? { option: snapshot.data().option as string, createdAt: snapshot.data().createdAt }
    : null;
}

export async function submitPollResponse(poll: PollRecord, option: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new UserFacingError("Sign in to respond to this poll.");
  if (!poll.options.includes(option)) throw new UserFacingError("Choose one of the listed answers.");
  const pollRef = doc(db, "polls", poll.id);
  const responseRef = doc(db, "polls", poll.id, "responses", user.uid);
  await runTransaction(db, async (transaction) => {
    const pollSnapshot = await transaction.get(pollRef);
    const responseSnapshot = await transaction.get(responseRef);
    const current = pollSnapshot.exists() ? mapPoll(pollSnapshot.id, pollSnapshot.data()) : null;
    if (!current || current.status !== "published" || pollDeadlinePassed(current.closesAt)) throw new UserFacingError("This poll is no longer accepting responses.");
    const nextIndex = current.options.indexOf(option);
    if (nextIndex < 0) throw new UserFacingError("Choose one of the listed answers.");
    const previousIndex = responseSnapshot.exists() ? Number(responseSnapshot.data().optionIndex) : -1;
    const createdAt = responseSnapshot.exists() ? responseSnapshot.data().createdAt : serverTimestamp();
    if (previousIndex !== nextIndex) {
      transaction.update(doc(pollRef, "results", String(nextIndex)), { count: increment(1), updatedAt: serverTimestamp() });
      if (previousIndex >= 0) transaction.update(doc(pollRef, "results", String(previousIndex)), { count: increment(-1), updatedAt: serverTimestamp() });
    }
    transaction.set(responseRef, { accountUid: user.uid, option, optionIndex: nextIndex, createdAt, updatedAt: serverTimestamp() });
  });
}

export function subscribeToPollResults(
  poll: PollRecord,
  onResults: (results: Array<{ option: string; count: number }>) => void,
  onError: (error: unknown) => void
): () => void {
  return onSnapshot(collection(db, "polls", poll.id, "results"), (snapshot) => {
    const counts = new Map(snapshot.docs.map((item) => {
      const data = item.data();
      return [Number(data.optionIndex), typeof data.count === "number" ? data.count : 0] as const;
    }));
    onResults(poll.options.map((option, optionIndex) => ({ option, count: counts.get(optionIndex) ?? 0 })));
  }, onError);
}

export async function loadPollResultsForManager(poll: PollRecord): Promise<Array<{ option: string; count: number }>> {
  const snapshot = await getDocs(collection(db, "polls", poll.id, "results"));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return { option: typeof data.option === "string" ? data.option : "", count: typeof data.count === "number" ? data.count : 0 };
  });
}

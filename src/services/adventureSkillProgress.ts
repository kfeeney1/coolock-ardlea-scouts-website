import { ServiceFailure, UserFacingError } from "./applicationErrors.ts";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import { adventureSkillsById } from "../data/adventureSkills/index.ts";
import {
  completionTargetsForRequirement,
  completionTargetsForStage,
  stageAwardId,
  type AdventureProgressSourceType,
  type AdventureRequirementCompletion
} from "./adventureSkillProgressLogic.ts";

export type AdventureRequirementProgressRecord = {
  requirementId: string;
  skillId: string;
  stage: number;
  sharedCompetencyKey: string;
  completedAt: Date | null;
  completedBy: string;
  sourceType: AdventureProgressSourceType;
  sourceId: string;
};

export type AdventureStageAwardRecord = {
  id: string;
  skillId: string;
  stage: number;
  awardedAt: Date | null;
  awardedBy: string;
};

export type MemberAdventureProgress = {
  memberId: string;
  requirements: AdventureRequirementProgressRecord[];
  awards: AdventureStageAwardRecord[];
};

export type AdventureProgressSource = {
  type: AdventureProgressSourceType;
  id?: string;
};

const MAX_PROGRESS_WRITES_PER_BATCH = 400;

function timestampToDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return null;
}

function stringValue(data: DocumentData, key: string): string {
  return typeof data[key] === "string" ? data[key].trim() : "";
}

function mapRequirement(snapshot: QueryDocumentSnapshot<DocumentData>): AdventureRequirementProgressRecord | null {
  const data = snapshot.data();
  const requirementId = stringValue(data, "requirementId");
  const skillId = stringValue(data, "skillId");
  const stage = typeof data.stage === "number" ? data.stage : 0;
  const completedBy = stringValue(data, "completedBy");
  const sourceType = stringValue(data, "sourceType") as AdventureProgressSourceType;
  if (!requirementId || !skillId || stage < 1 || !completedBy || !["manual", "weeklyMeeting", "event", "activity", "migration"].includes(sourceType)) return null;
  return {
    requirementId,
    skillId,
    stage,
    sharedCompetencyKey: stringValue(data, "sharedCompetencyKey"),
    completedAt: timestampToDate(data.completedAt),
    completedBy,
    sourceType,
    sourceId: stringValue(data, "sourceId")
  };
}

function mapAward(snapshot: QueryDocumentSnapshot<DocumentData>): AdventureStageAwardRecord | null {
  const data = snapshot.data();
  const skillId = stringValue(data, "skillId");
  const stage = typeof data.stage === "number" ? data.stage : 0;
  const awardedBy = stringValue(data, "awardedBy");
  if (!skillId || stage < 1 || !awardedBy) return null;
  return { id: snapshot.id, skillId, stage, awardedAt: timestampToDate(data.awardedAt), awardedBy };
}

function currentUserId(): string {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");
  return user.uid;
}

function memberProgressRoot(memberId: string) {
  return doc(db, "memberAdventureSkillProgress", memberId);
}

function uniqueMemberIds(memberIds: string[]): string[] {
  const ids = [...new Set(memberIds.map((memberId) => memberId.trim()).filter(Boolean))];
  if (ids.length === 0) throw new UserFacingError("Select at least one member.");
  return ids;
}

async function commitRequirementTargets(
  memberIds: string[],
  targets: AdventureRequirementCompletion[],
  completed: boolean,
  userId: string,
  source: AdventureProgressSource
): Promise<void> {
  const operations = memberIds.flatMap((memberId) => targets.map((target) => ({ memberId, target })));
  for (let offset = 0; offset < operations.length; offset += MAX_PROGRESS_WRITES_PER_BATCH) {
    const batch = writeBatch(db);
    for (const { memberId, target } of operations.slice(offset, offset + MAX_PROGRESS_WRITES_PER_BATCH)) {
      const requirementRef = doc(collection(memberProgressRoot(memberId), "requirements"), target.requirementId);
      if (!completed) {
        batch.delete(requirementRef);
        continue;
      }
      batch.set(requirementRef, {
        memberId,
        requirementId: target.requirementId,
        skillId: target.skillId,
        stage: target.stage,
        sharedCompetencyKey: target.sharedCompetencyKey,
        completedAt: serverTimestamp(),
        completedBy: userId,
        sourceType: source.type,
        sourceId: source.id?.trim() ?? ""
      });
    }
    await batch.commit();
  }
}

export async function loadMemberAdventureProgress(memberId: string): Promise<MemberAdventureProgress> {
  const root = memberProgressRoot(memberId);
  const [requirementsSnapshot, awardsSnapshot] = await Promise.all([
    getDocs(collection(root, "requirements")),
    getDocs(collection(root, "awards"))
  ]);
  return {
    memberId,
    requirements: requirementsSnapshot.docs.map(mapRequirement).filter((item): item is AdventureRequirementProgressRecord => item !== null),
    awards: awardsSnapshot.docs.map(mapAward).filter((item): item is AdventureStageAwardRecord => item !== null)
  };
}

/**
 * Load overview progress with bounded Firestore concurrency. The overview can
 * contain many active members; issuing two reads for every member at once can
 * keep consuming the shared Firestore connection after the user has navigated
 * elsewhere. A signal stops scheduling more members as soon as the view is
 * left, while already-started reads are allowed to settle safely.
 */
export async function loadMemberAdventureProgressForMembers(
  memberIds: readonly string[],
  options: {
    signal?: AbortSignal;
    concurrency?: number;
    loadMember?: (memberId: string) => Promise<MemberAdventureProgress>;
  } = {}
): Promise<MemberAdventureProgress[]> {
  const ids = [...new Set(memberIds.map((memberId) => memberId.trim()).filter(Boolean))];
  if (ids.length === 0 || options.signal?.aborted) return [];

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const concurrency = Math.max(1, Math.min(ids.length, Math.floor(options.concurrency ?? 3)));
  const results = new Array<MemberAdventureProgress>(ids.length);
  let nextIndex = 0;
  const loadMember = options.loadMember ?? loadMemberAdventureProgress;

  const worker = async () => {
    while (!controller.signal.aborted) {
      const index = nextIndex++;
      if (index >= ids.length) return;
      try {
        const progress = await loadMember(ids[index]);
        if (controller.signal.aborted) return;
        results[index] = progress;
      } catch (error) {
        controller.abort();
        throw error;
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results.filter((progress): progress is MemberAdventureProgress => Boolean(progress));
  } finally {
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function setRequirementCompletionForMembers(
  memberIds: string[],
  requirementId: string,
  completed: boolean,
  source: AdventureProgressSource = { type: "manual" }
): Promise<void> {
  await commitRequirementTargets(
    uniqueMemberIds(memberIds),
    completionTargetsForRequirement(requirementId),
    completed,
    currentUserId(),
    source
  );
}

export async function completeStageForMembers(
  memberIds: string[],
  skillId: string,
  stage: number,
  source: AdventureProgressSource = { type: "manual" }
): Promise<void> {
  await commitRequirementTargets(
    uniqueMemberIds(memberIds),
    completionTargetsForStage(skillId, stage),
    true,
    currentUserId(),
    source
  );
}

export async function setStageAwardForMembers(memberIds: string[], skillId: string, stage: number, awarded: boolean): Promise<void> {
  const userId = currentUserId();
  const awardId = stageAwardId(skillId, stage);
  await Promise.all(uniqueMemberIds(memberIds).map(async (memberId) => {
    const awardRef = doc(collection(memberProgressRoot(memberId), "awards"), awardId);
    if (!awarded) {
      await deleteDoc(awardRef);
      return;
    }
    await setDoc(awardRef, {
      awardId,
      memberId,
      skillId,
      stage,
      awardedAt: serverTimestamp(),
      awardedBy: userId
    });
  }));
}


export async function loadWeeklyMeetingAdventureBadgework(memberIds: string[], meetingId: string): Promise<string[]> {
  const sourceId = meetingId.trim();
  const ids = [...new Set(memberIds.map((memberId) => memberId.trim()).filter(Boolean))];
  if (!sourceId || ids.length === 0) return [];
  const progress = await Promise.all(ids.map(loadMemberAdventureProgress));
  const labels = new Set<string>();
  for (const member of progress) {
    for (const requirement of member.requirements) {
      if (requirement.sourceType !== "weeklyMeeting" || requirement.sourceId !== sourceId) continue;
      const skill = adventureSkillsById.get(requirement.skillId);
      if (!skill) continue;
      labels.add(`Adventure Skills: ${skill.name} · Stage ${requirement.stage}`);
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b, "en-IE"));
}

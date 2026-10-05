import { ServiceFailure, UserFacingError, reportApplicationError } from "./applicationErrors.ts";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot, Timestamp } from "firebase/firestore";

import { auth, db } from "../firebase";
import { hasGroupFinanceAppointment } from "../security/scoutingAppointments";
import { MEMBER_PROGRAMME_SECTIONS, canonicalMemberSections, memberSectionStorageAliases } from "./memberSectionCore.mjs";
import { recordAuditEvent } from "./auditLog";
import { normalizeMedicationManagement } from "./consentManagementLogic";
import { normalizeLeaderSections } from "./leaderAccessLogic";
import { normalizeMemberSectionRoles, type MemberSectionRoles } from "./memberYouthRoles";
import { automaticDisplayName, canonicalMemberSection } from "./memberIdentityLogic";
import {
  canonicalMemberFieldError,
  detectMemberLifecycleChange,
  lifecycleChangeLabel,
  type MemberLifecycleChangeType
} from "./memberLifecycleLogic";

export type MemberStatus = "active" | "inactive" | "left";

export type MemberRecord = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  displayNameMode: "auto" | "custom";
  dateOfBirth: string;
  section: string;
  sections: string[];
  sectionRoles: MemberSectionRoles;
  parentName: string;
  emailAddress: string;
  mobileNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: MemberStatus;
  familyId: string;
  source: string;
  sourceJoinApplicationId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  accountUid?: string;
};

export type CreateMemberInput = Pick<
  MemberRecord,
  "firstName" | "lastName" | "displayName" | "dateOfBirth" | "section" | "parentName" | "emailAddress" |
  "mobileNumber" | "emergencyContactName" | "emergencyContactPhone" | "status" | "displayNameMode"
> & { sections?: string[]; sectionRoles?: MemberSectionRoles };

export type MemberConsentSummary = {
  consentId: string;
  memberName: string;
  dateOfBirth: string;
  section: string;
  consentTo: string;
  submittedAt: Date | null;
  hasMedicalAlert: boolean;
  hasMedicationManagement: boolean;
};

export type MemberLifecycleHistoryRecord = {
  id: string;
  memberId: string;
  memberName: string;
  changeType: MemberLifecycleChangeType;
  fromSection: string;
  toSection: string;
  fromStatus: MemberStatus;
  toStatus: MemberStatus;
  changedBy: string;
  changedAt: Date | null;
};

const MEMBER_STATUSES = ["active", "inactive", "left"] as const;
function validMemberProgrammeSections(sections: string[]): boolean {
  return sections.length > 0 && sections.every((section) => MEMBER_PROGRAMME_SECTIONS.includes(section as typeof MEMBER_PROGRAMME_SECTIONS[number]));
}
const LIFECYCLE_TYPES = ["created", "section-transfer", "status-change", "section-and-status-change"] as const;

function timestampToDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return null;
}

function stringValue(data: DocumentData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

function memberStatus(value: unknown): MemberStatus | null {
  return MEMBER_STATUSES.includes(value as MemberStatus) ? value as MemberStatus : null;
}

function mapMember(snapshot: QueryDocumentSnapshot<DocumentData>): MemberRecord | null {
  const data = snapshot.data();
  const status = memberStatus(data.status);
  const required = {
    firstName: stringValue(data, "firstName"),
    lastName: stringValue(data, "lastName"),
    displayName: stringValue(data, "displayName"),
    dateOfBirth: stringValue(data, "dateOfBirth"),
    section: canonicalMemberSection(stringValue(data, "section"))
  };
  const sections = canonicalMemberSections(data.sections, required.section);
  const accountUid = stringValue(data, "accountUid");
  const adultRoverWithoutDateOfBirth = Boolean(accountUid)
    && (sections.includes("Rovers") || stringValue(data, "source") === "rover-self-service");
  if (!status || !required.firstName || !required.lastName || !required.displayName || (!required.dateOfBirth && !adultRoverWithoutDateOfBirth) || sections.length === 0) return null;
  required.section = sections[0];

  return {
    id: snapshot.id,
    ...required,
    sections,
    sectionRoles: normalizeMemberSectionRoles(data.sectionRoles, sections),
    displayNameMode: data.displayNameMode === "custom"
      ? "custom"
      : data.displayNameMode === "auto"
        ? "auto"
        : stringValue(data, "displayName") === automaticDisplayName(stringValue(data, "firstName"), stringValue(data, "lastName"))
          ? "auto"
          : "custom",
    parentName: stringValue(data, "parentName"),
    emailAddress: stringValue(data, "emailAddress"),
    mobileNumber: stringValue(data, "mobileNumber"),
    emergencyContactName: stringValue(data, "emergencyContactName"),
    emergencyContactPhone: stringValue(data, "emergencyContactPhone"),
    status,
    familyId: stringValue(data, "familyId"),
    source: stringValue(data, "source"),
    sourceJoinApplicationId: stringValue(data, "sourceJoinApplicationId"),
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
    accountUid
  };
}

export async function setRoverSelfMembership(input: { firstName: string; lastName: string; enabled: boolean }): Promise<void> {
  const user = auth.currentUser;
  const email = user?.email?.trim() ?? "";
  if (!user || !email) throw new ServiceFailure("A signed-in leader email is required.", "auth/unauthenticated");
  const profileSnapshot = await getDoc(doc(db, "adminUsers", user.uid));
  const profile = profileSnapshot.data();
  if (!profileSnapshot.exists() || profile?.active !== true || !["leader", "admin", "super-admin"].includes(profile?.role)) {
    throw new UserFacingError("An active approved adult account is required to manage Rover membership.");
  }

  const accountMatches = await getDocs(query(collection(db, "members"), where("accountUid", "==", user.uid)));
  let member = accountMatches.docs[0];
  if (accountMatches.size > 1) throw new UserFacingError("More than one member record is linked to this account. Ask an administrator to reconcile the records.");

  if (!member && input.enabled) {
    const emailMatches = [await getDocs(query(collection(db, "members"), where("emailAddress", "==", email)))];
    const firstName = clean(input.firstName, 100);
    const lastName = clean(input.lastName, 100);
    const candidates = [...new Map(emailMatches.flatMap((snapshot) => snapshot.docs).map((candidate) => [candidate.id, candidate])).values()].filter((candidate) => {
      const data = candidate.data();
      return stringValue(data, "emailAddress") === email
        && stringValue(data, "firstName").toLocaleLowerCase() === firstName.toLocaleLowerCase()
        && stringValue(data, "lastName").toLocaleLowerCase() === lastName.toLocaleLowerCase();
    });
    if (candidates.length > 1) throw new UserFacingError("More than one member record matches your name and email. Ask an administrator to reconcile the records.");
    member = candidates[0];
  }

  const now = serverTimestamp();
  if (!member && input.enabled) {
    const firstName = clean(input.firstName, 100);
    const lastName = clean(input.lastName, 100);
    if (!firstName || !lastName) throw new UserFacingError("Enter your first and last name.");
    await setDoc(doc(db, "members", `rover_${user.uid}`), {
      firstName, lastName, displayName: automaticDisplayName(firstName, lastName), displayNameMode: "auto",
      dateOfBirth: "", section: "Rovers", sections: ["Rovers"], sectionRoles: {}, parentName: "",
      emailAddress: email, mobileNumber: clean(profile.mobileNumber ?? "", 40), emergencyContactName: "",
      emergencyContactPhone: "", status: "active", source: "rover-self-service", sourceJoinApplicationId: "",
      accountUid: user.uid, createdAt: now, createdBy: user.uid, updatedAt: now, updatedBy: user.uid
    });
    return;
  }
  if (!member) throw new UserFacingError("Your Rover member record could not be found.");

  const data = member.data();
  if (data.accountUid && data.accountUid !== user.uid) throw new UserFacingError("This member record is already linked to another account.");
  if (stringValue(data, "emailAddress") !== email) throw new UserFacingError("Your member record email must match your signed-in account email exactly.");
  const sections = canonicalMemberSections(data.sections, stringValue(data, "section"));
  const nextSections = input.enabled
    ? [...sections.filter((section) => section !== "Rovers"), "Rovers"]
    : sections.filter((section) => section !== "Rovers");
  const retainedSections = nextSections.length > 0 ? nextSections : ["Rovers"];
  await updateDoc(member.ref, {
    accountUid: user.uid,
    section: retainedSections[0],
    sections: retainedSections,
    sectionRoles: normalizeMemberSectionRoles(data.sectionRoles, retainedSections),
    status: input.enabled ? "active" : (nextSections.length === 0 ? "left" : (memberStatus(data.status) ?? "active")),
    updatedAt: now,
    updatedBy: user.uid
  });
}

export async function loadRoverSelfMembership(): Promise<{ active: boolean; firstName: string; lastName: string }> {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("A signed-in leader account is required.", "auth/unauthenticated");
  const matches = await getDocs(query(collection(db, "members"), where("accountUid", "==", user.uid)));
  if (matches.size > 1) throw new UserFacingError("More than one member record is linked to this account.");
  if (matches.empty) return { active: false, firstName: "", lastName: "" };
  const data = matches.docs[0].data();
  const sections = canonicalMemberSections(data.sections, stringValue(data, "section"));
  return { active: data.status === "active" && sections.includes("Rovers"), firstName: stringValue(data, "firstName"), lastName: stringValue(data, "lastName") };
}

function yes(data: DocumentData, key: string): boolean {
  return data[key] === "Yes";
}

function medicationEnabled(data: DocumentData): boolean {
  return normalizeMedicationManagement(data.medicationManagement)?.enabled === true;
}

function storageSectionAliases(section: string): readonly string[] {
  return memberSectionStorageAliases(section);
}

function hasMedicalAlert(data: DocumentData): boolean {
  return ["seriousIllness", "regularMeds", "medAllergies", "allergies", "dietaryReqs"].some((key) => yes(data, key));
}

function clean(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export { automaticDisplayName, canonicalMemberSection } from "./memberIdentityLogic";

export async function loadMembers(): Promise<MemberRecord[]> {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

  const [profileSnapshot, organisationSnapshot] = await Promise.all([
    getDoc(doc(db, "adminUsers", user.uid)),
    getDoc(doc(db, "organisationLeadership", user.uid))
  ]);
  if (!profileSnapshot.exists() || profileSnapshot.data().active !== true) {
    throw new UserFacingError("Active leader profile is required.");
  }

  const profile = profileSnapshot.data();
  const organisation = organisationSnapshot.exists() ? organisationSnapshot.data() : null;
  const isAdmin = profile.role === "admin" || profile.role === "super-admin";
  const isGroupFinanceOfficer = organisation?.active === true
    && hasGroupFinanceAppointment(organisation.appointments, organisation.scoutingRole);
  const leaderSections = normalizeLeaderSections(profile);
  const legacyDocs = isAdmin || isGroupFinanceOfficer
    ? []
    : (await Promise.all(
        leaderSections.flatMap((section) => storageSectionAliases(section).map((storedSection) =>
          getDocs(query(collection(db, "members"), where("section", "==", storedSection)))
        ))
      )).flatMap((snapshot) => snapshot.docs);

  // During the backwards-compatible transition, a legacy scalar query must not
  // be discarded if Firestore cannot authorize one of the additive sections[]
  // queries. Each concurrent-membership query is isolated so established
  // single-section records remain readable while sections[] records are added.
  const concurrentDocs = isAdmin || isGroupFinanceOfficer
    ? []
    : (await Promise.all(
        leaderSections.map(async (section) => {
          try {
            return (await getDocs(query(collection(db, "members"), where("sections", "array-contains", section)))).docs;
          } catch (error) {
            reportApplicationError(error, { area: "memberAdmin", operation: "memberAdmin operation" });
            return [];
          }
        })
      )).flat();

  const docs = isAdmin || isGroupFinanceOfficer
    ? (await getDocs(query(collection(db, "members"), orderBy("displayName", "asc")))).docs
    : legacyDocs.concat(concurrentDocs);

  return [...new Map(docs.map((item) => [item.id, item])).values()]
    .map(mapMember)
    .filter((member): member is MemberRecord => member !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function createMember(input: CreateMemberInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

  const canonicalError = canonicalMemberFieldError(input);
  if (canonicalError) throw new Error(canonicalError);

  const automaticName = automaticDisplayName(input.firstName, input.lastName);
  const requestedName = clean(input.displayName, 200);
  const displayNameMode = input.displayNameMode === "custom" ? "custom" : "auto";
  const displayName = displayNameMode === "custom" ? requestedName : automaticName;
  if (displayNameMode === "custom" && !displayName) throw new UserFacingError("Custom display name is required.");
  const requestedSections = canonicalMemberSections(input.sections, input.section);
  if (!validMemberProgrammeSections(requestedSections)) throw new UserFacingError("Select at least one valid programme section (Beavers, Cubs, Scouts, Ventures or Rovers).");
  const primarySection = requestedSections[0];
  const memberRef = await addDoc(collection(db, "members"), {
    firstName: clean(input.firstName, 100),
    lastName: clean(input.lastName, 100),
    displayName,
    displayNameMode,
    dateOfBirth: clean(input.dateOfBirth, 20),
    section: primarySection,
    sections: requestedSections,
    sectionRoles: normalizeMemberSectionRoles(input.sectionRoles, requestedSections),
    parentName: clean(input.parentName, 200),
    emailAddress: clean(input.emailAddress, 254),
    mobileNumber: clean(input.mobileNumber, 40),
    emergencyContactName: clean(input.emergencyContactName, 200),
    emergencyContactPhone: clean(input.emergencyContactPhone, 40),
    status: input.status,
    source: "manual",
    sourceJoinApplicationId: "",
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  });

  await recordAuditEvent({
    category: "member",
    action: "Member created",
    targetId: memberRef.id,
    targetLabel: displayName,
    section: primarySection,
    description: `Created member record with status ${input.status}.`
  });
  return memberRef.id;
}

export async function updateMember(
  memberId: string,
  updates: Pick<MemberRecord, "firstName" | "lastName" | "displayName" | "dateOfBirth" | "section" | "parentName" |
    "emailAddress" | "mobileNumber" | "emergencyContactName" | "emergencyContactPhone" | "status" | "displayNameMode"> & { sections?: string[]; sectionRoles?: MemberSectionRoles }
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

  const memberRef = doc(db, "members", memberId);
  const currentSnapshot = await getDoc(memberRef);
  if (!currentSnapshot.exists()) throw new UserFacingError("Member record no longer exists.");

  const current = currentSnapshot.data();
  const existingSections = canonicalMemberSections(current.sections, stringValue(current, "section"));
  const canonicalError = canonicalMemberFieldError(updates, {
    allowMissingDateOfBirth: Boolean(stringValue(current, "accountUid"))
      && (existingSections.includes("Rovers") || stringValue(current, "source") === "rover-self-service")
  });
  if (canonicalError) throw new Error(canonicalError);
  const previousSection = stringValue(current, "section");
  const previousStatus = memberStatus(current.status);
  if (!previousSection || !previousStatus) throw new UserFacingError("Member record does not match the canonical seed schema.");

  const nextSections = canonicalMemberSections(updates.sections, updates.section);
  if (!validMemberProgrammeSections(nextSections)) throw new UserFacingError("Select at least one valid programme section (Beavers, Cubs, Scouts, Ventures or Rovers).");
  const nextSection = nextSections[0];
  const sectionRoles = normalizeMemberSectionRoles(updates.sectionRoles, nextSections);
  const changeType = detectMemberLifecycleChange(
    { section: previousSection, status: previousStatus },
    { section: nextSection, status: updates.status }
  );

  const automaticName = automaticDisplayName(updates.firstName, updates.lastName);
  const requestedDisplayName = clean(updates.displayName, 200);
  const displayNameMode = updates.displayNameMode === "custom" ? "custom" : "auto";
  const nextDisplayName = displayNameMode === "auto" ? automaticName : requestedDisplayName;
  if (displayNameMode === "custom" && !nextDisplayName) throw new UserFacingError("Custom display name is required.");

  const memberUpdate = {
    firstName: clean(updates.firstName, 100),
    lastName: clean(updates.lastName, 100),
    displayName: nextDisplayName,
    displayNameMode,
    dateOfBirth: clean(updates.dateOfBirth, 20),
    section: nextSection,
    sections: nextSections,
    sectionRoles,
    parentName: clean(updates.parentName, 200),
    emailAddress: clean(updates.emailAddress, 254),
    mobileNumber: clean(updates.mobileNumber, 40),
    emergencyContactName: clean(updates.emergencyContactName, 200),
    emergencyContactPhone: clean(updates.emergencyContactPhone, 40),
    status: updates.status,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  };

  if (changeType) {
    const batch = writeBatch(db);
    const historyRef = doc(collection(db, "memberHistory"));
    batch.update(memberRef, memberUpdate);
    batch.set(historyRef, {
      memberId,
      memberName: nextDisplayName,
      changeType,
      fromSection: previousSection,
      toSection: nextSection,
      fromStatus: previousStatus,
      toStatus: updates.status,
      changedBy: user.uid,
      changedAt: serverTimestamp()
    });
    await batch.commit();

    await recordAuditEvent({
      category: "member",
      action: lifecycleChangeLabel(changeType),
      targetId: memberId,
      targetLabel: nextDisplayName,
      section: nextSection,
      description: `${previousSection} / ${previousStatus} → ${nextSection} / ${updates.status}.`
    });
    return;
  }

  await updateDoc(memberRef, memberUpdate);
  await recordAuditEvent({
    category: "member",
    action: "Member updated",
    targetId: memberId,
    targetLabel: nextDisplayName,
    section: nextSection,
    description: `Updated member record; status is ${updates.status}.`
  });
}

export async function loadMemberLifecycleHistory(memberId: string): Promise<MemberLifecycleHistoryRecord[]> {
  const snapshot = await getDocs(query(collection(db, "memberHistory"), where("memberId", "==", memberId)));
  return snapshot.docs.flatMap((item) => {
    const data = item.data();
    const fromStatus = memberStatus(data.fromStatus);
    const toStatus = memberStatus(data.toStatus);
    const changeType = data.changeType as MemberLifecycleChangeType;
    if (!fromStatus || !toStatus || !LIFECYCLE_TYPES.includes(changeType)) return [];
    return [{
      id: item.id,
      memberId: stringValue(data, "memberId"),
      memberName: stringValue(data, "memberName"),
      changeType,
      fromSection: stringValue(data, "fromSection"),
      toSection: stringValue(data, "toSection"),
      fromStatus,
      toStatus,
      changedBy: stringValue(data, "changedBy"),
      changedAt: timestampToDate(data.changedAt)
    }];
  }).sort((a, b) => (b.changedAt?.getTime() || 0) - (a.changedAt?.getTime() || 0));
}

export async function loadMemberConsentSummaries(member: MemberRecord): Promise<MemberConsentSummary[]> {
  if (!member.sections.length) return [];

  const user = auth.currentUser;
  if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");
  const profileSnapshot = await getDoc(doc(db, "adminUsers", user.uid));
  const isAdmin = profileSnapshot.exists() && ["admin", "super-admin"].includes(String(profileSnapshot.data().role));
  const snapshots = isAdmin
    ? [await getDocs(collection(db, "consentApplications"))]
    : await Promise.all([
        getDocs(query(collection(db, "consentApplications"), where("memberId", "==", member.id))),
        ...member.sections.flatMap((memberSection) => storageSectionAliases(memberSection)).map((section) =>
          getDocs(query(collection(db, "consentApplications"), where("section", "==", section)))
        )
      ]);
  const documents = [...new Map(snapshots.flatMap((snapshot) => snapshot.docs).map((item) => [item.id, item])).values()];

  const summaries = documents.flatMap((consentSnapshot) => {
    const data = consentSnapshot.data();
    if (data.formType !== "youth-activity-consent") return [];
    const childName = stringValue(data, "childName");
    const childDOB = stringValue(data, "childDOB");
    const linkedMemberId = stringValue(data, "memberId");
    const stableIdMatch = linkedMemberId === member.id;
    if (!stableIdMatch) return [];
    return [{
      consentId: consentSnapshot.id,
      memberName: childName,
      dateOfBirth: childDOB,
      section: stringValue(data, "section"),
      consentTo: stringValue(data, "consentTo"),
      submittedAt: timestampToDate(data.submittedAt),
      hasMedicalAlert: hasMedicalAlert(data),
      hasMedicationManagement: medicationEnabled(data)
    }];
  }).sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));

  return summaries;
}

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
import {
  completionTargetsForRequirement,
  completionTargetsForStage,
  stageAwardId,
  type AdventureProgressSourceType
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
  if (!user) throw new Error("No signed-in leader.");
  return user.uid;
}

function memberProgressRoot(memberId: string) {
  return doc(db, "memberAdventureSkillProgress", memberId);
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

export async function setRequirementCompletionForMembers(
  memberIds: string[],
  requirementId: string,
  completed: boolean,
  source: AdventureProgressSource = { type: "manual" }
): Promise<void> {
  const userId = currentUserId();
  const targets = completionTargetsForRequirement(requirementId);
  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))];
  if (uniqueMemberIds.length === 0) throw new Error("Select at least one member.");

  const batch = writeBatch(db);
  for (const memberId of uniqueMemberIds) {
    const root = memberProgressRoot(memberId);
    for (const target of targets) {
      const requirementRef = doc(collection(root, "requirements"), target.requirementId);
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
  }
  await batch.commit();
}

export async function completeStageForMembers(
  memberIds: string[],
  skillId: string,
  stage: number,
  source: AdventureProgressSource = { type: "manual" }
): Promise<void> {
  const userId = currentUserId();
  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))];
  if (uniqueMemberIds.length === 0) throw new Error("Select at least one member.");
  const targets = completionTargetsForStage(skillId, stage);
  const batch = writeBatch(db);
  for (const memberId of uniqueMemberIds) {
    const root = memberProgressRoot(memberId);
    for (const target of targets) {
      batch.set(doc(collection(root, "requirements"), target.requirementId), {
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
  }
  await batch.commit();
}

export async function setStageAwardForMembers(memberIds: string[], skillId: string, stage: number, awarded: boolean): Promise<void> {
  const userId = currentUserId();
  const awardId = stageAwardId(skillId, stage);
  const uniqueMemberIds = [...new Set(memberIds.filter(Boolean))];
  if (uniqueMemberIds.length === 0) throw new Error("Select at least one member.");

  await Promise.all(uniqueMemberIds.map(async (memberId) => {
    const awardRef = doc(collection(memberProgressRoot(memberId), "awards"), awardId);
    if (!awarded) {
      await deleteDoc(awardRef);
      return;
    }
    await setDoc(awardRef, {
      memberId,
      skillId,
      stage,
      awardedAt: serverTimestamp(),
      awardedBy: userId
    });
  }));
}

import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import {
  categoryForFamilyPosition,
  createPaymentReversal,
  familyIncrementFor,
  validatePayment,
  validatePolicy,
  type SubsAssignment,
  type SubsFamilyType,
  type SubsPayment,
  type SubsPaymentMethod,
  type SubsRateCategory,
  type SubsRatePolicy
} from "./subsLogic";

const uid = () => {
  const value = auth.currentUser?.uid;
  if (!value) throw new Error("You must be signed in to manage subs.");
  return value;
};

const asDate = (value: unknown) => value && typeof value === "object" && "toDate" in value
  ? (value as { toDate(): Date }).toDate()
  : null;

export async function loadSubsPolicies(): Promise<SubsRatePolicy[]> {
  const snap = await getDocs(collection(db, "subsRatePolicies"));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() } as SubsRatePolicy))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version);
}

export async function saveSubsPolicy(input: Omit<SubsRatePolicy, "id">): Promise<string> {
  const actor = uid();
  const valid = validatePolicy(input);
  const id = `${valid.period.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v${valid.version}`;
  await setDoc(doc(db, "subsRatePolicies", id), { ...valid, createdBy: actor, createdAt: serverTimestamp() });
  void recordAuditEvent({
    category: "finance",
    action: "subs-policy-created",
    targetId: id,
    targetLabel: valid.period,
    description: `Subs rate policy version ${valid.version} created.`,
    section: "Group"
  });
  return id;
}

export async function loadSubsAssignments(section?: string): Promise<SubsAssignment[]> {
  const source = section
    ? query(collection(db, "subsAssignments"), where("section", "==", section))
    : collection(db, "subsAssignments");
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() } as SubsAssignment))
    .sort((a, b) => a.memberName.localeCompare(b.memberName) || a.id.localeCompare(b.id));
}

export async function assignSubsRate(
  member: { id: string; displayName: string; section: string },
  policy: SubsRatePolicy,
  category: SubsRateCategory,
  flags: { sibling: boolean; leaderChild: boolean }
): Promise<string> {
  const actor = uid();
  const amountDueCents = category === "leader-child"
    ? policy.leaderChildCents
    : category === "sibling"
      ? policy.siblingCents
      : policy.standardCents;
  const id = `${member.id}--${policy.period.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  await setDoc(doc(db, "subsAssignments", id), {
    memberId: member.id,
    memberName: member.displayName,
    section: member.section,
    period: policy.period,
    category,
    amountDueCents,
    policyId: policy.id,
    policyVersion: policy.version,
    sibling: flags.sibling,
    leaderChild: flags.leaderChild,
    classifiedBy: actor,
    createdAt: serverTimestamp()
  });
  void recordAuditEvent({
    category: "finance",
    action: "subs-rate-assigned",
    targetId: id,
    targetLabel: member.displayName,
    description: `${category} rate assigned for ${policy.period}.`,
    section: member.section
  });
  return id;
}

export async function assignSubsFamilyRate(
  member: { id: string; displayName: string; section: string },
  policy: SubsRatePolicy,
  familyType: SubsFamilyType,
  familyPosition: number
): Promise<string> {
  const actor = uid();
  const category = categoryForFamilyPosition(familyType, familyPosition);
  const amountDueCents = familyIncrementFor(policy, familyType, familyPosition);
  const id = `${member.id}--${policy.period.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  await setDoc(doc(db, "subsAssignments", id), {
    memberId: member.id,
    memberName: member.displayName,
    section: member.section,
    period: policy.period,
    category,
    amountDueCents,
    policyId: policy.id,
    policyVersion: policy.version,
    sibling: familyPosition > 1,
    leaderChild: familyType === "leader",
    familyType,
    familyPosition,
    classifiedBy: actor,
    createdAt: serverTimestamp()
  });
  void recordAuditEvent({
    category: "finance",
    action: "subs-rate-assigned",
    targetId: id,
    targetLabel: member.displayName,
    description: `${familyType} family child ${familyPosition} rate assigned for ${policy.period}.`,
    section: member.section
  });
  return id;
}

export async function loadSubsPayments(section?: string): Promise<SubsPayment[]> {
  const source = section
    ? query(collection(db, "subsPayments"), where("section", "==", section))
    : collection(db, "subsPayments");
  const snap = await getDocs(source);
  return snap.docs
    .map((item) => {
      const data = item.data();
      return { id: item.id, ...data, createdAt: asDate(data.createdAt) } as SubsPayment;
    })
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)
      || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      || b.id.localeCompare(a.id));
}

export async function recordSubsPayment(input: {
  memberId: string;
  memberName: string;
  section: string;
  period: string;
  amountCents: number;
  method: SubsPaymentMethod;
  paymentDate: string;
  note: string;
}): Promise<string> {
  const actor = uid();
  const valid = validatePayment({ ...input, reversalOfPaymentId: "" });
  const id = doc(collection(db, "subsPayments")).id;
  await setDoc(doc(db, "subsPayments", id), { ...valid, recordedBy: actor, createdAt: serverTimestamp() });
  void recordAuditEvent({
    category: "finance",
    action: "subs-payment-recorded",
    targetId: id,
    targetLabel: input.memberName,
    description: `Subs payment recorded for ${input.period}.`,
    section: input.section
  });
  return id;
}

export async function reverseSubsPayment(original: SubsPayment, reason: string): Promise<string> {
  const actor = uid();
  const reversal = createPaymentReversal(original, reason);
  const id = `reversal-${original.id}`;
  await setDoc(doc(db, "subsPayments", id), { ...reversal, recordedBy: actor, createdAt: serverTimestamp() });
  void recordAuditEvent({
    category: "finance",
    action: "subs-payment-reversed",
    targetId: original.id,
    targetLabel: original.memberName,
    description: reason.trim(),
    section: original.section
  });
  return id;
}

import { collection, doc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { recordAuditEvent } from "./auditLog";
import {
  categoryForFamilyPosition,
  createPaymentReversal,
  familyIncrementFor,
  familyTotalFor,
  validateFamilyAccountSelection,
  validatePayment,
  validatePolicy,
  type SubsAccount,
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

export async function loadSubsAccounts(): Promise<SubsAccount[]> {
  const snap = await getDocs(collection(db, "subsAccounts"));
  return snap.docs
    .map((item) => {
      const data = item.data();
      return { id: item.id, ...data, createdAt: asDate(data.createdAt) } as SubsAccount;
    })
    .sort((a, b) => a.period.localeCompare(b.period) || a.id.localeCompare(b.id));
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

export async function createSubsFamilyAccount(
  members: Array<{ id: string; displayName: string; section: string }>,
  policy: SubsRatePolicy,
  familyType: SubsFamilyType,
  classificationNote: string
): Promise<string> {
  const actor = uid();
  const validated = validateFamilyAccountSelection(members.map((member) => member.id), classificationNote);
  const uniqueMembers = [...members]
    .filter((member, index, list) => list.findIndex((candidate) => candidate.id === member.id) === index)
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
  if (uniqueMembers.length !== validated.memberIds.length) throw new Error("Select each child exactly once.");

  const amountDueCents = familyTotalFor(policy, familyType, uniqueMembers.length);
  const accountRef = doc(collection(db, "subsAccounts"));
  const sections = [...new Set(uniqueMembers.map((member) => member.section))].sort();
  const batch = writeBatch(db);
  batch.set(accountRef, {
    period: policy.period,
    policyId: policy.id,
    policyVersion: policy.version,
    familyType,
    memberIds: uniqueMembers.map((member) => member.id),
    sections,
    childCount: uniqueMembers.length,
    amountDueCents,
    classificationSource: "finance-officer-confirmed",
    classificationNote: validated.classificationNote,
    createdBy: actor,
    createdAt: serverTimestamp()
  });

  uniqueMembers.forEach((member, index) => {
    const familyPosition = index + 1;
    const assignmentId = `${member.id}--${policy.period.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    batch.set(doc(db, "subsAssignments", assignmentId), {
      memberId: member.id,
      memberName: member.displayName,
      section: member.section,
      period: policy.period,
      category: categoryForFamilyPosition(familyType, familyPosition),
      amountDueCents: familyIncrementFor(policy, familyType, familyPosition),
      policyId: policy.id,
      policyVersion: policy.version,
      sibling: familyPosition > 1,
      leaderChild: familyType === "leader",
      familyType,
      familyPosition,
      accountId: accountRef.id,
      accountAmountDueCents: amountDueCents,
      accountChildCount: uniqueMembers.length,
      classifiedBy: actor,
      createdAt: serverTimestamp()
    });
  });

  await batch.commit();
  void recordAuditEvent({
    category: "finance",
    action: "subs-family-account-created",
    targetId: accountRef.id,
    targetLabel: `${policy.period} family account`,
    description: `${familyType} family account created for ${uniqueMembers.length} child${uniqueMembers.length === 1 ? "" : "ren"}; relationship confirmation recorded.`,
    section: sections.length === 1 ? sections[0] : "Group"
  });
  return accountRef.id;
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

export async function loadSubsPaymentsForAccount(accountId: string): Promise<SubsPayment[]> {
  if (!accountId) return [];
  const snap = await getDocs(query(collection(db, "subsPayments"), where("accountId", "==", accountId)));
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
  accountId?: string;
  amountCents: number;
  method: SubsPaymentMethod;
  paymentDate: string;
  note: string;
}): Promise<string> {
  const actor = uid();
  const valid = validatePayment({ ...input, accountId: input.accountId ?? "", reversalOfPaymentId: "" });
  const id = doc(collection(db, "subsPayments")).id;
  await setDoc(doc(db, "subsPayments", id), { ...valid, recordedBy: actor, createdAt: serverTimestamp() });
  void recordAuditEvent({
    category: "finance",
    action: "subs-payment-recorded",
    targetId: id,
    targetLabel: input.memberName,
    description: `Subs payment recorded for ${input.period}${input.accountId ? " against the shared family account" : ""}.`,
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

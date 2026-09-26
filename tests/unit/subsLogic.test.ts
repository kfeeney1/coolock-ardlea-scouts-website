import assert from "node:assert/strict";
import test from "node:test";
import {
  AGREED_SUBS_2026_27,
  balanceFor,
  balanceForAccount,
  categoryForFamilyPosition,
  createPaymentReversal,
  currentSubsAccounts,
  currentSubsAssignments,
  familyIncrementFor,
  familyTotalFor,
  familyTypeForLeaderRelationships,
  parseEuroToCents,
  paymentsForAssignment,
  rateForCategory,
  resolveCurrentSubsPolicy,
  scoutYearPeriodForDate,
  subsFamilyAccountId,
  subsFamilyAccountRevisionId,
  subsAccountLineageIds,
  validateFamilyAccountSelection,
  validatePayment,
  validatePolicy,
  type SubsAccount,
  type SubsAssignment,
  type SubsPayment,
  type SubsRatePolicy
} from "../../src/services/subsLogic.ts";

const policy: SubsRatePolicy={
 id:"2026-v1",period:"2026/27",effectiveFrom:"2026-09-01",periodStart:"2026-09-01",periodEnd:"2027-06-30",
 standardCents:26400,leaderChildCents:20500,siblingCents:15500,version:1,
 standardFamilyRatesCents:[26400,41900,52400,62900],leaderFamilyRatesCents:[20500,34300,46500]
};
const assignment: SubsAssignment={id:"m1--2026",memberId:"m1",memberName:"Member One",section:"Cubs",period:"2026/27",category:"standard",amountDueCents:26400,policyId:policy.id,policyVersion:1,sibling:false,leaderChild:false,familyType:"standard",familyPosition:1};
const familyAssignment=(memberId:string,section:string,position:number):SubsAssignment=>({id:`${memberId}--2026`,memberId,memberName:`Member ${memberId}`,section,period:"2026/27",category:position===1?"standard":"sibling",amountDueCents:position===1?26400:position===2?15500:10500,policyId:policy.id,policyVersion:1,sibling:position>1,leaderChild:false,familyType:"standard",familyPosition:position,accountId:"family-1",accountAmountDueCents:52400,accountChildCount:3});
const payment=(amountCents:number,id="p1",memberId="m1"):SubsPayment=>({id,memberId,memberName:`Member ${memberId}`,section:"Cubs",period:"2026/27",amountCents,method:"cash",paymentDate:"2026-09-09",reversalOfPaymentId:"",note:"",recordedBy:"leader"});
const familyPayment=(amountCents:number,id="fp1",section="Cubs"):SubsPayment=>({id,memberId:"",memberName:"",section,period:"2026/27",accountId:"family-1",amountCents,method:"cash",paymentDate:"2026-09-09",reversalOfPaymentId:"",note:"",recordedBy:"leader"});
const account:SubsAccount={id:"family-1",period:"2026/27",policyId:policy.id,policyVersion:1,familyType:"standard",memberIds:["m1","m2","m3"],sections:["Beavers","Cubs","Scouts"],childCount:3,amountDueCents:52400,classificationSource:"finance-officer-confirmed",classificationNote:"Confirmed against controlled family records",createdBy:"treasurer"};

test("authoritative 2026/27 totals cover September to June",()=>{
 assert.equal(AGREED_SUBS_2026_27.periodStart,"2026-09-01");
 assert.equal(AGREED_SUBS_2026_27.periodEnd,"2027-06-30");
 assert.deepEqual([...AGREED_SUBS_2026_27.standardFamilyRatesCents],[26400,41900,52400,62900]);
 assert.deepEqual([...AGREED_SUBS_2026_27.leaderFamilyRatesCents],[20500,34300,46500]);
});
test("resolves the Scout year and current policy deterministically",()=>{
 assert.equal(scoutYearPeriodForDate("2026-09-21"),"2026/27");
 assert.equal(scoutYearPeriodForDate("2027-02-01"),"2026/27");
 assert.equal(scoutYearPeriodForDate("2027-09-01"),"2027/28");
 const historical={...policy,id:"2025-v9",period:"2025/26",periodStart:"2025-09-01",periodEnd:"2026-06-30",effectiveFrom:"2025-09-01",version:9};
 const future={...policy,id:"2026-v3",effectiveFrom:"2026-10-01",version:3};
 const currentV2={...policy,id:"2026-v2",effectiveFrom:"2026-09-15",version:2};
 assert.equal(resolveCurrentSubsPolicy([future,historical,policy,currentV2],"2026-09-21")?.id,"2026-v2");
 assert.equal(resolveCurrentSubsPolicy([future,historical],"2026-09-21"),null);
});
test("family totals are allocated as deterministic child increments",()=>{
 assert.equal(familyTotalFor(policy,"standard",4),62900);
 assert.equal(familyIncrementFor(policy,"standard",1),26400);
 assert.equal(familyIncrementFor(policy,"standard",2),15500);
 assert.equal(familyIncrementFor(policy,"standard",3),10500);
 assert.equal(familyIncrementFor(policy,"standard",4),10500);
 assert.equal(familyIncrementFor(policy,"leader",1),20500);
 assert.equal(familyIncrementFor(policy,"leader",2),13800);
 assert.equal(familyIncrementFor(policy,"leader",3),12200);
 assert.equal(categoryForFamilyPosition("standard",2),"sibling");
 assert.equal(categoryForFamilyPosition("leader",3),"leader-child");
 assert.throws(()=>familyTotalFor(policy,"leader",4),/Rate not configured/);
});
test("family rate tables support additional configured child counts and fail explicitly when missing",()=>{
 const expanded={...policy,standardFamilyRatesCents:[26400,41900,52400,62900,73400],leaderFamilyRatesCents:[20500,34300,46500,57000]};
 assert.equal(familyTotalFor(expanded,"standard",5),73400);
 assert.equal(familyIncrementFor(expanded,"standard",5),10500);
 assert.equal(familyTotalFor(expanded,"leader",4),57000);
 assert.equal(familyIncrementFor(expanded,"leader",4),10500);
 assert.throws(()=>familyTotalFor(policy,"standard",5),/Rate not configured/);
 assert.throws(()=>familyTotalFor(policy,"leader",4),/Rate not configured/);
 assert.throws(()=>familyTotalFor(policy,"leader",0),/positive integer/);
});
test("shared family assignments all resolve to the same account balance",()=>{
 const first=familyAssignment("m1","Beavers",1); const second=familyAssignment("m2","Cubs",2); const third=familyAssignment("m3","Scouts",3);
 const payments=[familyPayment(20000,"fp1","Beavers"),familyPayment(10000,"fp2","Scouts")];
 assert.deepEqual(balanceFor(first,payments),{dueCents:52400,paidCents:30000,remainingCents:22400});
 assert.deepEqual(balanceFor(second,payments),balanceFor(first,payments));
 assert.deepEqual(balanceFor(third,payments),balanceFor(first,payments));
 assert.deepEqual(balanceForAccount(account,payments),balanceFor(first,payments));
 assert.equal(paymentsForAssignment(second,payments).length,2);
});
test("non-sibling legacy assignments remain separate",()=>{
 const other={...assignment,id:"m2--2026",memberId:"m2",memberName:"Member Two"};
 const payments=[payment(4000,"p1","m1"),payment(7000,"p2","m2")];
 assert.equal(balanceFor(assignment,payments).paidCents,4000);
 assert.equal(balanceFor(other,payments).paidCents,7000);
});
test("family relationship evidence is explicit and rejects duplicate membership",()=>{
 assert.deepEqual(validateFamilyAccountSelection(["m1","m2"],"Checked controlled family record"),{memberIds:["m1","m2"],classificationNote:"Checked controlled family record"});
 assert.throws(()=>validateFamilyAccountSelection(["m1","m1"],"Checked record"),/twice/);
 assert.throws(()=>validateFamilyAccountSelection([],"Checked record"),/at least one/);
 assert.throws(()=>validateFamilyAccountSelection(["m1"],""),/confirmed/);
});
test("family account identity is stable for the same Scout-year membership snapshot",()=>{
 const first=subsFamilyAccountId("2026/27",["member-cub","member-beaver","member-scout"]);
 const reordered=subsFamilyAccountId("2026/27",["member-scout","member-cub","member-beaver"]);
 assert.equal(first,reordered);
 assert.equal(first,"2026-27--member-beaver--member-cub--member-scout");
 assert.notEqual(first,subsFamilyAccountId("2027/28",["member-cub","member-beaver","member-scout"]));
 assert.throws(()=>subsFamilyAccountId("2026/27",["member-cub","member-cub"]),/exactly once/);
});
test("parses euro amounts into integer cents without floating point storage",()=>{ assert.equal(parseEuroToCents("5"),500); assert.equal(parseEuroToCents("5.2"),520); assert.equal(parseEuroToCents("5,25"),525); assert.throws(()=>parseEuroToCents("5.999")); assert.throws(()=>parseEuroToCents("-1")); });
test("legacy explicit categories remain readable",()=>{ assert.equal(rateForCategory(policy,"standard"),26400); assert.equal(rateForCategory(policy,"leader-child"),20500); assert.equal(rateForCategory(policy,"sibling"),15500); });
test("historical assignment remains snapshotted after policy changes",()=>{ const changed={...policy,standardFamilyRatesCents:[30000,45000,55000,65000],version:2}; assert.equal(assignment.amountDueCents,26400); assert.equal(familyIncrementFor(changed,"standard",1),30000); });
test("derives partial, paid and credit balances from ledger entries",()=>{ assert.deepEqual(balanceFor(assignment,[payment(4000)]),{dueCents:26400,paidCents:4000,remainingCents:22400}); assert.equal(balanceFor(assignment,[payment(26400)]).remainingCents,0); assert.equal(balanceFor(assignment,[payment(27400)]).remainingCents,-1000); });
test("exact reversals preserve shared-account provenance",()=>{ const original=familyPayment(4000); const reversal=createPaymentReversal(original,"Wrong amount"); assert.equal(reversal.amountCents,-4000); assert.equal(reversal.reversalOfPaymentId,"fp1"); assert.equal(reversal.accountId,"family-1"); assert.equal(balanceFor(familyAssignment("m2","Cubs",2),[original,{...reversal,id:"reversal-fp1",recordedBy:"treasurer"}]).paidCents,0); });
test("validates policies and positive controlled-method payments",()=>{ const {id:policyId,...policyInput}=policy; const {id:paymentId,recordedBy,createdAt,...paymentInput}=payment(500); void policyId; void paymentId; void recordedBy; void createdAt; assert.doesNotThrow(()=>validatePolicy(policyInput)); assert.throws(()=>validatePolicy({...policyInput,standardFamilyRatesCents:[26400,25000]})); assert.doesNotThrow(()=>validatePolicy({...policyInput,standardFamilyRatesCents:[26400,41900,52400,62900,73400],leaderFamilyRatesCents:[20500,34300,46500,57000]})); assert.throws(()=>validatePolicy({...policyInput,periodEnd:"2026-08-31"})); assert.doesNotThrow(()=>validatePayment(paymentInput)); assert.throws(()=>validatePayment({...paymentInput,amountCents:0})); assert.throws(()=>validatePayment({...paymentInput,method:"card" as never})); });


test("leader-family eligibility is relationship-driven and does not double-discount", () => {
  assert.equal(familyTypeForLeaderRelationships(["m1", "m2"], []), "standard");
  assert.equal(familyTypeForLeaderRelationships(["m1", "m2"], [{ memberId: "m1", active: true }]), "leader");
  assert.equal(familyTypeForLeaderRelationships(["m1", "m2"], [{ memberId: "m1", active: true }, { memberId: "m2", active: true }]), "leader");
  assert.equal(familyTypeForLeaderRelationships(["m1"], [{ memberId: "m1", active: false }]), "standard");
  assert.equal(familyTypeForLeaderRelationships(["m1"], [{ memberId: "other", active: true }]), "standard");
});

test("family account revisions preserve the original stable identity", () => {
  const original = subsFamilyAccountId("2026/27", ["m2", "m1"]);
  assert.equal(subsFamilyAccountRevisionId("2026/27", ["m1", "m2"], 1), original);
  assert.equal(subsFamilyAccountRevisionId("2026/27", ["m1", "m2"], 2), `${original}--r2`);
  assert.throws(() => subsFamilyAccountRevisionId("2026/27", ["m1"], 0), /positive integer/);
});


test("current family accounts exclude immutable revisions that were superseded", () => {
  const original = { ...account, id: "a1" };
  const revision = { ...account, id: "a2", revision: 2, supersedesAccountId: "a1", familyType: "leader" as const };
  const unrelated = { ...account, id: "b1", memberIds: ["m9"] };
  assert.deepEqual(currentSubsAccounts([original, revision, unrelated]).map((item) => item.id).sort(), ["a2", "b1"]);
});


test("current assignment revisions exclude superseded member-period snapshots", () => {
  const original = familyAssignment("m1", "Cubs", 1);
  const revised = { ...original, id: original.id + "--r2", familyType: "leader" as const, leaderChild: true };
  const other = familyAssignment("m2", "Scouts", 2);
  assert.deepEqual(currentSubsAssignments([original, revised, other]).map((item) => item.id).sort(), [other.id, revised.id].sort());
});

test("reclassified family account retains payments from its immutable account lineage", () => {
  const original = { ...account, id: "family-1" };
  const revision = { ...account, id: "family-1--r2", revision: 2, supersedesAccountId: "family-1", familyType: "leader" as const, amountDueCents: 46500 };
  const payments = [familyPayment(20000, "p-old"), { ...familyPayment(5000, "p-new"), accountId: "family-1--r2" }];
  assert.deepEqual(subsAccountLineageIds(revision, [original, revision]), ["family-1--r2", "family-1"]);
  assert.deepEqual(balanceForAccount(revision, payments, [original, revision]), { dueCents: 46500, paidCents: 25000, remainingCents: 21500 });
});


test("current assignments retain only the newest immutable family revision", () => {
  const original: SubsAssignment = { ...assignment, id: "m1--2026-27", accountId: "family-1" };
  const revised: SubsAssignment = { ...assignment, id: "m1--2026-27--r2", category: "leader-child", leaderChild: true, familyType: "leader", accountId: "family-1--r2" };
  assert.deepEqual(currentSubsAssignments([original, revised]).map((item) => item.id), ["m1--2026-27--r2"]);
});

test("revised family balance includes immutable payments from predecessor accounts", () => {
  const original: SubsAccount = { id: "family-1", period: "2026/27", policyId: policy.id, policyVersion: 1, familyType: "standard", memberIds: ["m1"], sections: ["Cubs"], childCount: 1, amountDueCents: 26400, classificationSource: "finance-officer-confirmed", classificationNote: "confirmed", createdBy: "admin" };
  const revised: SubsAccount = { ...original, id: "family-1--r2", familyType: "leader", amountDueCents: 20500, revision: 2, supersedesAccountId: original.id };
  const priorPayment: SubsPayment = { id: "payment-1", memberId: "m1", memberName: "Member One", section: "Cubs", period: "2026/27", accountId: original.id, amountCents: 10000, method: "bank", paymentDate: "2026-09-20", reversalOfPaymentId: "", note: "", recordedBy: "admin" };
  assert.deepEqual(balanceForAccount(revised, [priorPayment], [original, revised]), { dueCents: 20500, paidCents: 10000, remainingCents: 10500 });
});

test("one remaining active leader parent keeps the family eligible after another link is removed", () => {
  assert.equal(familyTypeForLeaderRelationships(["m1"], [
    { memberId: "m1", active: false },
    { memberId: "m1", active: true }
  ]), "leader");
});

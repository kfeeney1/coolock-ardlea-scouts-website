import assert from "node:assert/strict";
import test from "node:test";
import {
  AGREED_SUBS_2026_27,
  balanceFor,
  balanceForAccount,
  categoryForFamilyPosition,
  createPaymentReversal,
  familyIncrementFor,
  familyTotalFor,
  parseEuroToCents,
  paymentsForAssignment,
  rateForCategory,
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
test("parses euro amounts into integer cents without floating point storage",()=>{ assert.equal(parseEuroToCents("5"),500); assert.equal(parseEuroToCents("5.2"),520); assert.equal(parseEuroToCents("5,25"),525); assert.throws(()=>parseEuroToCents("5.999")); assert.throws(()=>parseEuroToCents("-1")); });
test("legacy explicit categories remain readable",()=>{ assert.equal(rateForCategory(policy,"standard"),26400); assert.equal(rateForCategory(policy,"leader-child"),20500); assert.equal(rateForCategory(policy,"sibling"),15500); });
test("historical assignment remains snapshotted after policy changes",()=>{ const changed={...policy,standardFamilyRatesCents:[30000,45000,55000,65000],version:2}; assert.equal(assignment.amountDueCents,26400); assert.equal(familyIncrementFor(changed,"standard",1),30000); });
test("derives partial, paid and credit balances from ledger entries",()=>{ assert.deepEqual(balanceFor(assignment,[payment(4000)]),{dueCents:26400,paidCents:4000,remainingCents:22400}); assert.equal(balanceFor(assignment,[payment(26400)]).remainingCents,0); assert.equal(balanceFor(assignment,[payment(27400)]).remainingCents,-1000); });
test("exact reversals preserve shared-account provenance",()=>{ const original=familyPayment(4000); const reversal=createPaymentReversal(original,"Wrong amount"); assert.equal(reversal.amountCents,-4000); assert.equal(reversal.reversalOfPaymentId,"fp1"); assert.equal(reversal.accountId,"family-1"); assert.equal(balanceFor(familyAssignment("m2","Cubs",2),[original,{...reversal,id:"reversal-fp1",recordedBy:"treasurer"}]).paidCents,0); });
test("validates policies and positive controlled-method payments",()=>{ const {id:policyId,...policyInput}=policy; const {id:paymentId,recordedBy,createdAt,...paymentInput}=payment(500); void policyId; void paymentId; void recordedBy; void createdAt; assert.doesNotThrow(()=>validatePolicy(policyInput)); assert.throws(()=>validatePolicy({...policyInput,standardFamilyRatesCents:[26400,25000]})); assert.doesNotThrow(()=>validatePolicy({...policyInput,standardFamilyRatesCents:[26400,41900,52400,62900,73400],leaderFamilyRatesCents:[20500,34300,46500,57000]})); assert.throws(()=>validatePolicy({...policyInput,periodEnd:"2026-08-31"})); assert.doesNotThrow(()=>validatePayment(paymentInput)); assert.throws(()=>validatePayment({...paymentInput,amountCents:0})); assert.throws(()=>validatePayment({...paymentInput,method:"card" as never})); });

import { readFile } from "node:fs/promises";
import { after,before,beforeEach,test } from "node:test";
import { assertFails,assertSucceeds,initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection,deleteDoc,doc,getDoc,getDocs,query,serverTimestamp,setDoc,updateDoc,where } from "firebase/firestore";
let env; const projectId="coolock-ardlea-scouts";
const member=(section="Cubs")=>({displayName:"Member One",section,status:"active"});
const policy=(by="treasurer")=>({
 period:"2026/27",effectiveFrom:"2026-09-01",periodStart:"2026-09-01",periodEnd:"2027-06-30",
 standardCents:26400,leaderChildCents:20500,siblingCents:15500,
 standardFamilyRatesCents:[26400,41900,52400,62900],leaderFamilyRatesCents:[20500,34300,46500],
 version:1,createdBy:by,createdAt:serverTimestamp()
});
const payment=(by="leader-cubs",overrides={})=>({memberId:"m1",memberName:"Member One",section:"Cubs",period:"2026/27",amountCents:5000,method:"cash",paymentDate:"2026-09-09",reversalOfPaymentId:"",note:"",recordedBy:by,createdAt:serverTimestamp(),...overrides});
async function seed(entries){await env.withSecurityRulesDisabled(async c=>{for(const [path,data] of entries)await setDoc(doc(c.firestore(),path),data);});}
before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{rules:await readFile("firestore.rules","utf8"),host:"127.0.0.1",port:8080}});}); beforeEach(async()=>env.clearFirestore()); after(async()=>env.cleanup());

test("section leader records and reads own section but is denied cross-section",async()=>{
 await seed([["adminUsers/leader-cubs",{active:true,role:"leader",sections:["Cubs"]}],["members/m1",member()],["members/m2",{...member("Scouts"),displayName:"Scout Two"}]]);
 const db=env.authenticatedContext("leader-cubs").firestore();
 await assertSucceeds(setDoc(doc(db,"subsPayments/p1"),payment()));
 await assertSucceeds(getDocs(query(collection(db,"subsPayments"),where("section","==","Cubs"))));
 await assertFails(setDoc(doc(db,"subsPayments/p2"),payment("leader-cubs",{memberId:"m2",memberName:"Scout Two",section:"Scouts"})));
 await assertFails(getDocs(query(collection(db,"subsPayments"),where("section","==","Scouts"))));
});

test("Treasurer, Group Leader and admins can manage policies while ordinary leaders cannot",async()=>{
 await seed([
  ["adminUsers/treasurer",{active:true,role:"leader",sections:["Group"]}],["organisationLeadership/treasurer",{active:true,scoutingRole:"Group Treasurer"}],
  ["adminUsers/gl",{active:true,role:"leader",sections:["Group"]}],["organisationLeadership/gl",{active:true,scoutingRole:"Group Leader"}],
  ["adminUsers/admin",{active:true,role:"admin",sections:["Group"]}],
  ["adminUsers/leader",{active:true,role:"leader",sections:["Cubs"]}],["members/m1",member()]
 ]);
 const td=env.authenticatedContext("treasurer").firestore(); const gd=env.authenticatedContext("gl").firestore(); const ad=env.authenticatedContext("admin").firestore(); const ld=env.authenticatedContext("leader").firestore();
 await assertSucceeds(setDoc(doc(td,"subsRatePolicies/2026-v1"),policy()));
 await assertSucceeds(setDoc(doc(ad,"subsRatePolicies/2026-v2"),{...policy("admin"),version:2}));
 await assertSucceeds(setDoc(doc(gd,"subsPayments/group-payment"),payment("gl")));
 await assertFails(setDoc(doc(ld,"subsRatePolicies/no"),policy("leader")));
});

test("Treasurer can read the group member directory needed for classification",async()=>{
 await seed([["adminUsers/treasurer",{active:true,role:"leader",sections:["Group"]}],["organisationLeadership/treasurer",{active:true,scoutingRole:"Group Treasurer"}],["members/m1",member()],["members/m2",{...member("Scouts"),displayName:"Scout Two"}]]);
 const db=env.authenticatedContext("treasurer").firestore();
 await assertSucceeds(getDoc(doc(db,"members/m1")));
 await assertSucceeds(getDocs(collection(db,"members")));
});

test("family assignments snapshot a valid policy and authoritative member identity",async()=>{
 await seed([["adminUsers/treasurer",{active:true,role:"leader",sections:["Group"]}],["organisationLeadership/treasurer",{active:true,scoutingRole:"Group Treasurer"}],["members/m1",member()],["subsRatePolicies/2026-v1",{...policy(),createdAt:new Date()}]]);
 const db=env.authenticatedContext("treasurer").firestore();
 const base={memberId:"m1",memberName:"Member One",section:"Cubs",period:"2026/27",category:"sibling",amountDueCents:15500,policyId:"2026-v1",policyVersion:1,sibling:true,leaderChild:false,familyType:"standard",familyPosition:2,classifiedBy:"treasurer",createdAt:serverTimestamp()};
 await assertSucceeds(setDoc(doc(db,"subsAssignments/m1-2026"),base));
 await assertFails(setDoc(doc(db,"subsAssignments/bad-name"),{...base,memberName:"Other"}));
 await assertFails(setDoc(doc(db,"subsAssignments/bad-rate"),{...base,amountDueCents:15400}));
 await assertFails(setDoc(doc(db,"subsAssignments/bad-position"),{...base,familyPosition:5}));
 await assertFails(setDoc(doc(db,"subsAssignments/bad-category"),{...base,category:"standard"}));
 await assertFails(updateDoc(doc(db,"subsAssignments/m1-2026"),{amountDueCents:1}));
});

test("leader-family child positions use the configured incremental total",async()=>{
 await seed([["adminUsers/admin",{active:true,role:"admin",sections:["Group"]}],["members/m1",member()],["subsRatePolicies/2026-v1",{...policy("admin"),createdAt:new Date()}]]);
 const db=env.authenticatedContext("admin").firestore();
 const assignment={memberId:"m1",memberName:"Member One",section:"Cubs",period:"2026/27",category:"leader-child",amountDueCents:13800,policyId:"2026-v1",policyVersion:1,sibling:true,leaderChild:true,familyType:"leader",familyPosition:2,classifiedBy:"admin",createdAt:serverTimestamp()};
 await assertSucceeds(setDoc(doc(db,"subsAssignments/leader-child"),assignment));
 await assertFails(setDoc(doc(db,"subsAssignments/leader-child-wrong"),{...assignment,amountDueCents:34300}));
});

test("policies reject malformed family totals",async()=>{
 await seed([["adminUsers/admin",{active:true,role:"admin",sections:["Group"]}]]);
 const db=env.authenticatedContext("admin").firestore();
 await assertFails(setDoc(doc(db,"subsRatePolicies/bad-count"),{...policy("admin"),standardFamilyRatesCents:[26400,41900,52400]}));
 await assertFails(setDoc(doc(db,"subsRatePolicies/decreasing"),{...policy("admin"),leaderFamilyRatesCents:[20500,19000,46500]}));
 await assertFails(setDoc(doc(db,"subsRatePolicies/mismatched-first"),{...policy("admin"),standardCents:1}));
});

test("payments reject malformed methods, identity changes and mutation",async()=>{
 await seed([["adminUsers/leader-cubs",{active:true,role:"leader",sections:["Cubs"]}],["members/m1",member()],["subsPayments/original",{...payment(),createdAt:new Date()}]]);
 const db=env.authenticatedContext("leader-cubs").firestore();
 await assertFails(setDoc(doc(db,"subsPayments/bad-method"),payment("leader-cubs",{method:"card"})));
 await assertFails(setDoc(doc(db,"subsPayments/bad-member"),payment("leader-cubs",{memberName:"Wrong"})));
 await assertFails(updateDoc(doc(db,"subsPayments/original"),{amountCents:1}));
 await assertFails(deleteDoc(doc(db,"subsPayments/original")));
});

test("corrections are exact linked reversals and parents remain denied",async()=>{
 await seed([["adminUsers/leader-cubs",{active:true,role:"leader",sections:["Cubs"]}],["members/m1",member()],["subsPayments/original",{...payment(),createdAt:new Date()}],["parentAccounts/parent",{status:"approved",memberIds:["m1"],linkedSections:["Cubs"]}]]);
 const db=env.authenticatedContext("leader-cubs").firestore(); const reversal=payment("leader-cubs",{amountCents:-5000,reversalOfPaymentId:"original",note:"Wrong member"});
 await assertFails(setDoc(doc(db,"subsPayments/arbitrary"),reversal));
 await assertFails(setDoc(doc(db,"subsPayments/reversal-original"),{...reversal,amountCents:-4999}));
 await assertSucceeds(setDoc(doc(db,"subsPayments/reversal-original"),reversal));
 const parent=env.authenticatedContext("parent").firestore();
 await assertFails(getDoc(doc(parent,"subsPayments/original")));
 await assertFails(setDoc(doc(parent,"subsPayments/no"),payment("parent")));
});

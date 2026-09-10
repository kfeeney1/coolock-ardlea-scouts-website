import assert from "node:assert/strict";
import test from "node:test";
import { buildSubsReportRows, subsReportCsvRows } from "../../src/services/subsReport.ts";
import type { SubsAccount, SubsAssignment, SubsPayment } from "../../src/services/subsLogic.ts";

const period="2026/27";
const familyAssignment=(memberId:string,name:string,section:string,position:number,accountId="family-1",accountDue=52400):SubsAssignment=>({id:`${memberId}--2026-27`,memberId,memberName:name,section,period,category:position===1?"standard":"sibling",amountDueCents:position===1?26400:position===2?15500:10500,policyId:"2026-27-v1",policyVersion:1,sibling:position>1,leaderChild:false,familyType:"standard",familyPosition:position,accountId,accountAmountDueCents:accountDue,accountChildCount:3});
const individual=(memberId:string,name:string,section:string,due=26400):SubsAssignment=>({id:`${memberId}--2026-27`,memberId,memberName:name,section,period,category:"standard",amountDueCents:due,policyId:"2026-27-v1",policyVersion:1,sibling:false,leaderChild:false});
const payment=(id:string,memberId:string,section:string,amountCents:number,accountId="",reversalOfPaymentId=""):SubsPayment=>({id,memberId,memberName:memberId,section,period,accountId,amountCents,method:"cash",paymentDate:"2026-09-10",reversalOfPaymentId,note:"",recordedBy:"leader"});
const account=(memberIds:string[],sections:string[],amountDueCents=52400,id="family-1"):SubsAccount=>({id,period,policyId:"2026-27-v1",policyVersion:1,familyType:"standard",memberIds,sections,childCount:memberIds.length,amountDueCents,classificationSource:"finance-officer-confirmed",classificationNote:"Confirmed from controlled family record",createdBy:"treasurer"});

test("two and three sibling families each produce one canonical family row",()=>{
 const two=[familyAssignment("a","A","Beavers",1,"family-2",41900),familyAssignment("b","B","Cubs",2,"family-2",41900)];
 const three=[familyAssignment("c","C","Beavers",1),familyAssignment("d","D","Cubs",2),familyAssignment("e","E","Scouts",3)];
 assert.equal(buildSubsReportRows(two,[],[account(["a","b"],["Beavers","Cubs"],41900,"family-2")],{period,section:"all",canViewFamilyDetails:true}).length,1);
 const rows=buildSubsReportRows(three,[],[account(["c","d","e"],["Beavers","Cubs","Scouts"])],{period,section:"all",canViewFamilyDetails:true});
 assert.equal(rows.length,1); assert.equal(rows[0].members.length,3); assert.deepEqual(rows[0].sections,["Beavers","Cubs","Scouts"]);
});

test("payments through any sibling and exact reversals produce one shared balance",()=>{
 const assignments=[familyAssignment("a","A","Beavers",1),familyAssignment("b","B","Cubs",2),familyAssignment("c","C","Scouts",3)];
 const payments=[payment("p-a","a","Beavers",20000,"family-1"),payment("p-b","b","Cubs",10000,"family-1"),payment("reversal-p-b","b","Cubs",-10000,"family-1","p-b")];
 const [row]=buildSubsReportRows(assignments,payments,[account(["a","b","c"],["Beavers","Cubs","Scouts"])],{period,section:"all",canViewFamilyDetails:true});
 assert.equal(row.dueCents,52400); assert.equal(row.paidCents,20000); assert.equal(row.reversedCents,10000); assert.equal(row.remainingCents,32400);
});

test("cross-section family is counted once in group and matching section reports",()=>{
 const assignments=[familyAssignment("a","A","Beavers",1),familyAssignment("b","B","Cubs",2),familyAssignment("c","C","Scouts",3)];
 const accounts=[account(["a","b","c"],["Beavers","Cubs","Scouts"])];
 assert.equal(buildSubsReportRows(assignments,[],accounts,{period,section:"all",canViewFamilyDetails:true}).length,1);
 assert.equal(buildSubsReportRows(assignments,[],accounts,{period,section:"Cubs",canViewFamilyDetails:true}).length,1);
 assert.equal(buildSubsReportRows(assignments,[],accounts,{period,section:"Rovers",canViewFamilyDetails:true}).length,0);
});

test("unrelated and historical individual assignments remain separate and single-child records remain visible",()=>{
 const rows=buildSubsReportRows([individual("one","One","Cubs"),individual("two","Two","Cubs",20500)],[],[],{period,section:"all",canViewFamilyDetails:true});
 assert.equal(rows.length,2); assert.ok(rows.every(row=>row.kind==="individual")); assert.deepEqual(rows.map(row=>row.members[0].name),["One","Two"]);
});

test("section-scoped family report hides cross-section sibling details and shared ledger totals",()=>{
 const assignments=[familyAssignment("a","A","Beavers",1),familyAssignment("b","B","Cubs",2),familyAssignment("c","C","Scouts",3)];
 const [row]=buildSubsReportRows(assignments,[payment("p","a","Beavers",20000,"family-1")],[],{period,section:"Cubs",canViewFamilyDetails:false});
 assert.deepEqual(row.members.map(member=>member.name),["B"]); assert.deepEqual(row.sections,["Cubs"]); assert.equal(row.dueCents,null); assert.equal(row.paidCents,null); assert.equal(row.remainingCents,null); assert.equal(row.classificationNote,undefined);
});

test("group finance sees complete family membership and classification provenance",()=>{
 const assignments=[familyAssignment("a","A","Beavers",1),familyAssignment("b","B","Cubs",2)];
 const [row]=buildSubsReportRows(assignments,[],[account(["a","b"],["Beavers","Cubs"],41900)],{period,section:"all",canViewFamilyDetails:true});
 assert.deepEqual(row.members.map(member=>member.name),["A","B"]); assert.equal(row.classificationSource,"finance-officer-confirmed"); assert.match(row.classificationNote??"",/controlled family record/);
});

test("missing shared due snapshot is represented safely as Rate not configured",()=>{
 const broken={...familyAssignment("a","A","Beavers",1),accountAmountDueCents:undefined};
 const [row]=buildSubsReportRows([broken],[],[],{period,section:"all",canViewFamilyDetails:true});
 assert.equal(row.dueCents,null); assert.equal(row.remainingCents,null); const csv=subsReportCsvRows([row]); assert.equal(csv[1][4],"Rate not configured"); assert.equal(csv[1][7],"Rate not configured");
});

test("CSV follows screen grouping with one family row, standalone rows and matching canonical values",()=>{
 const assignments=[familyAssignment("a","A","Beavers",1,"family-2",41900),familyAssignment("b","B","Cubs",2,"family-2",41900),individual("solo","Solo","Scouts")];
 const payments=[payment("fp","a","Beavers",10000,"family-2"),payment("ip","solo","Scouts",4000)];
 const rows=buildSubsReportRows(assignments,payments,[account(["a","b"],["Beavers","Cubs"],41900,"family-2")],{period,section:"all",canViewFamilyDetails:true});
 assert.equal(rows.filter(row=>row.kind==="family").length,1); assert.equal(rows.filter(row=>row.kind==="individual").length,1);
 const csv=subsReportCsvRows(rows); assert.equal(csv.length,3);
 const familyCsv=csv.find(row=>row[0]==="Family account")!; assert.equal(familyCsv[4],"41900"); assert.equal(familyCsv[5],"10000"); assert.equal(familyCsv[6],"0"); assert.equal(familyCsv[7],"31900");
 const soloCsv=csv.find(row=>row[1]==="Solo")!; assert.equal(soloCsv[4],"26400"); assert.equal(soloCsv[5],"4000"); assert.equal(soloCsv[7],"22400");
});

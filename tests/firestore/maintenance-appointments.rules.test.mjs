import {readFile} from "node:fs/promises";
import {before, after, test} from "node:test";
import {initializeTestEnvironment, assertSucceeds, assertFails} from "@firebase/rules-unit-testing";
import {doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs} from "firebase/firestore";
let env;
const id = "sw337-appointment-rules-0001";
before(async () => {
 env = await initializeTestEnvironment({projectId: "demo-coolock-ardlea-scouts", firestore: {host:"127.0.0.1",port:8080,rules:await readFile("firestore.rules","utf8")}});
 await env.withSecurityRulesDisabled(async ctx => {
  const db=ctx.firestore();
  for(const [path,data] of Object.entries({"siteSettings/calendarExperience":{version:"redesigned"},"siteSettings/maintenanceExperience":{version:"redesigned",sdkRevision:1},"adminUsers/sw337-leader":{active:true,role:"leader",sections:["Scouts"]},"parentAccounts/sw337-parent":{status:"approved",memberIds:[]},"maintenance/group/access/sw337-leader":{kind:"leader",sourceId:"sw337-leader"},"maintenance/group/access/sw337-parent":{kind:"parent",sourceId:"sw337-parent"}})) await setDoc(doc(db,path),data);
 });
});
after(async()=>env?.cleanup());
const input = () => ({title:"Boiler service",date:"2026-10-22",allDay:false,startTime:"10:00",endTime:"11:00",location:"Den",notes:"Service notes",revision:1,createdBy:"sw337-leader",createdAt:serverTimestamp(),updatedBy:"sw337-leader",updatedAt:serverTimestamp()});
test("canonical group membership permits appointment CRUD while invalid data and foreign authenticated accounts fail",async()=>{
 const db=env.authenticatedContext("sw337-leader").firestore(), ref=doc(db,"maintenance/group/appointments",id);
 for(const patch of [{title:" "},{date:"2026-02-30"},{endTime:"10:00"},{endTime:"09:00"},{startTime:"24:00"},{allDay:true},{revision:2},{createdBy:"another"},{taskId:"forged-task"}]) await assertFails(setDoc(ref,{...input(),...patch}));
 await assertSucceeds(setDoc(ref,input()));
 const parent=env.authenticatedContext("sw337-parent").firestore();
 await assertSucceeds(getDocs(query(collection(parent,"maintenance/group/appointments"),where("date",">=","2026-10-01"),where("date","<=","2026-10-31"))));
 await assertSucceeds(updateDoc(doc(parent,ref.path),{date:"2026-11-01",allDay:true,startTime:"",endTime:"",revision:2,updatedBy:"sw337-parent",updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref,{revision:2,updatedBy:"sw337-leader",updatedAt:serverTimestamp()}));
 await assertFails(getDoc(doc(env.authenticatedContext("authenticated-outsider").firestore(),ref.path)));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),ref.path)));
 await assertFails(updateDoc(doc(parent,ref.path),{createdBy:"sw337-parent",revision:3,updatedBy:"sw337-parent",updatedAt:serverTimestamp()}));
});
test("Calendar and Maintenance options and current canonical membership independently revoke underlying appointment access",async()=>{
 const db=env.authenticatedContext("sw337-leader").firestore(), ref=doc(db,"maintenance/group/appointments",id);
 for(const [path,off,on] of [["siteSettings/calendarExperience",{version:"existing"},{version:"redesigned"}],["siteSettings/maintenanceExperience",{version:"existing",sdkRevision:1},{version:"redesigned",sdkRevision:1}],["adminUsers/sw337-leader",{active:false,role:"leader",sections:["Scouts"]},{active:true,role:"leader",sections:["Scouts"]}]]) {
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),path),off));
  await assertFails(getDoc(ref)); await assertFails(updateDoc(ref,{title:"Bypass",revision:3,updatedBy:"sw337-leader",updatedAt:serverTimestamp()}));
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),path),on)); await assertSucceeds(getDoc(ref));
 }
});

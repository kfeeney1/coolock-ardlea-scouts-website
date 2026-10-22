import {readFile} from "node:fs/promises";
import {before,after,test} from "node:test";
import {initializeTestEnvironment,assertSucceeds,assertFails} from "@firebase/rules-unit-testing";
import {doc,setDoc,getDoc,updateDoc,serverTimestamp} from "firebase/firestore";
let env; const taskId="sw338-canonical-task-0001", uid="sw338-parent";
const input=()=>({taskId,title:"",date:"2026-10-22",allDay:true,startTime:"",endTime:"",location:"Den",notes:"Appointment notes",revision:1,createdBy:uid,createdAt:serverTimestamp(),updatedBy:uid,updatedAt:serverTimestamp()});
before(async()=>{
 env=await initializeTestEnvironment({projectId:"demo-coolock-ardlea-scouts",firestore:{host:"127.0.0.1",port:8080,rules:await readFile("firestore.rules","utf8")}});
 await env.withSecurityRulesDisabled(async ctx=>{for(const [path,data]of Object.entries({"siteSettings/calendarExperience":{version:"redesigned"},"siteSettings/maintenanceExperience":{version:"redesigned",sdkRevision:1},[`parentAccounts/${uid}`]:{status:"approved",memberIds:[]},[`maintenance/group/access/${uid}`]:{kind:"parent",sourceId:uid},[`maintenance/group/tasks/${taskId}`]:{description:"Canonical task",status:"open",assigneeUid:"leader",assigneeName:"Current leader",documentIds:[],revision:1}}))await setDoc(doc(ctx.firestore(),path),data);});
});
after(async()=>env?.cleanup());
test("one canonical task relationship rejects duplicate schedules, snapshots and retargeting",async()=>{
 const db=env.authenticatedContext(uid).firestore(), target=doc(db,"maintenance/group/appointments",`task-${taskId}`);
 await assertFails(setDoc(doc(db,"maintenance/group/appointments","duplicate-task-appointment-001"),input()));
 await assertFails(setDoc(target,{...input(),title:"Copied task description"}));
 await assertFails(setDoc(target,{...input(),assigneeName:"Forged leader"}));
 await assertFails(setDoc(target,{...input(),taskId:"missing-maintenance-task-001"}));
 await assertSucceeds(setDoc(target,input()));
 await assertSucceeds(updateDoc(target,{date:"2026-11-03",revision:2,updatedBy:uid,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(target,{taskId:"different-task-source-001",revision:3,updatedBy:uid,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(target,{revision:2,updatedBy:uid,updatedAt:serverTimestamp()}));
 await assertSucceeds(getDoc(doc(db,"maintenance/group/tasks",taskId)));
});
test("task scheduling never bypasses Maintenance, Calendar or current membership",async()=>{
 const db=env.authenticatedContext(uid).firestore(), target=doc(db,"maintenance/group/appointments",`task-${taskId}`);
 for(const [path,off,on]of [["siteSettings/maintenanceExperience",{version:"existing",sdkRevision:1},{version:"redesigned",sdkRevision:1}],["siteSettings/calendarExperience",{version:"existing"},{version:"redesigned"}],[`parentAccounts/${uid}`,{status:"revoked",memberIds:[]},{status:"approved",memberIds:[]}]] ){
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),path),off)); await assertFails(getDoc(target)); await assertFails(updateDoc(target,{date:"2026-12-01",revision:3,updatedBy:uid,updatedAt:serverTimestamp()}));
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),path),on)); await assertSucceeds(getDoc(target));
 }
 await assertFails(getDoc(doc(env.authenticatedContext("outsider").firestore(),target.path)));
});

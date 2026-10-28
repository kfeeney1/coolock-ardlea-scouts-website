import { FieldValue } from "firebase-admin/firestore";
import { adventureSkills } from "../../src/data/adventureSkills/index";
import { scheduleFixtureDb } from "./schedule-fixtures";

export const progressMemberIds=["000-sw546-progress","000-sw546-other"];
export const progressMemberName="SW546 Progress Member";
export const camping=adventureSkills.find(skill=>skill.id==="camping")!;
const settingNames=["badgeworkExperience","leaderNavigation","scheduleExperience","meetingExperience"];
let previousSettings: {name:string;data:FirebaseFirestore.DocumentData|undefined}[]=[];
export async function seedBadgeworkProgress() {
  const db=scheduleFixtureDb();
  previousSettings=await Promise.all(settingNames.map(async name=>({name,data:(await db.doc(`siteSettings/${name}`).get()).data()})));
  const template=(await db.doc("members/TEST_member_beaver_01").get()).data()!;
  const batch=db.batch();
  for(const [index,id] of progressMemberIds.entries()) batch.set(db.doc(`members/${id}`),{...template,firstName:"SW546",lastName:index?"Other Member":"Progress Member",displayName:index?"SW546 Other Member":progressMemberName,displayNameMode:"custom",section:index?"Cubs":"Scouts",sections:[index?"Cubs":"Scouts"],testData:true});
  for(const stage of camping.stages.slice(0,3)) for(const requirement of stage.requirements.slice(0,stage.stage===2?1:undefined)) batch.set(db.doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/requirements/${requirement.id}`),{memberId:progressMemberIds[0],requirementId:requirement.id,skillId:"camping",stage:stage.stage,sharedCompetencyKey:requirement.sharedCompetencyKey??"",completedAt:FieldValue.serverTimestamp(),completedBy:"TEST_uid_super_admin_01",sourceType:"manual",sourceId:""});
  batch.set(db.doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/awards/camping-stage-1`),{memberId:progressMemberIds[0],awardId:"camping-stage-1",skillId:"camping",stage:1,awardedAt:FieldValue.serverTimestamp(),awardedBy:"TEST_uid_super_admin_01"});
  await batch.commit();
}
export async function clearBadgeworkProgress() {
  const db=scheduleFixtureDb(); const batch=db.batch();
  for(const id of progressMemberIds) {
    for(const name of ["requirements","awards"]) for(const doc of (await db.collection(`memberAdventureSkillProgress/${id}/${name}`).get()).docs) batch.delete(doc.ref);
    batch.delete(db.doc(`memberAdventureSkillProgress/${id}`));batch.delete(db.doc(`members/${id}`));
  }
  for(const {name,data} of previousSettings) {const ref=db.doc(`siteSettings/${name}`);if(data)batch.set(ref,data);else batch.delete(ref);}
  await batch.commit();
}
export async function configureBadgework(redesigned:boolean,others=false) {
  const db=scheduleFixtureDb(); const batch=db.batch();
  for(const name of settingNames) batch.set(db.doc(`siteSettings/${name}`),{version:(name==="badgeworkExperience"?redesigned:others)?"redesigned":"existing"});
  await batch.commit();
}
export async function savedProgressSnapshot() {
  const db=scheduleFixtureDb();
  return Promise.all(["requirements","awards"].map(async collection=>(await db.collection(`memberAdventureSkillProgress/${progressMemberIds[0]}/${collection}`).get()).docs.map(doc=>({id:doc.id,data:doc.data()})).sort((a,b)=>a.id.localeCompare(b.id))));
}

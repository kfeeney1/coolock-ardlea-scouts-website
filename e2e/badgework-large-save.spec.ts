import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { clearBadgeworkProgress, configureBadgework, seedBadgeworkProgress } from "./support/badgework-progress-fixtures";
import { adventureSkills } from "../src/data/adventureSkills/index";
import { completionTargetsForRequirement } from "../src/services/adventureSkillProgressLogic";
import { badgeworkSourceHref } from "../src/services/adventureSkillSourceContext";
const password=process.env.E2E_TEST_USER_PASSWORD;
const memberIds=Array.from({length:20},(_,i)=>`000-sw547-large-${String(i).padStart(2,"0")}`);
const meetingId="000-sw547-large-save";
const stage=adventureSkills.find(skill=>skill.id==="sailing")!.stages[0];
const targets=[...new Map(stage.requirements.flatMap(req=>completionTargetsForRequirement(req.id)).map(target=>[target.requirementId,target])).values()];
test.beforeEach(async()=>{
  test.skip(!password,"Configure canonical E2E credentials.");
  await seedBadgeworkProgress();await configureBadgework(true,true);
  const db=scheduleFixtureDb();const template=(await db.doc("members/TEST_member_scout_01").get()).data()!;
  const batch=db.batch();for(const [i,id] of memberIds.entries())batch.set(db.doc(`members/${id}`),{...template,firstName:"SW547",lastName:`Large ${i}`,displayName:`SW547 Large ${i}`,displayNameMode:"custom",section:"Scouts",sections:["Scouts"],testData:true});await batch.commit();
});
test.afterEach(async()=>{
  const db=scheduleFixtureDb();
  for(const id of memberIds){const batch=db.batch();for(const name of ["requirements","awards"])for(const record of (await db.collection(`memberAdventureSkillProgress/${id}/${name}`).get()).docs)batch.delete(record.ref);batch.delete(db.doc(`members/${id}`));await batch.commit();}
  for(const path of [`weeklyMeetings/${meetingId}`,`parentWeeklyMeetings/${meetingId}`])await db.doc(path).delete();
  await clearBadgeworkProgress();
});
async function assertSaved(ids: string[],sourceType:string,sourceId:string){
  const db=scheduleFixtureDb();
  for(const id of ids){
    const records=await db.collection(`memberAdventureSkillProgress/${id}/requirements`).get();
    expect(records.docs.map(doc=>doc.id).sort()).toEqual(targets.map(target=>target.requirementId).sort());
    for(const doc of records.docs){expect(doc.get("sourceType")).toBe(sourceType);expect(doc.get("sourceId")).toBe(sourceId);expect(doc.get("completedAt")).toBeTruthy();}
    expect((await db.collection(`memberAdventureSkillProgress/${id}/awards`).get()).empty).toBe(true);
  }
}
for(const source of [false,true])test(`Large ${source?"meeting":"manual"} Save commits ${source?416:520} canonical changes atomically`,async({page},testInfo)=>{
  if(testInfo.project.name==="mobile-chromium")await page.setViewportSize({width:320,height:800});
  const db=scheduleFixtureDb();const ids=memberIds.slice(0,source?16:20);
  expect(targets.length*ids.length).toBe(source?416:520);
  const meeting=db.doc(`weeklyMeetings/${meetingId}`);
  if(source)await meeting.set({section:"Scouts",meetingDate:"2099-07-22",status:"open",location:"Synthetic den",programmeNotes:JSON.stringify({marker:"weekly-programme-v1",theme:"Large badgework",notes:""}),plannedActivities:JSON.stringify({marker:"weekly-activities-v1",items:[]}),plannedBadgework:JSON.stringify({marker:"weekly-badgework-v1",items:[]}),entries:ids.map((memberId,i)=>({memberId,memberName:`SW547 Large ${i}`,attendance:"present",badges:[],notes:"",subsPaid:false})),injuries:[],notes:"",testData:true});
  await loginAsLeader(page,{email:source?"test.scout.programme.scouter@example.com":"superadmin@example.com",password:password!});
  const returnTo=`/leader/weekly?meeting=${meetingId}&stage=review`;
  await page.goto(source?badgeworkSourceHref({sourceType:"weeklyMeeting",sourceId:meetingId,memberIds:ids,returnTo}):"/leader/badgework");
  if(!source){await page.getByRole("button",{name:"Record badgework",exact:true}).click();await page.getByRole("textbox",{name:"Search children"}).fill("SW547 Large");await page.getByRole("checkbox",{name:"Select all shown",exact:true}).check();}
  await page.getByRole("button",{name:`Select ${ids.length} members and continue`,exact:true}).click();
  await page.getByRole("combobox",{name:"Adventure Skill",exact:true}).click();await page.getByRole("option",{name:"Sailing",exact:true}).click();
  await page.getByRole("button",{name:"Mark full stage complete",exact:true}).click();
  const save=page.getByRole("button",{name:source?"Save and return to Weekly Meeting":"Save changes",exact:true});
  if(source){
    await meeting.update({status:"closed"});await save.click();
    await expect(page.getByRole("alert").filter({hasText:/Unable to save badgework changes/})).toBeVisible();
    for(const id of ids)expect((await db.collection(`memberAdventureSkillProgress/${id}/requirements`).get()).empty).toBe(true);
    await expect(page.getByText("Unsaved preview",{exact:true}).first()).toBeAttached();
    await meeting.update({status:"open"});
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await save.click();
  if(source)await expect(page).toHaveURL(new RegExp(`/leader/weekly\\?meeting=${meetingId}&stage=review$`));
  else await expect(page.getByTestId("badgework-save-panel")).toContainText("No unsaved changes");
  await assertSaved(ids,source?"weeklyMeeting":"manual",source?meetingId:"");
  await page.reload();
  await assertSaved(ids,source?"weeklyMeeting":"manual",source?meetingId:"");
});

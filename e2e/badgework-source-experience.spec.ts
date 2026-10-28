import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { camping, clearBadgeworkProgress, configureBadgework, progressMemberIds, progressMemberName, savedProgressSnapshot, seedBadgeworkProgress } from "./support/badgework-progress-fixtures";
import { badgeworkSourceHref } from "../src/services/adventureSkillSourceContext";
const password=process.env.E2E_TEST_USER_PASSWORD;
const meetingId="000-sw550-badgework-source";
const eventId="000-sw550-badgework-event";
test.beforeEach(async()=>{test.skip(!password,"Configure canonical E2E credentials.");await seedBadgeworkProgress();await configureBadgework(true,true);});
test.afterEach(async()=>{await clearBadgeworkProgress();const db=scheduleFixtureDb();for(const record of (await db.collection(`weeklyMeetings/${meetingId}/leaderAttendance`).get()).docs) await record.ref.delete();for(const path of [`weeklyMeetings/${meetingId}`,`parentWeeklyMeetings/${meetingId}`,`events/${eventId}`])await db.doc(path).delete();});

test("Redesigned recording preserves attending-only selection, closed-meeting rejection and saved source return",async({page})=>{
  const db=scheduleFixtureDb();await db.doc(`members/${progressMemberIds[1]}`).update({section:"Scouts",sections:["Scouts"]});
  const entries=progressMemberIds.map((memberId,index)=>({memberId,memberName:index?"SW546 Other Member":progressMemberName,attendance:index?"absent":"present",badges:[],notes:"",subsPaid:false}));
  const meeting=db.doc(`weeklyMeetings/${meetingId}`);await meeting.set({section:"Scouts",meetingDate:"2099-07-22",status:"open",location:"Synthetic den",programmeNotes:JSON.stringify({marker:"weekly-programme-v1",theme:"Badgework source fixture",notes:""}),plannedActivities:JSON.stringify({marker:"weekly-activities-v1",items:[]}),plannedBadgework:JSON.stringify({marker:"weekly-badgework-v1",items:[]}),entries,injuries:[],notes:"",testData:true});
  await loginAsLeader(page,{email:"superadmin@example.com",password:password!});
  const returnTo=`/leader/weekly?meeting=${meetingId}&stage=review`;
  await page.goto(badgeworkSourceHref({sourceType:"weeklyMeeting",sourceId:meetingId,memberIds:progressMemberIds,returnTo}));
  await expect(page.getByRole("checkbox",{name:new RegExp(progressMemberName)})).toBeChecked();await expect(page.getByRole("checkbox",{name:/SW546 Other Member/})).toHaveCount(0);
  await page.getByRole("button",{name:"Select 1 member and continue",exact:true}).click();
  await page.getByRole("combobox",{name:"Adventure Skill",exact:true}).click();await page.getByRole("option",{name:"Camping",exact:true}).click();await page.getByRole("button",{name:/^Stage 4 ·/}).click();
  const before=await savedProgressSnapshot();await page.getByRole("button",{name:"Mark full stage complete"}).click();await meeting.update({status:"closed"});
  await page.getByRole("button",{name:"Save and return to Weekly Meeting",exact:true}).click();await expect(page.getByRole("alert").filter({hasText:/Unable to save badgework changes/})).toBeVisible();
  expect(await savedProgressSnapshot()).toEqual(before);await expect(page.getByText("Unsaved preview",{exact:true})).toBeVisible();await expect(page).toHaveURL(/\/leader\/badgework\?/);
  await meeting.update({status:"open"});await page.getByRole("button",{name:"Save and return to Weekly Meeting",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`/leader/weekly\\?meeting=${meetingId}&stage=review$`));await expect(page.getByRole("button",{name:"Review",exact:true})).toHaveAttribute("aria-pressed","true");
  for(const requirement of camping.stages[3].requirements){const record=await db.doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/requirements/${requirement.id}`).get();expect(record.get("sourceType")).toBe("weeklyMeeting");expect(record.get("sourceId")).toBe(meetingId);}
  expect((await db.collection(`memberAdventureSkillProgress/${progressMemberIds[1]}/requirements`).get()).size).toBe(0);
  expect((await db.doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/awards/camping-stage-4`).get()).exists).toBe(false);
});

test("Event source Save and return retains event provenance without awarding",async({page})=>{
  const db=scheduleFixtureDb();await db.doc(`events/${eventId}`).set({title:"Badgework source event",description:"Synthetic source fixture",eventType:"Activity",section:"Scouts",location:"Scout den",startDate:"2099-07-22",endDate:"2099-07-22",status:"open",consentRequired:false,attendance:{[progressMemberIds[0]]:"attending"},consent:{},audience:{version:2,mode:"members",semantics:"snapshot",sectionIds:[],memberIds:[progressMemberIds[0]],resolvedMemberIds:[progressMemberIds[0]]},testData:true});
  await loginAsLeader(page,{email:"superadmin@example.com",password:password!});
  const returnTo=`/leader/events?event=${eventId}`;
  await page.goto(badgeworkSourceHref({sourceType:"event",sourceId:eventId,memberIds:[progressMemberIds[0]],returnTo}));
  await expect(page.getByRole("checkbox",{name:new RegExp(progressMemberName)})).toBeChecked();await page.getByRole("button",{name:"Select 1 member and continue",exact:true}).click();
  await page.getByRole("combobox",{name:"Adventure Skill",exact:true}).click();await page.getByRole("option",{name:"Camping",exact:true}).click();await page.getByRole("button",{name:/^Stage 4 ·/}).click();await page.getByRole("button",{name:"Mark full stage complete"}).click();
  await page.getByRole("button",{name:"Save and return to Event",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/leader/events\\?event=${eventId}$`));
  for(const requirement of camping.stages[3].requirements){const record=await db.doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/requirements/${requirement.id}`).get();expect(record.get("sourceType")).toBe("event");expect(record.get("sourceId")).toBe(eventId);}
  expect((await db.doc(`memberAdventureSkillProgress/${progressMemberIds[0]}/awards/camping-stage-4`).get()).exists).toBe(false);
});

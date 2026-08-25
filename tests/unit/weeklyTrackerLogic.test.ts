import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyMemberSummaries, newWeeklyEntry } from "../../src/services/weeklyTrackerLogic.ts";
import { defaultActivityPlans, defaultBadgeworkPlans } from "../../src/services/weeklyTracker.ts";
import type { WeeklyMeetingRecord } from "../../src/services/weeklyTracker.ts";
function record(id:string,meetingDate:string,entries:WeeklyMeetingRecord["entries"]):WeeklyMeetingRecord{return{id,section:"Cubs",meetingDate,status:"closed",location:"Scout Den",theme:"",activities:[],badgeworkPlan:[],programmeNotes:"",notes:"",injuries:[],entries};}
const records=[record("week-1","2026-08-01",[{memberId:"m1",memberName:"Alex Scout",attendance:"present",subsPaid:true,subsAmount:3,badges:["Hiker"]},{memberId:"m2",memberName:"Jamie Scout",attendance:"absent",subsPaid:false,subsAmount:0,badges:[]}]),record("week-2","2026-08-08",[{memberId:"m1",memberName:"Alex Scout",attendance:"absent",subsPaid:true,subsAmount:3,badges:["Hiker","Teamwork"]},{memberId:"m2",memberName:"Jamie Scout",attendance:"unrecorded",subsPaid:true,subsAmount:3,badges:["Teamwork"]}])];
test("buildWeeklyMemberSummaries calculates attendance, subs and unique badges",()=>{const alex=buildWeeklyMemberSummaries(records).find(item=>item.memberId==="m1");assert.ok(alex);assert.equal(alex.attendanceRate,50);assert.equal(alex.subsPaidTotal,6);assert.deepEqual(alex.badges,["Hiker","Teamwork"]);});
test("unrecorded attendance is excluded from the attendance rate",()=>{const jamie=buildWeeklyMemberSummaries(records).find(item=>item.memberId==="m2");assert.ok(jamie);assert.equal(jamie.attendanceRate,0);assert.equal(jamie.unrecorded,1);});
test("newWeeklyEntry starts with neutral defaults",()=>{assert.deepEqual(newWeeklyEntry("member-1","Sam Scout"),{memberId:"member-1",memberName:"Sam Scout",attendance:"unrecorded",subsPaid:false,subsAmount:0,badges:[]});});
test("new meetings default to two activities and one badgework row",()=>{const activities=defaultActivityPlans();const badgework=defaultBadgeworkPlans();assert.equal(activities.length,2);assert.equal(badgework.length,1);assert.notEqual(activities[0].id,activities[1].id);});

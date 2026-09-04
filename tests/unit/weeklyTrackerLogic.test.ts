import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyMemberSummaries, defaultActivityPlans, defaultBadgeworkPlans, newWeeklyEntry, totalProgrammeDuration, weeklyMeetingHasChanges } from "../../src/services/weeklyTrackerLogic.ts";
import type { WeeklyMeetingRecord } from "../../src/services/weeklyTracker.ts";

function record(id: string, meetingDate: string, entries: WeeklyMeetingRecord["entries"]): WeeklyMeetingRecord {
  return { id, section: "Cubs", meetingDate, status: "closed", location: "Scout Den", theme: "", activities: [], badgeworkPlan: [], programmeNotes: "", notes: "", injuries: [], entries };
}
const records: WeeklyMeetingRecord[] = [
  record("week-1", "2026-08-01", [
    { memberId: "m1", memberName: "Alex Scout", attendance: "present", subsPaid: true, subsAmount: 3, badges: ["Hiker"] },
    { memberId: "m2", memberName: "Jamie Scout", attendance: "absent", subsPaid: false, subsAmount: 0, badges: [] }
  ]),
  record("week-2", "2026-08-08", [
    { memberId: "m1", memberName: "Alex Scout", attendance: "absent", subsPaid: true, subsAmount: 3, badges: ["Hiker", "Teamwork"] },
    { memberId: "m2", memberName: "Jamie Scout", attendance: "unrecorded", subsPaid: true, subsAmount: 3, badges: ["Teamwork"] }
  ])
];

test("buildWeeklyMemberSummaries calculates attendance, subs and unique badges", () => { const alex=buildWeeklyMemberSummaries(records).find(item=>item.memberId==="m1"); assert.ok(alex); assert.equal(alex.attendanceRate,50); assert.equal(alex.subsPaidTotal,6); assert.deepEqual(alex.badges,["Hiker","Teamwork"]); });
test("unrecorded attendance is excluded from the attendance rate", () => { const jamie=buildWeeklyMemberSummaries(records).find(item=>item.memberId==="m2"); assert.ok(jamie); assert.equal(jamie.attendanceRate,0); assert.equal(jamie.unrecorded,1); });
test("newWeeklyEntry starts with neutral defaults", () => { assert.deepEqual(newWeeklyEntry("member-1","Sam Scout"),{memberId:"member-1",memberName:"Sam Scout",attendance:"unrecorded",subsPaid:false,subsAmount:0,badges:[]}); });
test("new meetings default to two activities and one badgework row with mirrored planning fields", () => { const activities=defaultActivityPlans(); const badgework=defaultBadgeworkPlans(); assert.equal(activities.length,2); assert.equal(badgework.length,1); assert.notEqual(activities[0].id,activities[1].id); assert.deepEqual({leader:badgework[0].leader,equipment:badgework[0].equipment,durationMinutes:badgework[0].durationMinutes},{leader:"",equipment:"",durationMinutes:0}); });
test("totalProgrammeDuration combines activity and badgework durations", () => { const activities=defaultActivityPlans(); const badgework=defaultBadgeworkPlans(); activities[0].durationMinutes=45; activities[1].durationMinutes=20; badgework[0].durationMinutes=30; assert.equal(totalProgrammeDuration(activities,badgework),95); });
test("weeklyMeetingHasChanges detects edits against the saved meeting snapshot", () => { const saved=record("week-1","2026-08-01",records[0].entries); assert.equal(weeklyMeetingHasChanges(saved,{...saved}),false); assert.equal(weeklyMeetingHasChanges({...saved,notes:"Updated notes"},saved),true); assert.equal(weeklyMeetingHasChanges(null,saved),false); });

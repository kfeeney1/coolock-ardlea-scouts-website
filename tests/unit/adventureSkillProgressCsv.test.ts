import assert from "node:assert/strict";
import test from "node:test";

import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import { adventureSkillProgressCsv, badgeworkExportFilename } from "../../src/services/adventureSkillProgressCsv.ts";
import type { MemberRecord } from "../../src/services/memberAdmin.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";

const camping = adventureSkills.find((skill) => skill.id === "camping")!;
const member = { id: "member-1", displayName: "Riley Nolan", section: "Beavers" } as MemberRecord;

test("badgework CSV keeps requirements and awards separate without sensitive member data", () => {
  const requirement = camping.stages[0].requirements[0];
  const progress: MemberAdventureProgress = {
    memberId: member.id,
    requirements: [{ requirementId: requirement.id, skillId: camping.id, stage: 1, sharedCompetencyKey: requirement.sharedCompetencyKey ?? "", completedAt: null, completedBy: "leader-1", sourceType: "manual", sourceId: "" }],
    awards: []
  };
  const csv = adventureSkillProgressCsv([member], new Map([[member.id, progress]]), "camping");

  assert.match(csv, /"Child","Section","Adventure Skill","Stage","Completed Points","Total Points","Requirements","Award"/);
  assert.match(csv, /"Riley Nolan","Beavers","Camping","1","1","12","In progress","Not awarded"/);
  assert.doesNotMatch(csv, /medical|date of birth|parent|email|phone/i);
  assert.equal(csv.split("\r\n").length, 10);
});

test("badgework CSV escapes spreadsheet formulas and creates a scoped filename", () => {
  const unsafeMember = { ...member, displayName: "=1+1" };
  const csv = adventureSkillProgressCsv([unsafeMember], new Map(), "swimming");
  assert.match(csv, /^"'=1\+1"/m);
  assert.equal(badgeworkExportFilename("swimming", new Date("2026-09-06T12:00:00Z")), "badgework-progress-swimming-2026-09-06.csv");
});

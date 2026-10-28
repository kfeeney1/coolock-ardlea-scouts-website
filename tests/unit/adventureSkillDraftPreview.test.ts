import test from "node:test";
import assert from "node:assert/strict";
import { adventureSkillDraftPreview } from "../../src/services/adventureSkillDraftPreview.ts";
import { completionTargetsForRequirement } from "../../src/services/adventureSkillProgressLogic.ts";
import { allAdventureSkillRequirements } from "../../src/data/adventureSkills/index.ts";
import { memberRequirementDraftKey } from "../../src/services/adventureSkillMemberDraftLogic.ts";
import { adventureSkillOverview } from "../../src/services/adventureSkillOverviewLogic.ts";
import type { MemberAdventureProgress } from "../../src/services/adventureSkillProgress.ts";
const shared = allAdventureSkillRequirements().find(item => completionTargetsForRequirement(item.id).length > 1)!;
const targets = completionTargetsForRequirement(shared.id);
const saved: MemberAdventureProgress = { memberId: "one", requirements: [], awards: [{id:"camping-stage-1",skillId:"camping",stage:1,awardedAt:null,awardedBy:"leader"}] };

test("group preview expands canonical equivalents without mutating saved records or creating awards", () => {
  const preview = adventureSkillDraftPreview("one", saved, new Map([[shared.id,true]]), new Map());
  assert.deepEqual(preview.requirements.map(item=>item.requirementId),targets.map(item=>item.requirementId));
  assert.deepEqual(saved.requirements,[]);
  assert.deepEqual(preview.awards,saved.awards);
  assert.equal(adventureSkillOverview(preview).find(item=>item.skillId==="camping")!.highestAwardedStage,1);
});
test("individual exceptions override the whole equivalent group for only the intended member", () => {
  const group = new Map([[shared.id,true]]);
  const individual = new Map([[memberRequirementDraftKey("one",shared.id),false]]);
  assert.equal(adventureSkillDraftPreview("one",saved,group,individual).requirements.length,0);
  assert.equal(adventureSkillDraftPreview("two",undefined,group,individual).requirements.length,targets.length);
});
test("removing an equivalent clears all evidence in the preview and Discard restores the saved counts", () => {
  const completed = adventureSkillDraftPreview("one",saved,new Map([[shared.id,true]]),new Map());
  const preview = adventureSkillDraftPreview("one",completed,new Map([[shared.id,false]]),new Map());
  assert.equal(preview.requirements.length,0);
  assert.equal(completed.requirements.length,targets.length);
  assert.equal(adventureSkillDraftPreview("one",completed,new Map(),new Map()).requirements.length,targets.length);
});

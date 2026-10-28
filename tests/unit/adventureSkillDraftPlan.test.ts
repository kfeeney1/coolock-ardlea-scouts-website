import test from "node:test";
import assert from "node:assert/strict";
import { adventureSkillDraftPlan } from "../../src/services/adventureSkillDraftPlan.ts";
import { completionTargetsForRequirement } from "../../src/services/adventureSkillProgressLogic.ts";
import { allAdventureSkillRequirements, adventureSkills } from "../../src/data/adventureSkills/index.ts";
import { memberRequirementDraftKey } from "../../src/services/adventureSkillMemberDraftLogic.ts";
const requirement = allAdventureSkillRequirements().find(item=>completionTargetsForRequirement(item.id).length>1)!;
const targets = completionTargetsForRequirement(requirement.id);
test("atomic draft plan deduplicates members and equivalent document targets, applying exceptions last",()=>{
  const group=new Map(targets.map(target=>[target.requirementId,true]));
  const individual=new Map([[memberRequirementDraftKey("one",requirement.id),false]]);
  const plan=adventureSkillDraftPlan(["one"," one ","two"],group,individual);
  assert.equal(plan.length,targets.length*2);
  assert.ok(plan.filter(op=>op.memberId==="one").every(op=>!op.completed));
  assert.ok(plan.filter(op=>op.memberId==="two").every(op=>op.completed));
});
test("a stale individual draft cannot write an unselected child",()=>{
  assert.throws(()=>adventureSkillDraftPlan(["one"],new Map(),new Map([[memberRequirementDraftKey("other",requirement.id),true]])),/outside the current selection/);
});
test("invalid catalogue requirements fail during planning before any commit",()=>{
  assert.throws(()=>adventureSkillDraftPlan(["one"],new Map([["swimming-stage-7-fake",true]]),new Map()),/Unknown/);
});

test("large selections retain every canonical equivalent in one save plan",()=>{
  const stage=adventureSkills.find(skill=>skill.id==="sailing")!.stages[0];
  const ids=Array.from({length:20},(_,i)=>`member-${i}`);
  const plan=adventureSkillDraftPlan(ids,new Map(stage.requirements.map(req=>[req.id,true])),new Map());
  assert.equal(plan.length,520);
  assert.equal(new Set(plan.map(op=>`${op.memberId}/${op.target.requirementId}`)).size,520);
  for(const id of ids)assert.equal(plan.filter(op=>op.memberId===id).length,26);
});

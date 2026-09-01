const text = (value) => typeof value === "string" ? value.trim() : "";

export function adventureCatalogueContract(skills) {
  const skillsById = new Map();
  const requirementsById = new Map();
  for (const skill of skills) {
    const stages = new Map();
    for (const stage of skill.stages) {
      stages.set(stage.stage, stage.requirements.map((requirement) => requirement.id));
      for (const requirement of stage.requirements) requirementsById.set(requirement.id, {
        skillId: skill.id,
        stage: stage.stage,
        sharedCompetencyKey: text(requirement.sharedCompetencyKey)
      });
    }
    skillsById.set(skill.id, { stages });
  }
  return { skillsById, requirementsById };
}

export function validateAdventureIntegrity({ members, weeklyMeetings, events, requirements, awards, catalogue }) {
  const errors = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  const completedByMember = new Map();

  for (const record of requirements) {
    const { id, memberId, path, data } = record;
    if (!members.has(memberId)) fail(path, `parent member ${memberId} does not exist`);
    if (text(data.memberId) !== memberId) fail(path, "memberId does not match parent path");
    if (text(data.requirementId) !== id) fail(path, "requirementId does not match document id");
    const expected = catalogue.requirementsById.get(id);
    if (!expected) fail(path, "requirementId is absent from the canonical catalogue");
    else {
      if (data.skillId !== expected.skillId || data.stage !== expected.stage) fail(path, "skillId or stage differs from the canonical requirement");
      if (text(data.sharedCompetencyKey) !== expected.sharedCompetencyKey) fail(path, "sharedCompetencyKey differs from the canonical requirement");
    }
    if (!text(data.completedBy)) fail(path, "completedBy is required");
    if (!data.completedAt || typeof data.completedAt.toDate !== "function") fail(path, "completedAt must be a timestamp");
    if (!["manual", "weeklyMeeting", "event", "activity", "migration"].includes(data.sourceType)) fail(path, "sourceType is invalid");
    const sourceId = text(data.sourceId);
    if (["weeklyMeeting", "event", "activity"].includes(data.sourceType) && !sourceId) fail(path, "sourceId is required for linked progress");
    if (data.sourceType === "weeklyMeeting" && sourceId && !weeklyMeetings.has(sourceId)) fail(path, "sourceId references no weekly meeting");
    if (["event", "activity"].includes(data.sourceType) && sourceId && !events.has(sourceId)) fail(path, "sourceId references no event/activity record");
    if (!completedByMember.has(memberId)) completedByMember.set(memberId, new Set());
    if (expected) completedByMember.get(memberId).add(id);
  }

  const sharedCompletion = (memberId, requirementId) => {
    const expected = catalogue.requirementsById.get(requirementId);
    const completed = completedByMember.get(memberId) || new Set();
    if (completed.has(requirementId)) return true;
    if (!expected?.sharedCompetencyKey) return false;
    return [...completed].some((id) => catalogue.requirementsById.get(id)?.sharedCompetencyKey === expected.sharedCompetencyKey);
  };

  const seenAwards = new Set();
  for (const record of awards) {
    const { id, memberId, path, data } = record;
    if (!members.has(memberId)) fail(path, `parent member ${memberId} does not exist`);
    if (text(data.memberId) !== memberId) fail(path, "memberId does not match parent path");
    if (text(data.awardId) !== id) fail(path, "awardId does not match document id");
    const skill = catalogue.skillsById.get(text(data.skillId));
    const expectedId = `${text(data.skillId)}-stage-${data.stage}`;
    if (id !== expectedId) fail(path, `document id must be ${expectedId}`);
    if (!skill?.stages.has(data.stage)) fail(path, "skillId/stage is absent from the canonical catalogue");
    if (!text(data.awardedBy)) fail(path, "awardedBy is required");
    if (!data.awardedAt || typeof data.awardedAt.toDate !== "function") fail(path, "awardedAt must be a timestamp");
    const awardKey = `${memberId}/${expectedId}`;
    if (seenAwards.has(awardKey)) fail(path, "duplicate member stage award");
    seenAwards.add(awardKey);
    const stageRequirements = skill?.stages.get(data.stage) || [];
    if (stageRequirements.some((requirementId) => !sharedCompletion(memberId, requirementId))) fail(path, "stage was awarded before all canonical requirements were complete");
  }

  return errors.sort();
}


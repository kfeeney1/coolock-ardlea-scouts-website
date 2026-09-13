const GROUP_LEADER_ROLES = new Set([
  "Group Leader",
  "Deputy Group Leader",
  "Deputy-Group-Leader",
  "Deputy GroupLead",
  "DGL",
]);

export function buildCatalogueIndex(catalogue) {
  const skills = new Map();
  const requirements = new Map();
  const shared = new Map();

  for (const skill of catalogue) {
    if (!skill || typeof skill.id !== "string" || !Array.isArray(skill.stages)) continue;
    const stages = new Map();
    for (const stage of skill.stages) {
      if (!stage || !Number.isInteger(stage.stage) || !Array.isArray(stage.requirements)) continue;
      const stageRequirementIds = [];
      for (const requirement of stage.requirements) {
        if (!requirement || typeof requirement.id !== "string") continue;
        const sharedCompetencyKey = typeof requirement.sharedCompetencyKey === "string" ? requirement.sharedCompetencyKey : "";
        const canonical = {
          requirementId: requirement.id,
          skillId: skill.id,
          stage: stage.stage,
          sharedCompetencyKey,
        };
        requirements.set(requirement.id, canonical);
        stageRequirementIds.push(requirement.id);
        if (sharedCompetencyKey) {
          const ids = shared.get(sharedCompetencyKey) ?? [];
          ids.push(requirement.id);
          shared.set(sharedCompetencyKey, ids);
        }
      }
      stages.set(stage.stage, stageRequirementIds);
    }
    skills.set(skill.id, { maxStage: Number(skill.maxStage) || stages.size, stages });
  }

  return { skills, requirements, shared };
}

export function canonicalAward(index, skillId, stage) {
  if (typeof skillId !== "string" || !Number.isInteger(stage)) return null;
  const skill = index.skills.get(skillId);
  if (!skill || stage < 1 || stage > skill.maxStage || !skill.stages.has(stage)) return null;
  return {
    awardId: `${skillId}-stage-${stage}`,
    skillId,
    stage,
    requirementIds: skill.stages.get(stage),
  };
}

export function isCanonicalProgressDocument(index, memberId, documentId, data) {
  if (!data || typeof data !== "object") return false;
  const canonical = index.requirements.get(documentId);
  if (!canonical) return false;
  return data.memberId === memberId
    && data.requirementId === documentId
    && data.skillId === canonical.skillId
    && data.stage === canonical.stage
    && (data.sharedCompetencyKey ?? "") === canonical.sharedCompetencyKey
    && typeof data.completedBy === "string"
    && data.completedBy.trim().length > 0
    && data.completedAt != null;
}

export function completedCanonicalRequirementIds(index, memberId, progressDocuments) {
  const completed = new Set();
  for (const item of progressDocuments) {
    if (isCanonicalProgressDocument(index, memberId, item.id, item.data)) completed.add(item.id);
  }
  return completed;
}

export function isStageAuthoritativelyComplete(index, memberId, progressDocuments, skillId, stage) {
  const award = canonicalAward(index, skillId, stage);
  if (!award) return false;
  const completed = completedCanonicalRequirementIds(index, memberId, progressDocuments);

  return award.requirementIds.every((requirementId) => {
    if (completed.has(requirementId)) return true;
    const requirement = index.requirements.get(requirementId);
    if (!requirement?.sharedCompetencyKey) return false;
    const equivalentIds = index.shared.get(requirement.sharedCompetencyKey) ?? [];
    return equivalentIds.some((equivalentId) => completed.has(equivalentId));
  });
}

export function isCanonicalLeaderProfile(profile) {
  return Boolean(profile)
    && profile.active === true
    && ["leader", "admin", "super-admin"].includes(profile.role)
    && Array.isArray(profile.sections)
    && profile.sections.length > 0
    && !Object.hasOwn(profile, "section");
}

export function canManageAdventureAwards(profile, leadership, member) {
  if (!isCanonicalLeaderProfile(profile) || !member || typeof member.section !== "string") return false;
  if (["admin", "super-admin"].includes(profile.role)) return true;
  if (profile.sections.includes(member.section)) return true;
  return Boolean(leadership?.active) && GROUP_LEADER_ROLES.has(leadership.scoutingRole);
}

export function normaliseAwardRequest(data) {
  if (!data || typeof data !== "object") throw new TypeError("invalid-request");
  const skillId = typeof data.skillId === "string" ? data.skillId.trim() : "";
  const stage = data.stage;
  const awarded = data.awarded;
  const memberIds = Array.isArray(data.memberIds)
    ? [...new Set(data.memberIds.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean))]
    : [];

  if (!skillId || !Number.isInteger(stage) || typeof awarded !== "boolean" || memberIds.length === 0 || memberIds.length > 100) {
    throw new TypeError("invalid-request");
  }
  return { skillId, stage, awarded, memberIds };
}

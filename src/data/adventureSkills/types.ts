export type AdventureSkillSourceId =
    | "adventure-skills-handbook-2010"
    | "swimming-adventure-skill-2026-03";

export type AdventureSkillRequirement = {
    id: string;
    statement: string;
    sharedCompetencyKey?: string;
};

export type AdventureSkillStage = {
    stage: number;
    requirements: AdventureSkillRequirement[];
};

export type AdventureSkill = {
    id: string;
    name: string;
    maxStage: number;
    source: AdventureSkillSourceId;
    stages: AdventureSkillStage[];
};

export function buildAdventureSkill(
    id: string,
    name: string,
    source: AdventureSkillSourceId,
    statements: string[][],
    sharedCompetencies: Record<string, string> = {}
): AdventureSkill {
    return {
        id,
        name,
        maxStage: statements.length,
        source,
        stages: statements.map((stageStatements, stageIndex) => ({
            stage: stageIndex + 1,
            requirements: stageStatements.map((statement, requirementIndex) => {
                const requirementId = `${id}-stage-${stageIndex + 1}-requirement-${String(requirementIndex + 1).padStart(2, "0")}`;
                const sharedCompetencyKey = sharedCompetencies[requirementId];
                return {
                    id: requirementId,
                    statement,
                    ...(sharedCompetencyKey ? { sharedCompetencyKey } : {})
                };
            })
        }))
    };
}

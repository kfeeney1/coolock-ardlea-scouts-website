import { AirActivitiesAdventureSkill } from "./air-activities.ts";
import { BackwoodsAdventureSkill } from "./backwoods.ts";
import { CampingAdventureSkill } from "./camping.ts";
import { EmergenciesAdventureSkill } from "./emergencies.ts";
import { HillwalkingAdventureSkill } from "./hillwalking.ts";
import { PaddlingAdventureSkill } from "./paddling.ts";
import { PioneeringAdventureSkill } from "./pioneering.ts";
import { RowingAdventureSkill } from "./rowing.ts";
import { sailing } from "./sailing.ts";
import { swimming } from "./swimming.ts";
import type { AdventureSkill, AdventureSkillRequirement } from "./types.ts";

export const adventureSkills: AdventureSkill[] = [
    CampingAdventureSkill,
    BackwoodsAdventureSkill,
    PioneeringAdventureSkill,
    EmergenciesAdventureSkill,
    HillwalkingAdventureSkill,
    AirActivitiesAdventureSkill,
    PaddlingAdventureSkill,
    RowingAdventureSkill,
    sailing,
    swimming
];

export const adventureSkillsById = new Map(adventureSkills.map((skill) => [skill.id, skill]));

export function allAdventureSkillRequirements(): AdventureSkillRequirement[] {
    return adventureSkills.flatMap((skill) => skill.stages.flatMap((stage) => stage.requirements));
}

export function requirementsForSharedCompetency(sharedCompetencyKey: string): AdventureSkillRequirement[] {
    return allAdventureSkillRequirements().filter((requirement) => requirement.sharedCompetencyKey === sharedCompetencyKey);
}

export * from "./types.ts";

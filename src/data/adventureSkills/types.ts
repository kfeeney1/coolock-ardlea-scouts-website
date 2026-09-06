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

// Canonical wording corrections are keyed by stable requirement ID so handbook
// transcription clean-up never changes stage ordering, IDs or saved progress.
const statementCorrections: Record<string, string> = {
    "backwoods-stage-2-requirement-01": "I know how to cook some food using tin foil instead of pots and pans.",
    "backwoods-stage-2-requirement-06": "I know about food hygiene in the outdoors.",
    "backwoods-stage-3-requirement-06": "I know about food storage.",
    "backwoods-stage-4-requirement-03": "I know how to prepare a fireplace and light and maintain a fire using minimum resources.",
    "backwoods-stage-6-requirement-07": "I have led at least one backwoods activity.",
    "backwoods-stage-9-requirement-02": "I have participated in a survival activity outside my usual Scouting environment.",
    "camping-stage-1-requirement-04": "I know how to set out my sleeping area for a good night’s sleep.",
    "camping-stage-1-requirement-09": "I know the different emergency services that are available and how and when to call them.",
    "camping-stage-3-requirement-03": "I can help make a hot drink using a fire.",
    "camping-stage-5-requirement-17": "I have spent at least one night lightweight camping.",
    "camping-stage-6-requirement-02": "I can source local knowledge regarding a campsite and the surrounding area.",
    "camping-stage-6-requirement-04": "I know the causes of and how to recognise and treat hypothermia, hyperthermia, sunstroke, dehydration and asthma, or any medical conditions relevant to my team.",
    "camping-stage-9-requirement-03": "I can plan and execute camps and expeditions in all types of locations — at home or abroad.",
    "camping-stage-9-requirement-06": "I have organised and led at least one camp for my team.",
    "emergencies-stage-1-requirement-01": "I know what should be in my personal first aid kit.",
    "emergencies-stage-1-requirement-02": "I know the basic rules of first aid.",
    "emergencies-stage-2-requirement-01": "I have made my own first aid kit and I know how and when to use it.",
    "emergencies-stage-3-requirement-05": "I know how to check the ABCs of basic first aid.",
    "emergencies-stage-4-requirement-01": "I know what should be in our team first aid kit and how to use it correctly.",
    "emergencies-stage-6-requirement-06": "I know how to look for, monitor and record vital signs.",
    "emergencies-stage-6-requirement-07": "I know the causes of and how to recognise and treat hypothermia, hyperthermia, sunstroke, dehydration and asthma.",
    "emergencies-stage-6-requirement-10": "I am competent in basic first aid, able to deal with emergencies, and I know when further expert help is needed.",
    "emergencies-stage-7-requirement-01": "I hold a first aid certificate to REC 3 or equivalent level (Red Cross, Order of Malta or St John Ambulance).",
    "emergencies-stage-7-requirement-02": "I can deal with emergency situations and follow best practice for first aid.",
    "emergencies-stage-7-requirement-05": "I know what specialised equipment I should have in my first aid kit and how to use and care for it.",
    "emergencies-stage-8-requirement-05": "I have acted as a first aider on at least one annual expedition of five nights’ duration.",
    "emergencies-stage-9-requirement-01": "I know how to deal with region-specific illnesses depending on my location or the location I am travelling to.",
    "emergencies-stage-9-requirement-07": "I hold a first aid certificate at REC level 4 or equivalent.",
    "hillwalking-stage-2-requirement-06": "I can be a responsible member of my team while we are hiking.",
    "hillwalking-stage-6-requirement-01": "I know the causes of and how to recognise and treat hypothermia, hyperthermia, sunstroke, dehydration and asthma, or anything medically relevant to my team.",
    "hillwalking-stage-7-requirement-01": "I can organise the transport required for an activity.",
    "hillwalking-stage-8-requirement-05": "I can lead a hiking adventure.",
    "pioneering-stage-3-requirement-01": "I know what equipment I need for making various pioneering gadgets.",
    "pioneering-stage-3-requirement-03": "I know about the safety precautions that are needed when pioneering.",
    "pioneering-stage-4-requirement-01": "I know the correct use, care and storage of the tools we use in pioneering.",
    "pioneering-stage-4-requirement-03": "I know how to take care of all kinds of rope.",
    "pioneering-stage-4-requirement-10": "I have built gadgets on camp and assisted my team in building a tower or a bridge.",
    "pioneering-stage-8-requirement-01": "I have led the construction of at least two large-scale pioneering structures and managed them safely.",
    "pioneering-stage-9-requirement-04": "I can be responsible for ensuring large-scale projects happen safely and that those participating are learning the skills required.",
    "paddling-stage-1-requirement-04": "I understand why I should follow directions from an instructor.",
    "paddling-stage-1-requirement-05": "I can show the limits of where I may go each time I go afloat for paddling.",
    "paddling-stage-1-requirement-06": "I know about the Buddy System.",
    "paddling-stage-1-requirement-08": "I know not to go afloat if the wind is greater than Force 4.",
    "paddling-stage-2-requirement-11": "I have taken part in at least two activities afloat.",
    "paddling-stage-3-requirement-05": "I know what to do in the case of a capsize or raft breakup and the procedures to follow.",
    "paddling-stage-3-requirement-11": "I have taken part in making a simple raft for four people.",
    "paddling-stage-4-requirement-06": "I can demonstrate how to whip a rope’s end and then show how to coil the rope.",
    "paddling-stage-4-requirement-08": "I can demonstrate throwing a throw line to a casualty, preparing the rope for the throw and instructing the casualty to use the rope. I can heave the casualty to shore. This can be demonstrated in open water or a swimming pool.",
    "paddling-stage-8-requirement-04": "I can negotiate bends where water flows under trees or against a vertical riverbank.",
    "paddling-stage-8-requirement-07": "I can demonstrate that I am capable of self-rescue.",
    "paddling-stage-8-requirement-09": "I can assist an unconscious casualty (method of righting an unconscious person in a capsized kayak).",
    "paddling-stage-8-requirement-10": "I can manoeuvre an empty kayak between two specified points.",
    "paddling-stage-8-requirement-11": "I can assist an incapacitated paddler in a kayak between two specified points.",
    "rowing-stage-1-requirement-02": "I know about the Buddy System.",
    "rowing-stage-1-requirement-10": "I know not to go afloat if the wind is greater than Force 4.",
    "rowing-stage-1-requirement-12": "I have taken part in two half-day exercises afloat consisting of a minimum of two hours afloat.",
    "rowing-stage-3-requirement-11": "I have taken part in three full-day exercises afloat consisting of a minimum of four hours afloat.",
    "rowing-stage-4-requirement-03": "I know that there are different types of personal flotation device and know when and where each should be used.",
    "rowing-stage-4-requirement-05": "I can demonstrate how to manoeuvre a boat as a member of the crew in a rowing boat.",
    "sailing-stage-1-requirement-02": "I know about the Buddy System.",
    "sailing-stage-4-requirement-11": "I can describe how often high and low tides take place, and the implications these might have when going afloat.",
    "air-activities-stage-1-requirement-03": "I can build a paper aeroplane from an A4 sheet that will fly, climb and turn.",
    "air-activities-stage-2-requirement-02": "I can show my Scouter the five main parts of an aeroplane (cabin, wing, tail, wheels and engine).",
    "air-activities-stage-2-requirement-07": "I can build a kite and fly it.",
    "air-activities-stage-3-requirement-03": "I know the main parts of an aeroplane.",
    "air-activities-stage-3-requirement-04": "I know the rules of safety around an aeroplane.",
    "air-activities-stage-3-requirement-08": "I know the main points of ‘Leave No Trace’ and why it is important at airports.",
    "air-activities-stage-3-requirement-10": "I can discuss with my Scouter how hot-air balloons work and how they are controlled.",
    "air-activities-stage-4-requirement-03": "I can discuss lift, drag, gravity and thrust with my Scouter.",
    "air-activities-stage-4-requirement-05": "Using a model, I can explain how an aeroplane climbs, dives and turns.",
    "air-activities-stage-5-requirement-12": "I can build and launch a water rocket.",
    "air-activities-stage-8-requirement-10": "I have taken part in two air activities that got me airborne.",
    "air-activities-stage-9-requirement-04": "I know how the constellation of satellites works to provide GPS navigation.",
    "air-activities-stage-9-requirement-06": "I have an understanding of radar and how ATC uses it."
};

// Only equivalent outcomes at the same proficiency level are linked. Broader or
// more advanced statements remain independent so completion is never over-awarded.
const canonicalSharedCompetencies: Record<string, string> = {
    "emergencies-stage-1-requirement-04": "buddy-system",
    "camping-stage-2-requirement-09": "follow-instructor-directions",
    "emergencies-stage-2-requirement-05": "follow-instructor-directions",
    "hillwalking-stage-1-requirement-10": "follow-instructor-directions",
    "pioneering-stage-1-requirement-05": "follow-instructor-directions",
    "paddling-stage-1-requirement-04": "follow-instructor-directions",
    "rowing-stage-1-requirement-09": "follow-instructor-directions",
    "sailing-stage-1-requirement-10": "follow-instructor-directions",
    "camping-stage-1-requirement-09": "emergency-services-full",
    "emergencies-stage-1-requirement-03": "emergency-services-full",
    "hillwalking-stage-4-requirement-05": "emergency-services-full",
    "pioneering-stage-1-requirement-04": "emergency-services-full",
    "paddling-stage-1-requirement-09": "contact-emergency-services",
    "rowing-stage-1-requirement-07": "contact-emergency-services",
    "sailing-stage-1-requirement-08": "contact-emergency-services",
    "camping-stage-3-requirement-09": "leave-no-trace-main-principles",
    "backwoods-stage-3-requirement-03": "leave-no-trace-main-principles",
    "hillwalking-stage-3-requirement-03": "leave-no-trace-main-principles",
    "pioneering-stage-3-requirement-04": "leave-no-trace-main-principles",
    "paddling-stage-4-requirement-04": "leave-no-trace-main-principles",
    "rowing-stage-4-requirement-02": "leave-no-trace-main-principles",
    "sailing-stage-4-requirement-02": "leave-no-trace-main-principles",
    "paddling-stage-2-requirement-10": "hypothermia-awareness",
    "rowing-stage-2-requirement-08": "hypothermia-awareness",
    "sailing-stage-2-requirement-09": "hypothermia-awareness",
    "paddling-stage-3-requirement-03": "cpr-and-recovery-position",
    "rowing-stage-3-requirement-08": "cpr-and-recovery-position",
    "sailing-stage-3-requirement-08": "cpr-and-recovery-position",
    "paddling-stage-4-requirement-03": "water-activity-safety-precautions",
    "rowing-stage-4-requirement-09": "water-activity-safety-precautions",
    "sailing-stage-4-requirement-09": "water-activity-safety-precautions",
    "paddling-stage-4-requirement-07": "beaufort-scale-force-6",
    "rowing-stage-4-requirement-10": "beaufort-scale-force-6"
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
                const sharedCompetencyKey = sharedCompetencies[requirementId] ?? canonicalSharedCompetencies[requirementId];
                return {
                    id: requirementId,
                    statement: statementCorrections[requirementId] ?? statement,
                    ...(sharedCompetencyKey ? { sharedCompetencyKey } : {})
                };
            })
        }))
    };
}

import { buildAdventureSkill } from "./types.ts";

const statements: string[][] = [
  [
    "I can assist in the launching of a small punt.",
    "I know about the buddy system.",
    "I know the importance of a Personal Flotation Device.",
    "I know the correct clothing to wear when going afloat.",
    "I can row a small punt.",
    "I can point out the bow, stern, transom, port and starboard of a boat.",
    "I know how to contact the emergency services.",
    "I know why it is important to stay with a capsized boat.",
    "I know why I should follow directions from my instructor.",
    "I know not go afloat if the wind is greater than Force 4.",
    "I can show the limits of where I may go each time I go afloat.",
    "I have taken part in two half-day exercises afloat consisting of at minimum of two hours afloat"
  ],
  [
    "I can assist in the launch and recovery of a small punt.",
    "I can explain what impact I may have on local vegetation when launching and retrieving a punt.",
    "I have discussed “Weil’s disease” and the precautions necessary to take part in open water activities.",
    "I can put on my own Personal Floatation Device and adjust it properly.",
    "I know why I should wear suitable footwear.",
    "I can make a recognised distress signal.",
    "I know how to raise the alarm if I see somebody in difficulty on the water.",
    "I know what hypothermia is.",
    "I know that I should keep clear of channels and fairways.",
    "I can get a weather forecast.",
    "I can tie the following knots; round-turn-and- two-half-hitches, figure of eight, bowline.",
    "I have taken part in four half-day exercises afloat consisting of a minimum of two hours afloat."
  ],
  [
    "I can take a leading part in the launch and recovery of a small rowing punt.",
    "I know why wearing layers of clothing is a good idea.",
    "I can embark, manoeuvre and disembark from a rowing punt safely.",
    "I can point out the main parts of a boat.",
    "I can use a small anchor from a punt.",
    "I can get into the water from a punt in a safe way.",
    "I can help to right a capsized rowing punt.",
    "I know how to do CPR and place the casualty in the recovery position.",
    "I know that I should follow the instructions of the person in charge of the boat.",
    "I understand the terms used in a maritime weather forecast.",
    "I have taken part in three full day exercises afloat consisting of a minimum of 4 hours afloat"
  ],
  [
    "I can assist in the launch and recovery of a rowing boat.",
    "I know the main principles of “Leave No Trace”.",
    "I know that there are different types of Personal. Flotation Device and know when and where each should be used.",
    "I can explain why wearing the correct outerwear is important.",
    "I can demonstrate how to manoeuvres a boat as a member of the crew in a rowing boat.",
    "I can pick up a mooring from a punt.",
    "I can help another person safely into a punt from the water.",
    "I can coil a line and heave it to a casualty to affect a simulated rescue.",
    "I know the safety precautions required for water based activities.",
    "I know the Beaufort wind scale up to Force 6.",
    "I can describe how often high and low tides take place, and the implications these might have when going afloat.",
    "I know that where I may go boating may change in different conditions.",
    "I have taken part in six full-day exercises afloat consisting of a minimum of 4 hours afloat."
  ],
  [
    "I know the standard rowing commands used in my group and can use them to helm a rowing boat on a straight course.",
    "I can take a leading role in mooring and unmooring a rowing boat.",
    "I can assist in the anchoring of a rowing boat.",
    "I can identify and name the main parts of common anchor types.",
    "I know why it is important to have some training in first aid and can show how to care for someone who is very cold.",
    "I know the parts of the International Regulations for the Prevention of Collisions at Sea which apply to my boat and local boating waters.",
    "I can obtain a weather forecast and know how the information might affect planned activities afloat.",
    "I know how currents and the ebb and flow of the tide affect my local boating waters.",
    "I know how to use Channel 16 on marine VHF and have an understanding of the use of distress flares.",
    "I have taken part in six full-day exercises afloat.",
    "I have taken part in one expedition afloat."
  ],
  [
    "I can take a leading part in the launch and recovery of a rowing boat.",
    "I can carry out the routine inspection of a Personal Flotation Device.",
    "I can take the helm of a rowing boat and carry out the required manoeuvres including steering with a compass.",
    "I can take a leading part in anchoring a rowing boat including knowing how and when to use a tripping line.",
    "I have taken part in Man-Over-Board exercises.",
    "I know what causes tides and how spring and neap tides might affect sailors.",
    "I can recognise the main weather patterns illustrated by a synoptic chart and can interpret the forecast.",
    "I can identify common weather conditions and describe how they may affect boating activities.",
    "I am familiar with the main features of restricted waters as defined for my group.",
    "I know how and when to make distress and urgency calls and ‘Safety Announcements’ on Marine VHF.",
    "I have taken part in eight full-day exercises afloat.",
    "I have taken part in one expedition afloat",
    "I have instructed at least four people in four of the areas up to Stage 3."
  ],
  [
    "I can take a leading part in the manual handling of a rowing boat ashore ensuring safe handling procedures.",
    "I can take a leading part in preparing a rowing boat for safe transportation by road including identifying a suitable trailer/vehicle and secure the boat safely.",
    "I know under which circumstances different Personal Flotation Devices are appropriate.",
    "I can take charge of a rowing boat and carry out the required manoeuvres, including towing, to a high standard.",
    "I can take a leading part in selecting a good anchorage.",
    "I can take charge of a boat and respond efficiently to a (simulated) emergency.",
    "I know what lights should be shown by the most common vessels in my area and know what lights should be shown by a rowing boat.",
    "I know the International regulations for the Prevention of Collisions at Sea.",
    "I can interpret the current forecast and make sound decisions on planned activities in view of expected weather and sea conditions and tidal effects.",
    "I know the hazards and how the weather may affect “Restricted Waters” for my group.",
    "I know how to get suitable information for “Safe Enclosed” boating waters that are not my groups local waters (e.g. For camp).",
    "I can assist in developing a passage plan for a day trip.",
    "I know how to read and set a chart, plot and estimate positions.",
    "I have a working knowledge of GMDSS (Global Maritime Distress Safety Systems) as it applies to EPIRBs (Emergency Position-Indicating Radio Beacons ) and DSC (Digital Selective Calling).",
    "I have taken part in ten full-day exercises afloat.",
    "I have taken part in one overnight expedition afloat outside my normal boating waters.",
    "I have instructed at least four people in at least six of the areas up to Stage 5."
  ],
  [
    "I can take a leading part in organising the off-season storage of rowing boats.",
    "I understand the different safety precautions that must be taken when a group of boats is operating together.",
    "I have a good understanding of the merits of different anchor types for different locations and conditions .",
    "I know what sound signals the most common types of vessel in my area should make.",
    "I have researched at least five pieces of weather lore.",
    "I am familiar with ‘Day Cruising Waters’ for my group",
    "I can use the information from a charts etc., to plan an expedition in restricted waters.",
    "I have an understanding of the ‘capture effect’ as it applies to marine VHF.",
    "I have taken part in ten full-day exercises afloat.",
    "I have taken part in one overnight expedition involving more than one boat.",
    "I have instructed at least four people in at least seven of the areas up to Stage 7."
  ],
  [
    "I can anchor a boat efficiently to two anchors.",
    "I can improvise and deploy a sea-anchor and know what spares and tools should be carried aboard.",
    "I have completed the requirement for the Emergencies Skills Stage 7",
    "I know how to interact with the emergency services.",
    "I can identify the type aspect and behaviour of vessels by day or night from lights, shapes and sounds.",
    "I know the procedure for entry to and departure from a harbour and understand the requirement to file a passage plan under SOLAS regulations.",
    "I can complete a rough synoptic chart from a maritime weather forecast or similar data and use this information to make sound decisions on planned activities in view of expected weather and sea conditions.",
    "I am familiar with any local rules and bylaws that apply to Day Cruising Waters for my group.",
    "I can devise a pilot/passage plan and programme that plan into a GPS .",
    "I have taken part in ten full-day exercises afloat.",
    "I have taken part in an overnight expedition in coastal waters.",
    "I have instructed at least four people in at least five of the areas up to Stage 8."
  ]
];

const sharedCompetencies: Record<string, string> = {
  "rowing-stage-1-requirement-02": "buddy-system"
};

export const RowingAdventureSkill = buildAdventureSkill("rowing", "Rowing", "adventure-skills-handbook-2010", statements, sharedCompetencies);

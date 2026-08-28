import { buildAdventureSkill } from "./types.ts";

const statements: string[][] = [
  [
    "I can pack my rucksack for a day hike.",
    "I know what to wear and what extras I need to bring on a hike.",
    "I know what food to bring on a hike.",
    "I know how to behave safely while hiking.",
    "I can read a simple map.",
    "I can point out and name the main features of a map.",
    "I can be responsible for myself while we are hiking.",
    "I can recognise the main distress signals.",
    "I know about the Buddy system.",
    "I understand why I should follow directions from an instructor.",
    "I have attended at least two hikes."
  ],
  [
    "I know what gear I need depending on the weather.",
    "I know why you bring certain foods and drinks on hikes.",
    "I can point out the main parts of the compass.",
    "I know how to get help if someone is hurt.",
    "I can point out the different symbols and colours on a map and I know what they mean.",
    "I can be responsible member of my team while we are hiking.",
    "I can get a weather forecast.",
    "I have attended at least three hikes."
  ],
  [
    "I know how to treat simple cuts and scratches.",
    "I know why you bring certain clothing on hikes.",
    "I know the main principles of “Leave No Trace”.",
    "I know how to cross boggy ground.",
    "I know how and when to use the main distress signals.",
    "I can use a compass to find direction.",
    "I can point out the features of a map.",
    "I can be responsible for myself and aware of my surroundings while hiking.",
    "I can follow a route on an orienteering map.",
    "I have attended at least three hiking activities and been on the top of a mountain."
  ],
  [
    "I know how to pack a rucksack for weekend hikes.",
    "I can care for all my personal hiking equipment.",
    "I know what team equipment to bring and why.",
    "I know how to treat simple sprains and blisters.",
    "I know the different emergency services that are available and how and when to call them.",
    "I can follow our route on a map and find the main points using a compass.",
    "I can be responsible for younger members of my team while we are hiking.",
    "I have led a leg of a hike.",
    "I have attended three hikes including an overnight."
  ],
  [
    "I know the potential dangers of weather on hikes.",
    "I know how to pack a rucksack for a hillwalking expedition.",
    "I know when to cross a river and some different methods for crossing.",
    "I know all about the “Leave No Trace” principles.",
    "I know the main principles of navigating using a map and compass.",
    "I can complete and use a route card.",
    "I can be an active member of my team while hiking.",
    "I have taken part in three hikes.",
    "I have taken part in a two night hike in the mountains, based out of one campsite.",
    "I have written a log for at least two of these activities."
  ],
  [
    "I know the causes of how to recognize and treat hypothermia, hyperthermia, sunstroke, dehydration and asthma, or anything medical relevant to my team.",
    "I know the limitations of my team.",
    "I know the limitations of the compass and other navigation tools.",
    "I can use a compass and map to find my position.",
    "I know what Group emergency equipment we should carry, and how to use it.",
    "I can be responsible for myself and my team while hiking.",
    "I can plan and lead a hike.",
    "I have taken part in at least six hiking activities, four of which should be over 800m.",
    "I have taken part in a two night hike in the mountains, including a low and high camp.",
    "I have written logs for all of these activities."
  ],
  [
    "I can organise the transport required for an activity",
    "I can budget for team hikes.",
    "I know how to assess risk and be aware of group safety.",
    "I know how to deal with mountain hazards.",
    "I can plan escape routes.",
    "I can navigate at night, in poor visibility, and do micro-navigation.",
    "I have planned and led one hike without a Scouter.",
    "I have participated in at least five hikes between 800m and 1,300m and one over 1,300m.",
    "I have taken part in an unaccompanied but supervised two night hike in the mountains including a low and high camp.",
    "I have written logs for all of these activities.",
    "I have a logbook detailing at least 30 hikes and expeditions that I have undertaken."
  ],
  [
    "I have an outdoor First Aid certificate.",
    "I know how to safeguard others on steep ground.",
    "I know how to use a rope on difficult terrain.",
    "I can set up a simple belay.",
    "I can lead a hiking adventure .",
    "I know the procedure to be followed in the event of an accident.",
    "I have taken part in at least six hillwalking adventures over 1000m and one over 2250m.",
    "I can take responsibility for our Group on a hiking adventure.",
    "I have taken part in an unaccompanied but supervised two night hike in the mountains outside the island of Ireland.",
    "I have written logs for all of these activities."
  ],
  [
    "I know what equipment is required for various types of hillwalking expeditions, and the correct use and care of this equipment.",
    "I can navigate accurately and safely over the Irish mountains in any type of weather, and at night.",
    "I can assess risk and take appropriate action to ensure safety.",
    "I can practice basic winter mountaineering skills.",
    "I can create an exciting expedition while catering for everyone’s needs.",
    "I can budget, prepare and manage every aspect of the expedition.",
    "I have a logbook detailing at least 20 hikes and expeditions that I have undertaken since stage 7.",
    "I have taken part in an expedition to 3250m.",
    "I can be responsible for others in various situations on the mountains."
  ]
];

const sharedCompetencies: Record<string, string> = {
  "hillwalking-stage-1-requirement-09": "buddy-system"
};

export const HillwalkingAdventureSkill = buildAdventureSkill("hillwalking", "Hillwalking", "adventure-skills-handbook-2010", statements, sharedCompetencies);

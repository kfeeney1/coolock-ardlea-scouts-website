import { buildAdventureSkill } from "./types.ts";

const statements: string[][] = [
  [
    "I know what kinds of clothes to wear when going out into nature.",
    "I know how to prepare food for cooking.",
    "I know what a basic survival kit should contain.",
    "I know how to behave safely around fires.",
    "I know how to use hand tools safely.",
    "I can build a simple shelter.",
    "I have participated in at least two backwoods activities."
  ],
  [
    "I know how cook some food using tin foil instead of pots and pans.",
    "I know the important things to remember when building a simple shelter using plastic sheeting.",
    "I know how to treat simple cuts and scratches in a hygienic way.",
    "I know how to set up a fireplace and assist in fire lighting.",
    "I can prepare and cook food properly in backwoods conditions.",
    "I know about food hygiene in the outdoors",
    "I can use hand tools correctly.",
    "I have attended at least an additional two backwoods activities."
  ],
  [
    "I know how different weather conditions can affect a backwoods activity.",
    "I know how to get help when someone is in trouble.",
    "I know the main principles of “Leave No Trace”.",
    "I can build a shelter for six people.",
    "I can use camp tools safely on camp.",
    "I know about food storage",
    "I can light a fire using natural tinder, fuzz sticks and matches.",
    "I can make a simple fish hook.",
    "I can prepare my own survival kit.",
    "I can teach another Scout about preparing a survival kit.",
    "I have attended at least an additional three backwoods activities."
  ],
  [
    "I know what equipment I need to bring with me on a backwoods activity.",
    "I know how to set up a tarp bivvy shelter suitable for two people.",
    "I know how to prepare a fire place and light and maintain a fire using minimum resources.",
    "I can make simple containers using natural materials.",
    "I know how to treat cuts and minor burns.",
    "I can make camp bread such as twists and scones.",
    "I know about nature and what you are likely to see and experience as part of a backwoods activity.",
    "I can find directions by using star constellations and the sun/watch method.",
    "I have attended at least one backwoods based overnight activity."
  ],
  [
    "I know how to use and care for tools of all kinds safely.",
    "I know how to build a backwoods shelter using natural materials and how to return this material to nature.",
    "I know how to cook a variety of foods using different backwoods methods.",
    "I know the safety considerations that are necessary before embarking on any activity or adventure.",
    "I can make a length of cordage using naturally found fibres.",
    "I can light a fire using flint and steel.",
    "I can make myself comfortable on an overnight backwoods adventure using available natural materials.",
    "I can carve a wooden spoon from a piece of wood.",
    "I have attended backwoods based activities lasting at least two nights."
  ],
  [
    "I know what Team and personal equipment is necessary for a successful backwoods activity.",
    "I know all of the elements of the “Leave no Trace” programme.",
    "I can identify edible fruits and berries that are found in nature.",
    "I can prepare the foods I find in nature for cooking.",
    "I can find my way using natural direction indicators.",
    "I can catch and prepare a fish for cooking.",
    "I have led at least one backwoods activity ."
  ],
  [
    "I know a number of ways of constructing shelters and bivvys.",
    "I know the likely hazards that may be present in woodland and open countryside.",
    "I know how to light and maintain a fire using friction methods.",
    "I know how to live in the countryside without disturbing the balance of nature in any way.",
    "I know how to make utensils by carving and by other methods.",
    "I can cook a meal without using common utensils.",
    "I have led at least one overnight backwoods or survival based activity."
  ],
  [
    "I know a number of ways of constructing shelters capable of being used for a number of nights.",
    "I know how to prepare, cook and store food in backwoods conditions.",
    "I know the different edible foods that can be eaten safely in the wilds.",
    "I hold a first aid certificate (outdoor) or equivalent REC 3.",
    "I know how to make a variety of tools, and useful gadgets to survive in nature over a period of time.",
    "I can live comfortably in a number of different natural situations, with minimal equipment.",
    "I have led at least three backwoods adventures.",
    "I have participated in a survival weekend activity."
  ],
  [
    "I have run at least two backwoods skills training sessions for my Scout Group/County.",
    "I have participated in a survival activity outside my usual Scouting environment.."
  ]
];

export const BackwoodsAdventureSkill = buildAdventureSkill("backwoods", "Backwoods", "adventure-skills-handbook-2010", statements);

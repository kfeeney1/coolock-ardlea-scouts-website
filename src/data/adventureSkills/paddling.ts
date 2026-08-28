import { buildAdventureSkill } from "./types.ts";

const statements: string[][] = [
  [
    "I have discussed what a wet suit does.",
    "I know what a Buoyancy Aid and Life Jacket are for.",
    "I can show where the bow and stern are in a kayak or boat.",
    "I understand why I should follow directions from an instructor .",
    "I can show the limits of where I may go each time I go afloat for paddling",
    "I know about the ‘Buddy’ system.",
    "I know why I should care for my wet suit, buoyancy aid and ‘cag’ after use.",
    "I know not go afloat if the wind is greater than Force 4.",
    "I know how to contact the emergency services.",
    "I have taken part in a short exercise afloat."
  ],
  [
    "I can explain what special clothing is to be worn while taking part in a water based activity.",
    "I can put on my own personal floatation device properly.",
    "Before I launch my boat, I can show where and when I am allowed to go.",
    "I have discussed ‘Weil’s’ disease and the precautions necessary to take in open water activities.",
    "I have drawn a poster demonstrating the safety rules for swimming.",
    "I have taken part in an activity on safe enclosed waters involving paddling a Canadian Canoe.",
    "I have discussed the appropriate action I should take in the case of a capsize.",
    "I have explained what impact I can have on local vegetation when launching and retrieving a boat.",
    "I know how to raise the alarm if I see somebody in difficulty on the water.",
    "I know what hypothermia is.",
    "I have taken part in an at least two activities afloat."
  ],
  [
    "I can explain the importance of wearing the right clothing and gear while afloat.",
    "I can show how to test a raft for secure construction.",
    "I know how to do CPR and place a victim in the recovery position.",
    "I know how to make use of a paddle while on a raft.",
    "I know what to do in the case of a capsize/ or raft breakup and the procedures to follow.",
    "I know how to tie and when to use the following knots; Round-turn-and-two-half-hitches, Figure of eight, Bowline, Reef Knot, Clove Hitch.",
    "I can tie a square lashing.",
    "I know how and where to get the latest weather forecast for the area I will be paddling in.",
    "I can make a recognised distress signal.",
    "I know that I should follow the instructions of the person in charge of the boat.",
    "I have taken part in making a simple raft for four people.."
  ],
  [
    "I can explain why wearing the correct outer wear is important.",
    "I can assist in the launch and recovery of a raft.",
    "I know the safety precautions required for water based activities.",
    "I know the main points of ‘Leave No Trace’.",
    "I can work as part of a team to paddle a raft on a triangular course.",
    "I can demonstrate how to whip a ropes end and then show how to coil the rope.",
    "I know the Beaufort wind scale up to Force 6.",
    "I can demonstrate throwing a Throw Line to a casualty, preparing the rope for the throw and instructing the casualty to use the rope. Heave the causality to shore. This can be demonstrated in open water or a swimming pool.",
    "I have taken part in and logged at least four rafting activities.",
    "I have taken part in three activities on safe enclosed waters involving paddling a Canadian Canoe."
  ],
  [
    "I know the difference between winter and summer kayaking.",
    "I can demonstrate an understanding of the basic safety rules of kayaking.",
    "I can demonstrate my ability to enter and exit a kayak correctly.",
    "I can demonstrate forward paddle, reverse paddle, and stop.",
    "I can show my ability to turn while stationary using forward sweep stroke, reverse sweep stroke and a combination of forward and reverse sweep strokes.",
    "I can demonstrate correctly and confidently the capsize drill.",
    "I can demonstrate how to take part in a kayak raft-up and explain its uses.",
    "I can demonstrate forward and reverse paddling in a kayak.",
    "I can demonstrate stopping in a kayak.",
    "I can demonstrate forward and reverse sweep stroke in a kayak."
  ],
  [
    "The Scout must demonstrate correctly the following new skills",
    "I can demonstrate an understanding of the basic safety rules of kayaking.",
    "Simple draw stroke, Low brace, Low brace Turn, Edging while the kayak is moving. Capsize drill.",
    "My ability to assist in a H rescue, and in an assisted X rescue."
  ],
  [
    "The Scout must demonstrate correctly the following new skills",
    "Forward ferry gliding, Reverse ferry gliding, Breaking in, Breaking out,",
    "(A) Eskimo rescue (B) Eskimo roll.",
    "I can demonstrate my understanding of the use of Defensive swimming.",
    "I can demonstrate my understanding of Eddies, Standing waves, V waves, Stoppers, and easy river routes i.e. the main flow down a Grade II rapid.",
    "I can demonstrate my understanding of good control (i.e. responding to various signals and commands)."
  ],
  [
    "I can demonstrate High recovery, Sculling for support, Sculling draw, Draw stroke, Hanging draw, strokes.",
    "I can use water conditions available for the effective and efficient manoeuvering of a kayak.",
    "I can competently negotiate water obstructions i.e. Standing Waves, Stoppers, and an ability to utilize it to cross a river.",
    "I can negotiating bends where water flows under trees or against vertical riverbank.",
    "I can demonstrate the following strokes Forward ferry gliding (facing upriver), Reverse ferry gliding (facing downriver).",
    "I can demonstrate Breaking in accurately, Breaking out accurately.",
    "I can demonstrate that I am capable of self- rescue.",
    "I can demonstrate a curl rescue and/or TX rescue, and Stern carry.",
    "I can assist an unconscious casualty (method of righting an unconscious person in a capsized kayak)",
    "I can manoeuvere an empty kayak between two specified points.",
    "I can assist an incapacitate paddler in a kayak between two specified points.",
    "I can demonstrate how to use a throw rope to rescue a swimmer and have a practical knowledge of First Aid.",
    "I know about river grading, river route finding, types of GP kayaks and paddles, towing systems and methods, group control and awareness, signals and commands, personal equipment."
  ],
  [
    "I can demonstrate all techniques and skills at a level higher than that required for the stage 4 and at a standard necessary to deal competently with conditions likely to be encountered on Grade 4 & advanced White Water Rivers.",
    "I can demonstrate a thorough knowledge of safety precautions and procedures to be adopted while with a group on Grade 4 & advanced White Water Rivers.",
    "I can demonstrate an ability to assess a group’s competence to deal with conditions likely to be encountered on Grade 4 & advanced White Water Rivers.",
    "I can demonstrate an ability to command trust from a group of peers while on rivers of Grade 4 & advanced white water.",
    "I can demonstrate the necessary skills to communicate effectively with other group members on Grade 4 & advanced White Water Rivers.",
    "I can deal efficiently with rescue situations likely to occur on Grade 4 & advanced White Water Rivers.",
    "I can demonstrate a constant awareness of other group members, their location on the river and within the group.",
    "I can demonstrate a sufficient knowledge of the river’s environs.",
    "I can demonstrate an ability to read white water to a high standard.",
    "I can present a suitable and correctly fitted out kayak and other appropriate equipment. It would be expected that a Scout’s equipment be of a standard consistent with the responsibilities of being part of a group undertaking a trip on a Grade 4 & advanced white water river."
  ]
];

const sharedCompetencies: Record<string, string> = {
  "paddling-stage-1-requirement-06": "buddy-system"
};

export const PaddlingAdventureSkill = buildAdventureSkill("paddling", "Paddling", "adventure-skills-handbook-2010", statements, sharedCompetencies);

import { buildAdventureSkill } from "./types.ts";

const statements: string[][] = [
  [
    "I know the main personal gear to bring on camp.",
    "I know how to care for my personal camping gear.",
    "I know what clothes I should bring on camp.",
    "I know how to set out my sleeping area for a good night‘s sleep.",
    "I can collect small sticks suitable for fire-making.",
    "I know about the Buddy System.",
    "I can pack my rucksack for camp.",
    "I can keep my camping gear neat and tidy while on camp.",
    "I know the different emergency services that are available and how and when to call them",
    "I know the main parts of a tent.",
    "I can help pitch a tent.",
    "I have spent at least one night on camp."
  ],
  [
    "I know about the food pyramid and can discuss it with a Scouter.",
    "I know about food hygiene.",
    "I can get a weather forecast.",
    "I can help prepare food for cooking on camp.",
    "I know how I would get help if someone is hurt.",
    "I know how to behave safely around fires.",
    "I can demonstrate my understanding of the fire triangle.",
    "I know how to be safe while cooking.",
    "I understand why I should follow directions from an instructor.",
    "I have spent at least two nights on camp (outside)."
  ],
  [
    "I know how to care for all my personal gear.",
    "I know about safe food storage.",
    "I can help make a hot drink using a fire .",
    "I can help clean up a fireplace after camp.",
    "I know how weather can affect our camp.",
    "I know why we bring certain gear on camp for our team.",
    "I can use camp tools safely on camp.",
    "I know how to clean and treat a small cut or scratch.",
    "I know and can discuss the main principles of “Leave No Trace”.",
    "I can show a younger member of my team how to pitch a tent with the help of others.",
    "I can assist in the cooking of a meal while on camp.",
    "I can help others to learn about camping.",
    "I have spent at least two consecutive nights on camp."
  ],
  [
    "I know what personal gear I should bring on a lightweight and standing camp.",
    "I can pack my rucksack properly for a lightweight camp.",
    "I know how to use our team gear correctly and safely.",
    "I know how to care for our team equipment during and in between camp.",
    "I know the best place to pitch our tent and I can explain why.",
    "I know how to use and store tools safely.",
    "I know what to do in the case of cuts and minor burns.",
    "I can be safe around fires and cooking equipment.",
    "I can be a constructive member of my team while on camp.",
    "I can assist in the pitching of a tent with my team.",
    "I have spent at least four nights on camp."
  ],
  [
    "I know what you need for building shelters and bivvys.",
    "I can explain how you choose the best type of tent for a specific camp.",
    "I know how to store and cook food safely on camp.",
    "I know what team equipment to bring on various types of camps.",
    "I can plan a balanced menu with my team for a camping adventure.",
    "I can select suitable locations for a standing or lightweight camp.",
    "I can show the best layout for a team campsite.",
    "I can use at least two different types of cooking fires and stoves.",
    "I can give a weather report to our Scouter for the duration of a camp.",
    "I can show the best location on camp for a chopping pit.",
    "I can show a younger Scout how to pitch a tent.",
    "I know how to pitch and set tents correctly for bad weather conditions.",
    "I understand the importance of proper waste management on camp.",
    "I can light and maintain a cooking fire.",
    "I know how to cook a good balanced meal on a fire.",
    "I have spent at least five consecutive nights on camp.",
    "I have spent at least one night, lightweight camping."
  ],
  [
    "I know how to plan the menu and purchase the food for a weekend camp.",
    "I can source local knowledge with regards to a campsite and surrounding area.",
    "I know how to plan a programme of activities for a camp.",
    "I know the causes and how to recognize and treat hypothermia, hyperthermia, sunstroke, dehydration and asthma, or any medical conditions relevant to my team.",
    "I can show how to care for, store and maintain all our team equipment.",
    "I can explain what group emergency equipment we should bring on camp and why.",
    "I can organise the pitching and striking of a team campsite.",
    "I know how to use a variety of stoves in outdoor conditions safely.",
    "I can talk to our team about the hazards involved in camping.",
    "I can pitch a tent that I am not familiar with.",
    "I have successfully camped in a variety of weather conditions.",
    "I have spent at least eight nights on camp including a week-long camp.",
    "I have spent at least two consecutive nights lightweight camping."
  ],
  [
    "I know how to select a suitable location for both standing and lightweight camps.",
    "I can plan and lead a team camp in a remote location for a minimum of two nights.",
    "I know how to organise the transport required for our camp.",
    "I know how to plan activities for various types of camps.",
    "I know how to make contingency plans for our camp.",
    "I can take responsibility for myself and my team while on camp.",
    "I can help those camping with my team to learn new skills.",
    "I have spent at least 12 nights on various types of camps, including at least two consecutive nights without a Scouter."
  ],
  [
    "I can prepare for a specialist expedition and have acquired the necessary skills.",
    "I can source, compare and organise various transport options for getting to local and foreign locations.",
    "I know how to create an exciting expedition while catering for everyone’s needs.",
    "I know how to be active in the out of doors, without disturbing the balance of nature.",
    "I have assisted in the organisation of at least two camps either for my Team, or another Team in my own Group or in another Group.",
    "I have spent at least 16 nights on various types of camps."
  ],
  [
    "I know how to budget, prepare and manage every aspect of the expedition.",
    "I know how to ensure that safety precautions are put in place, without curtailing the fun of our camp.",
    "I can plan and execute, camps and expeditions in all types of locations - at home or abroad.",
    "I know how to source amenities and local places of interest.",
    "I know how to use a variety of cooking stoves, and know when each type is most effective.",
    "I have organized and led at least one camp for my team.",
    "I have spent at least 20 nights on various types of camps."
  ]
];

const sharedCompetencies: Record<string, string> = {
  "camping-stage-1-requirement-06": "buddy-system"
};

export const CampingAdventureSkill = buildAdventureSkill("camping", "Camping", "adventure-skills-handbook-2010", statements, sharedCompetencies);

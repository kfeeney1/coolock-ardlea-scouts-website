import { buildAdventureSkill } from "./types.ts";

const statements: string[][] = [
  [
    "I know what should be in my personal First Aid Kit.",
    "I know the basic rules of First Aid.",
    "I know the different emergency services that are available and how and when to call them.",
    "I know how to use the “Buddy” system.",
    "I know how to treat minor cuts.",
    "I can get help and make a report properly if someone is hurt.",
    "I can be responsible for my own health and safety."
  ],
  [
    "I have made my own First Aid Kit and I know how and when to use it.",
    "I know how and when to place someone into the recovery (safe airway) position.",
    "I know the importance of providing shelter and insulation.",
    "I know how to use a Scout neckerchief as a makeshift bandage in an emergency.",
    "I understand why I should follow directions from an instructor.",
    "I know how to keep myself safe in an emergency.",
    "I can direct help/rescue services to a location."
  ],
  [
    "I know how to deal with a bleeding injury and nose bleeds.",
    "I know how to treat minor burns and sunburn.",
    "I know the international distress signal and when to use it.",
    "I can treat bee stings and nettle stings.",
    "I know how to check for the A B C of basic First Aid.",
    "I know how to use CPR.",
    "I can assess an emergency situation quickly, and summon help.",
    "I know how to create an escape plan for a building or activity location in case of fire.",
    "I know how to care for an injured person until help arrives."
  ],
  [
    "I know what should be in our Team First Aid Kit, and know how to use it correctly.",
    "I know how to move an injured person safely to shelter if appropriate or necessary.",
    "I know how to apply bandages for different types of injury.",
    "I know how to check if someone is choking and how to help them.",
    "I know how to clean dirt from an eye.",
    "I know how to recognise sprains, strains and fractures.",
    "I know how to deal with blisters.",
    "I know what actions to take with suspected poisoning.",
    "I can use various means to show the location of an accident to rescue services.",
    "I know how to build a stretcher from improvised materials."
  ],
  [
    "I know how to treat an eye injury.",
    "I know what to do and what not to do in the case of emergencies.",
    "I have acted as a Team First Aider on at least one activity.",
    "I know how to take care of and reassure a casualty.",
    "I know how to recognise and assist someone suffering from the effects of asthma, epilepsy and diabetes.",
    "I know how to deal with an accident in open countryside and how to summon help.",
    "I know how to treat a serious bleeding injury.",
    "I know how to escape to safety from various emergency situations.",
    "I know how and when to use flares and other long-distance signalling devices."
  ],
  [
    "I know how to recognise and treat shock.",
    "I know how and when to use an AED.",
    "I have acted as a Team First Aider on at least one outdoor activity.",
    "I know how to escort and assist a casualty, while they are being transported to safety.",
    "I know how and when to use different fire extinguishers.",
    "I know how to look for monitor and record vital signs.",
    "I know the causes of, how to recognize and to treat: hypothermia, hyperthermia, sunstroke, dehydration and asthma.",
    "I know how to recognise and deal with angina and heart attacks.",
    "I know how to record correctly everything that has happened at the scene of the accident.",
    "I am competent in basic first-aid, able to deal with emergencies, and I know when further expert help is needed."
  ],
  [
    "I hold a First Aid certificate to REC 3 or equivalent level (Red Cross, Order of Malta, and Saint Johns Ambulance).",
    "I can deal with emergency situations and follow best practice for First Aid.",
    "I have acted as Section First Aider on at least one occasion on an adventurous outdoor activity.",
    "I can analyse vital signs.",
    "I know what specialised equipment I should have in my First Aid Kit and how to use and care for it.",
    "I know how and when to call a medevac or other medical helicopters.",
    "I can use radio communications effectively in an emergency situation."
  ],
  [
    "I know how to treat specific injuries which may occur in my chosen area of interest.",
    "I can carry out a risk assessment for an activity and steer clear of dangers.",
    "I know how to deal with head, spine, chest, stomach, and pelvic injuries.",
    "I know how to educate others to the possible dangers that can be encountered and how to deal with them.",
    "I have acted as a First Aider on at least one annual expedition of five night’s duration."
  ],
  [
    "I know how to deal with regional specific illnesses depending on my location or the location I am travelling to.",
    "I know, understand and I am able to perform basic life support.",
    "I know how to assess and manage risk in various and constantly changing situations.",
    "I can constantly risk assess situations as they arise and take measures to limit injuries.",
    "I can give immediate treatment and deal with complicated emergency situations.",
    "I can assist a rescue team in moving a casualty to safety.",
    "I hold a First Aid Cert at REC level 4 or equivalent."
  ]
];

export const EmergenciesAdventureSkill = buildAdventureSkill("emergencies", "Emergencies", "adventure-skills-handbook-2010", statements);

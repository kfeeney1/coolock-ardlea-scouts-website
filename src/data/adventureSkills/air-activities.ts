import { buildAdventureSkill } from "./types.ts";

const statements: string[][] = [
  [
    "I can name all the things that I know can fly.",
    "I can show pictures of and be able to talk about different types of flying machines.",
    "I can build a paper aero plane from an A4 sheet that will fly, climb and turn.",
    "I can discuss the features of an airport from a model or picture (Runway, Terminal, Control Tower).",
    "I know how to be safe around aircraft.",
    "I have visited an airport."
  ],
  [
    "I can make a small parachute using a piece of light material and string.",
    "I can show my Scouter the five main parts of an aero plane (Cabin, Wing, Tail, Wheels, Engine).",
    "I can launch parachutes from a stand and see which parachute falls the slowest.",
    "I can discuss with my Scouter how the wind affects a parachute.",
    "I know what you should do if somebody gets hurt.",
    "I know the safe way to act at an airport and can discuss this with my Scouter.",
    "I can build a Kite and fly it.",
    "I know where it would be safe to fly a kite."
  ],
  [
    "I know the difference between airside and landside.",
    "I can discuss the first flight by the Wright Bros.",
    "I know the main parts of an aero plane.",
    "I know the rules of safety around an aero plane.",
    "I can discuss why communication is important to aircraft.",
    "I know the phonetic alphabet.",
    "I can name the planets in our Solar System.",
    "I know the main points of ‘Leave no Trace and why it’s important at airports.",
    "I have built a scale model aircraft to a satisfactory standard from a plastic kit and can explain its features and history.",
    "I can discuss with my Scouter- Hot Air balloons how hot air balloons work and how they are controlled."
  ],
  [
    "I know the rule relating to airfields.",
    "I understand how a wing derives lift.",
    "I can discuss with my Scouter Lift, Drag, Gravity and Thrust .",
    "I know the control surfaces of an aircraft.",
    "Using a model I can explain how an aero plane climbs, dives and turns.",
    "I can explain the causes of stalling.",
    "I know the logos of the various airlines.",
    "I can build a model Hot Air Balloon.",
    "I have produced a project based on the Moon Landings.",
    "I have taken part in a Water Rocket Launch."
  ],
  [
    "I understand what FOD is.",
    "I know how to approach an aircraft.",
    "I know the signs that an aircraft is about to start an engine.",
    "I know where the safe jet blast zones are on an aircraft.",
    "I know how to identify different aircraft types from their features.",
    "I understand how weather affects air activities.",
    "I can show a younger Scout how control surfaces work.",
    "I can build a scale model aircraft to a satisfactory standard from paper and balsa wood.",
    "Using a computer simulator, or other method, I can identify some aircraft instruments.",
    "Using a computer simulator, or other method, I can show how to take off and fly through various weather conditions and land safely.",
    "I can discuss with my Scouter how the Earth’s atmosphere affects air travel.",
    "I can build and launch a WaterRocket.",
    "I have taken part in at least two air activities."
  ],
  [
    "I can discuss aircraft navigation with my Scouter.",
    "I know the types of air maps and the conventional signs used on them.",
    "I can demonstrate how to obtain a local forecast for an air activity.",
    "I can explain how wind speed and direction are measured and how weather can affect various air activities.",
    "I can explain the difference between ground speed and air speed and how wind is used in takeoff and landing.",
    "I can discuss with my Scouter how the Earth’s atmosphere affects air travel.",
    "I can understand three different ways in which clouds are formed.",
    "I can show that I understand the basic ‘T’ instrument cluster.",
    "I can handle a powered model aircraft during take off and fly through various weather conditions and land safely.",
    "I can explain the workings of aircraft pressure instruments, for example an altimeter or air speed indicator.",
    "I can discuss how the Ionosphere affects communication.",
    "I can navigate my Patrol over a route using a GPS.",
    "I have attended an Air Display.",
    "I have participated in a themed ‘Space Camp’ or event with a group of Scouts."
  ],
  [
    "I know the basic principles of a piston engine, including the four-stroke cycle.",
    "I know how a jet engine works.",
    "I know how rocket engines work, and their lift-off and re-entry procedures.",
    "I know the Safety Code for Rocketry and am able to identify the principal parts of a rocket.",
    "I can build, launch, and recover a single or double-staged model rocket.",
    "I know how to arrange permissions for a rocket launch.",
    "I am able to fly a model aircraft.",
    "I can be responsible for planning a weekend camp for my Group at an airfield."
  ],
  [
    "I understand what a flight plan is.",
    "I can produce a flight plan for a cross country exercise.",
    "I know the main types of checklists commonly found in aircraft.",
    "I know how to correctly approach an occupied aircraft or helicopter.",
    "I have a thorough knowledge of the Rule Relating to Airfields.",
    "I understand the Irish Air Traffic Control system.",
    "I know how and when to use an air-band radio.",
    "I know how to marshal an aircraft.",
    "I have undertaken a project to demonstrate a particular aeronautical principle and build a suitable model to illustrate it.",
    "I have taken part in two air activities that got me airborne",
    "I have planned a weekend camp for my Section on an airfield."
  ],
  [
    "I know the principle of flight of a helicopter.",
    "I know how the controls of a helicopter work.",
    "I know the dangers regarding specific aerial activities.",
    "I know how the constellation of satellites work to provide GPS navigation.",
    "I understand how telemetry helps develop aviation products.",
    "Have an understanding of Radar and how ATC use it.",
    "I can arrange for a suitably experienced instructor to give an air experience flight.",
    "I have taken part in two additional air activities that got me airborne."
  ]
];

export const AirActivitiesAdventureSkill = buildAdventureSkill("air-activities", "Air Activities", "adventure-skills-handbook-2010", statements);

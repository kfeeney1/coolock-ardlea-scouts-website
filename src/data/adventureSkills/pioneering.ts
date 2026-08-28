import { buildAdventureSkill } from "./types.ts";

const statements: string[][] = [
  [
    "I know what equipment is needed for making pioneering gadgets.",
    "I know how to build a gadget using elastic band techniques.",
    "I can be responsible for myself while we are pioneering.",
    "I know the different emergency services that are available and how and when to call them.",
    "I understand why I should follow directions from an instructor.",
    "I have built at least two simple pioneering gadgets."
  ],
  [
    "I know how to get help if someone is hurt during a pioneering activity.",
    "I can tie the basic knots I need for pioneering.",
    "I can prepare ropes for use in pioneering.",
    "I can coil a rope.",
    "I can undertake tasks assigned to me while we are pioneering.",
    "I have made a knot board.",
    "I have built at least three simple pioneering gadgets using elastic band techniques."
  ],
  [
    "I know what equipment I need for making various pioneering gadgets",
    "I know how to treat basic cuts and scratches.",
    "I know about the safety precautions that are needed when pioneering",
    "I know the main principles of ‘Leave No Trace’.",
    "I have taught other Scouts how to tie some basic knots.",
    "I have built at least two gadgets using ropes and poles."
  ],
  [
    "I know the correct use, care, and storage of the tools we use in pioneering",
    "I know the different types of rope used in pioneering.",
    "I know how to take care of all kinds of rope",
    "I know how to tie the knots necessary for building pioneering structures safely.",
    "I know the safety precautions to be observed for the safe lifting of pioneering spars.",
    "I can use guy ropes to make pioneering gadgets stable.",
    "I know the basic components of pioneering structures and how to make them.",
    "I can tie the main lashings necessary to make most pioneering gadgets.",
    "I can be responsible for myself while pioneering.",
    "I have built gadgets on camp and assisted my ‘team’ in building a tower or a bridge"
  ],
  [
    "I know how to select suitable poles and spars for a pioneering project.",
    "I know how to treat cuts and sprains.",
    "I know what to do in case of an accident while pioneering and how to be safety conscious.",
    "I can help a younger Scout to build a pioneering gadget.",
    "I can set up a simple pulley system for lifting and tensioning ropes.",
    "I can coil, whip and splice a rope.",
    "I am aware of the building process/procedure while pioneering.",
    "I have taken part in the construction of at least two pioneering projects."
  ],
  [
    "I know how to plan and construct pioneering projects to be built by my team.",
    "I know how to reeve up, use and safely secure pulleys in pioneering projects.",
    "I can be responsible for my team while building pioneering projects.",
    "I know the correct lifting techniques for raising a tower or an A frame.",
    "I know the best types of anchorage to use for a pioneering project and can use them.",
    "I can lead the construction of an element of a large-scale pioneering structure.",
    "I have taught a younger Scout how to tie the lashings necessary for a pioneering project.",
    "I have taken part in the construction of at least two large-scale pioneering structures."
  ],
  [
    "I know how to inspect for damage, care for and store ropes, pulleys and poles.",
    "I know the importance of safety at all stages of construction, use and dismantling of a pioneering structure.",
    "I know how to plan and execute the build of a large-scale pioneering structure.",
    "I can check the safety of all knots and lashings used in a large-scale pioneering structure.",
    "I have led the construction of at least one large-scale pioneering structure."
  ],
  [
    "I have led the construction of a least two large- scale pioneering structures and managed them safely.",
    "I know how to set up and manage a belay on pioneering or climbing structures.",
    "I know how to use safety harnesses and securely tie off rock climbing harnesses.",
    "I know how to secure rope structures and high wire elements.",
    "I hold an outdoor First Aid certificate."
  ],
  [
    "I can design, plan and build large-scale pioneering structures.",
    "I know the importance of safety at all stages of construction, build, use and dismantling of a large-scale pioneering structure.",
    "I know how to control and supervise the construction of a large-scale pioneering structure and its use in programme.",
    "I can be responsible for ensuring large- scale projects happen safely, and that those participating are learning the skills required."
  ]
];

export const PioneeringAdventureSkill = buildAdventureSkill("pioneering", "Pioneering", "adventure-skills-handbook-2010", statements);

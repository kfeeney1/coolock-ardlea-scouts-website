import { buildAdventureSkill } from "./types.ts";

const stages = [
    [
        "Travel 5 metres on the front using a basic movement or stroke.",
        "Enter and exit shallow water safely.",
        "Demonstrate a safe and confident push and glide from the pool wall.",
        "Float on the back in a pool and demonstrate proper buoyancy while wearing a PFD.",
        "Explain the Buddy System and follow basic pool safety rules.",
        "Call for help and signal for assistance in an emergency.",
        "Recognise different types of water -pool, river, lake, sea - and identify at least one hazard for each."
    ],
    [
        "Swim 10 metres on the front using a recognised stroke.",
        "Swim 10 metres on the back in a controlled and relaxed manner.",
        "Turn from front to back while floating, without losing control or panicking.",
        "Tread water for 30 seconds while maintaining a safe body position.",
        "Throw a simple rescue aid e.g. ring buoy or rope to a person in difficulty.",
        "Identify lifeguard flags at the beach and explain their meaning.",
        "Explain how to keep safe at the water’s edge (pool, river, lake, or sea).",
        "Demonstrate the ‘Float like a Star’ technique for 60 seconds and explain when it should be used."
    ],
    [
        "Swim 25 metres on the front with controlled breathing and good body position.",
        "Swim 25 metres on the back at a steady pace using a consistent kick.",
        "Demonstrate a basic breaststroke over a short distance.",
        "Tread water for 1 minute while signalling for help.",
        "Explain the key safety differences between indoor and outdoor swimming.",
        "Inspect an unfamiliar swimming area and identify safe entry and exit points before swimming.",
        "Apply Leave No Trace principles to outdoor swimming activities.",
        "Explain the causes, signs, and basic treatment of hypothermia and afterdrop.",
        "Coil and store a safety rope ready for use.",
        "Recognise blue-green algae and understand what to do when water-quality warnings are in place."
    ],
    [
        "Swim 50 metres on the front using an efficient stroke.",
        "Swim 50 metres on the back at a steady and controlled pace.",
        "Swim 25 metres breaststroke with correct timing and coordination.",
        "Demonstrate the basic skills of snorkelling in a pool or confined water using a mask and snorkel (fins may also be used).",
        "Identify rip currents and explain how to spot them.",
        "Enter the water using a straddle jump safely and under control.",
        "Demonstrate CPR and the recovery position.",
        "Explain what clothing and equipment help protect against cold-water immersion.",
        "Explain how to reduce the risk of illness from contaminated water.",
        "Raise the alarm and recover a simulated casualty using a rope.",
        "Exit the pool without using the steps and assist another person to exit safely."
    ],
    [
        "Swim 100 metres continuously using a recognised stroke.",
        "Swim 50 metres breaststroke with an efficient glide.",
        "Tread water for 30 seconds while wearing light clothing, then remove the clothing and continue treading water for a further 90 seconds.",
        "Explain and demonstrate safe non-contact rescues.",
        "Throw a line accurately to a distance of 10 metres (at least 2 out of 3 attempts).",
        "Demonstrate the Talk–Reach–Throw–Row rescue sequence.",
        "Show familiarity with Scouting Ireland Safety Afloat guidelines.",
        "Explain the causes and treatment of cold water shock.",
        "Explain how to escape from a rip current."
    ],
    [
        "Swim 200 metres continuously using a recognised stroke.",
        "Swim 25 metres while wearing a long-sleeved top.",
        "Tread water for 2 minutes while wearing a top, then remove it, inflate it for flotation, and continue floating or treading water for a further 1 minute.",
        "Participate in a simulated rescue of a non-swimmer from 50 metres using a float or buoyant aid.",
        "Demonstrate defensive swimming and safe casualty control.",
        "Demonstrate the H.E.L.P. (Heat Escape Lessening Posture) and huddle survival positions.",
        "Complete a basic risk assessment for a swimming activity.",
        "Explain the effects of surface water temperature and wind chill.",
        "Assess weather, tides, and currents before an activity.",
        "Explain the dangers of floodwater.",
        "Take part in a supervised outdoor snorkelling activity using appropriate equipment.",
        "Use a tow-float and whistle for safety and signalling."
    ]
];

export const swimming = buildAdventureSkill(
    "swimming",
    "Swimming",
    "swimming-adventure-skill-2026-03",
    stages
);

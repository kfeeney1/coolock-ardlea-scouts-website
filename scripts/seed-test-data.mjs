import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const action = process.argv[2] || "seed";

if (!rawCredentials) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
}

if (!["seed", "cleanup"].includes(action)) {
  throw new Error("Usage: node scripts/seed-test-data.mjs seed|cleanup");
}

const credentials = JSON.parse(rawCredentials);
initializeApp({ credential: cert(credentials) });
const db = getFirestore();

const now = Timestamp.now();
const createdBy = "TEST_SEED";
const marker = {
  testData: true,
  testSeed: "stage8-role-demo",
  createdBySeed: createdBy
};

const roleProfiles = {
  leaderParent: {
    uid: "TEST_uid_leader_parent_01",
    email: "test.leader.parent@example.com",
    displayName: "Niamh Murphy",
    mobileNumber: "0872000001",
    section: "Beavers",
    memberIds: ["TEST_member_beaver_01", "TEST_member_beaver_02"]
  },
  parentOnly: {
    uid: "TEST_uid_parent_only_01",
    email: "test.parent.only@example.com",
    displayName: "Mark Byrne",
    mobileNumber: "0872000002",
    memberIds: ["TEST_member_cub_01", "TEST_member_cub_02"]
  },
  leaderOnly: {
    uid: "TEST_uid_leader_only_01",
    email: "test.leader.only@example.com",
    displayName: "Aisling Ryan",
    mobileNumber: "0872000003",
    section: "Scouts"
  }
};

const adminUsers = [
  {
    id: roleProfiles.leaderParent.uid,
    uid: roleProfiles.leaderParent.uid,
    email: roleProfiles.leaderParent.email,
    displayName: roleProfiles.leaderParent.displayName,
    mobileNumber: roleProfiles.leaderParent.mobileNumber,
    section: roleProfiles.leaderParent.section,
    role: "leader",
    active: true,
    testRoleType: "leader-parent"
  },
  {
    id: roleProfiles.leaderOnly.uid,
    uid: roleProfiles.leaderOnly.uid,
    email: roleProfiles.leaderOnly.email,
    displayName: roleProfiles.leaderOnly.displayName,
    mobileNumber: roleProfiles.leaderOnly.mobileNumber,
    section: roleProfiles.leaderOnly.section,
    role: "leader",
    active: true,
    testRoleType: "leader-only"
  }
];

const parentAccounts = [
  {
    id: roleProfiles.leaderParent.uid,
    uid: roleProfiles.leaderParent.uid,
    email: roleProfiles.leaderParent.email,
    displayName: roleProfiles.leaderParent.displayName,
    mobileNumber: roleProfiles.leaderParent.mobileNumber,
    status: "approved",
    memberIds: roleProfiles.leaderParent.memberIds,
    reviewedBy: createdBy,
    reviewedAt: now,
    testRoleType: "leader-parent"
  },
  {
    id: roleProfiles.parentOnly.uid,
    uid: roleProfiles.parentOnly.uid,
    email: roleProfiles.parentOnly.email,
    displayName: roleProfiles.parentOnly.displayName,
    mobileNumber: roleProfiles.parentOnly.mobileNumber,
    status: "approved",
    memberIds: roleProfiles.parentOnly.memberIds,
    reviewedBy: createdBy,
    reviewedAt: now,
    testRoleType: "parent-only"
  }
];

const members = [
  {
    id: "TEST_member_beaver_01",
    firstName: "Aoife",
    lastName: "Murphy",
    displayName: "Aoife Murphy",
    dateOfBirth: "2019-04-12",
    section: "Beavers",
    parentName: roleProfiles.leaderParent.displayName,
    emailAddress: roleProfiles.leaderParent.email,
    mobileNumber: roleProfiles.leaderParent.mobileNumber,
    emergencyContactName: "Declan Murphy",
    emergencyContactPhone: "0871000001",
    status: "active",
    testParentUid: roleProfiles.leaderParent.uid,
    testFamilyType: "leader-parent"
  },
  {
    id: "TEST_member_beaver_02",
    firstName: "Cian",
    lastName: "Murphy",
    displayName: "Cian Murphy",
    dateOfBirth: "2018-11-03",
    section: "Beavers",
    parentName: roleProfiles.leaderParent.displayName,
    emailAddress: roleProfiles.leaderParent.email,
    mobileNumber: roleProfiles.leaderParent.mobileNumber,
    emergencyContactName: "Declan Murphy",
    emergencyContactPhone: "0871000001",
    status: "active",
    testParentUid: roleProfiles.leaderParent.uid,
    testFamilyType: "leader-parent"
  },
  {
    id: "TEST_member_cub_01",
    firstName: "Emma",
    lastName: "Byrne",
    displayName: "Emma Byrne",
    dateOfBirth: "2016-06-25",
    section: "Cubs",
    parentName: roleProfiles.parentOnly.displayName,
    emailAddress: roleProfiles.parentOnly.email,
    mobileNumber: roleProfiles.parentOnly.mobileNumber,
    emergencyContactName: "Laura Byrne",
    emergencyContactPhone: "0871000003",
    status: "active",
    testParentUid: roleProfiles.parentOnly.uid,
    testFamilyType: "parent-only"
  },
  {
    id: "TEST_member_cub_02",
    firstName: "Jack",
    lastName: "Byrne",
    displayName: "Jack Byrne",
    dateOfBirth: "2015-09-18",
    section: "Cubs",
    parentName: roleProfiles.parentOnly.displayName,
    emailAddress: roleProfiles.parentOnly.email,
    mobileNumber: roleProfiles.parentOnly.mobileNumber,
    emergencyContactName: "Laura Byrne",
    emergencyContactPhone: "0871000003",
    status: "active",
    testParentUid: roleProfiles.parentOnly.uid,
    testFamilyType: "parent-only"
  },
  {
    id: "TEST_member_scout_01",
    firstName: "Sophie",
    lastName: "Ryan",
    displayName: "Sophie Ryan",
    dateOfBirth: "2013-02-10",
    section: "Scouts",
    parentName: "Brian Ryan",
    emailAddress: "test.sophie.parent@example.com",
    mobileNumber: "0870000005",
    emergencyContactName: roleProfiles.leaderOnly.displayName,
    emergencyContactPhone: roleProfiles.leaderOnly.mobileNumber,
    status: "active",
    testFamilyType: "no-parent-account"
  },
  {
    id: "TEST_member_inactive_01",
    firstName: "Test",
    lastName: "Inactive",
    displayName: "Test Inactive",
    dateOfBirth: "2016-01-01",
    section: "Cubs",
    parentName: "Test Parent",
    emailAddress: "test.inactive@example.com",
    mobileNumber: "0870000099",
    emergencyContactName: "Test Emergency",
    emergencyContactPhone: "0871000099",
    status: "inactive",
    testFamilyType: "unlinked"
  }
];

const events = [
  {
    id: "TEST_event_beaver_zoo",
    title: "TEST Beaver Zoo Trip",
    description: "Demo day trip for testing attendance, consent and parent responses.",
    eventType: "Day Trip",
    section: "Beavers",
    location: "Dublin Zoo",
    meetingPoint: "Scout Den at 09:00",
    returnDetails: "Collection at Scout Den at 16:30",
    leaderNotes: "TEST DATA ONLY. Bring packed lunch and rain gear.",
    startDate: "2026-09-12",
    endDate: "2026-09-12",
    status: "open",
    consentRequired: true,
    attendance: {
      TEST_member_beaver_01: "attending",
      TEST_member_beaver_02: "invited"
    },
    consent: {
      TEST_member_beaver_01: "received",
      TEST_member_beaver_02: "required"
    }
  },
  {
    id: "TEST_event_cub_camp",
    title: "TEST Cub Weekend Camp",
    description: "Demo overnight camp with mixed consent states.",
    eventType: "Camp",
    section: "Cubs",
    location: "Larch Hill",
    meetingPoint: "Scout Den Friday 18:00",
    returnDetails: "Scout Den Sunday 14:00",
    leaderNotes: "TEST DATA ONLY. Used for report and CSV testing.",
    startDate: "2026-10-02",
    endDate: "2026-10-04",
    status: "open",
    consentRequired: true,
    attendance: {
      TEST_member_cub_01: "attending",
      TEST_member_cub_02: "not-attending"
    },
    consent: {
      TEST_member_cub_01: "received",
      TEST_member_cub_02: "not-required"
    }
  },
  {
    id: "TEST_event_scout_hike",
    title: "TEST Scout Hike",
    description: "Draft event for filter testing.",
    eventType: "Hike",
    section: "Scouts",
    location: "Howth",
    meetingPoint: "Howth DART station",
    returnDetails: "Howth DART station",
    leaderNotes: "TEST DATA ONLY.",
    startDate: "2026-11-07",
    endDate: "2026-11-07",
    status: "draft",
    consentRequired: false,
    attendance: {},
    consent: {}
  },
  {
    id: "TEST_event_completed",
    title: "TEST Completed Summer Activity",
    description: "Completed historical event for read-only history testing.",
    eventType: "Activity",
    section: "All Sections",
    location: "Scout Den",
    meetingPoint: "Scout Den",
    returnDetails: "Scout Den",
    leaderNotes: "TEST DATA ONLY. Completed-event history example.",
    startDate: "2026-07-18",
    endDate: "2026-07-18",
    status: "completed",
    consentRequired: true,
    attendance: {
      TEST_member_beaver_01: "attending",
      TEST_member_cub_01: "attending",
      TEST_member_scout_01: "attending"
    },
    consent: {
      TEST_member_beaver_01: "received",
      TEST_member_cub_01: "received",
      TEST_member_scout_01: "received"
    }
  }
];

const joinApplications = [
  {
    id: "TEST_join_new_01",
    childFirstName: "Lucy",
    childLastName: "Test",
    dateOfBirth: "2020-03-05",
    parentName: "Parent Test",
    relationship: "Parent",
    emailAddress: "test.join.new@example.com",
    mobileNumber: "0860000001",
    emergencyContactName: "Emergency Test",
    emergencyContactPhone: "0861000001",
    section: "Beavers",
    school: "Test Primary School",
    previousScoutExperience: "No",
    previousScoutGroup: "",
    volunteeringInterest: "Yes",
    additionalInformation: "TEST DATA - new join enquiry",
    informationConfirmed: true,
    contactConsent: true,
    source: "website",
    status: "new",
    submittedAt: now
  },
  {
    id: "TEST_join_waiting_01",
    childFirstName: "Ben",
    childLastName: "Waiting",
    dateOfBirth: "2019-08-20",
    parentName: "Waiting Parent",
    relationship: "Parent",
    emailAddress: "test.join.waiting@example.com",
    mobileNumber: "0860000002",
    emergencyContactName: "Waiting Emergency",
    emergencyContactPhone: "0861000002",
    section: "Beavers",
    school: "Test Primary School",
    previousScoutExperience: "No",
    previousScoutGroup: "",
    volunteeringInterest: "No",
    additionalInformation: "TEST DATA - waiting list entry",
    informationConfirmed: true,
    contactConsent: true,
    source: "website",
    status: "waiting",
    submittedAt: Timestamp.fromDate(new Date("2026-06-01T12:00:00Z")),
    notes: "TEST DATA - oldest waiting list example",
    contactHistory: [
      {
        id: "TEST_contact_01",
        date: "2026-06-15T18:00:00.000Z",
        leaderUid: createdBy,
        method: "phone",
        note: "0860000002"
      }
    ]
  }
];

const consentApplications = [
  {
    id: "TEST_consent_aoife",
    memberId: "TEST_member_beaver_01",
    childFirstName: "Aoife",
    childLastName: "Murphy",
    dateOfBirth: "2019-04-12",
    parentName: roleProfiles.leaderParent.displayName,
    section: "Beavers",
    formType: "youth",
    status: "active",
    source: "website",
    medicalConditions: "Asthma - TEST DATA",
    medicationRequired: true,
    submittedAt: now,
    expiryDate: "2027-08-19",
    testParentUid: roleProfiles.leaderParent.uid
  },
  {
    id: "TEST_consent_emma",
    memberId: "TEST_member_cub_01",
    childFirstName: "Emma",
    childLastName: "Byrne",
    dateOfBirth: "2016-06-25",
    parentName: roleProfiles.parentOnly.displayName,
    section: "Cubs",
    formType: "youth",
    status: "active",
    source: "website",
    medicalConditions: "",
    medicationRequired: false,
    submittedAt: now,
    expiryDate: "2027-08-19",
    testParentUid: roleProfiles.parentOnly.uid
  }
];

const consentLinks = [
  {
    token: "TESTTOKENBEAVERZOO2026",
    eventId: "TEST_event_beaver_zoo",
    title: "TEST Beaver Zoo Trip",
    description: "Demo day trip for testing attendance, consent and parent responses.",
    eventType: "Day Trip",
    section: "Beavers",
    location: "Dublin Zoo",
    meetingPoint: "Scout Den at 09:00",
    returnDetails: "Collection at Scout Den at 16:30",
    startDate: "2026-09-12",
    endDate: "2026-09-12",
    consentRequired: true,
    active: true
  }
];

const parentResponses = [
  {
    id: "TEST_response_matched_aoife",
    token: "TESTTOKENBEAVERZOO2026",
    eventId: "TEST_event_beaver_zoo",
    childName: "Aoife Murphy",
    dateOfBirth: "2019-04-12",
    parentName: roleProfiles.leaderParent.displayName,
    attendance: "attending",
    consentGiven: true,
    emergencyDetailsConfirmed: true,
    medicalDetailsChanged: false,
    processingStatus: "matched",
    matchedMemberId: "TEST_member_beaver_01",
    processedBy: createdBy,
    processedAt: now,
    submittedAt: Timestamp.fromDate(new Date("2026-08-18T18:30:00Z"))
  },
  {
    id: "TEST_response_unmatched_typo",
    token: "TESTTOKENBEAVERZOO2026",
    eventId: "TEST_event_beaver_zoo",
    childName: "Cian Murpy",
    dateOfBirth: "2018-11-03",
    parentName: roleProfiles.leaderParent.displayName,
    attendance: "attending",
    consentGiven: true,
    emergencyDetailsConfirmed: true,
    medicalDetailsChanged: true,
    processingStatus: "new",
    matchedMemberId: "",
    submittedAt: Timestamp.fromDate(new Date("2026-08-19T09:15:00Z"))
  },
  {
    id: "TEST_response_ignored_duplicate",
    token: "TESTTOKENBEAVERZOO2026",
    eventId: "TEST_event_beaver_zoo",
    childName: "Aoife Murphy",
    dateOfBirth: "2019-04-12",
    parentName: roleProfiles.leaderParent.displayName,
    attendance: "attending",
    consentGiven: true,
    emergencyDetailsConfirmed: true,
    medicalDetailsChanged: false,
    processingStatus: "ignored",
    matchedMemberId: "",
    processedBy: createdBy,
    processedAt: now,
    submittedAt: Timestamp.fromDate(new Date("2026-08-19T09:30:00Z"))
  }
];

async function set(collectionName, id, data) {
  await db.collection(collectionName).doc(id).set(
    {
      ...data,
      ...marker,
      createdAt: data.createdAt || now,
      updatedAt: now
    },
    { merge: true }
  );
  console.log(`  ${collectionName}/${id}`);
}

async function seedCollection(collectionName, records, mapper = (record) => record) {
  for (const record of records) {
    const { id, ...data } = record;
    await set(collectionName, id, mapper(data));
  }
}

async function seed() {
  console.log("Seeding TEST data into Firestore...");

  await seedCollection("adminUsers", adminUsers);
  await seedCollection("parentAccounts", parentAccounts);

  await seedCollection("members", members, (data) => ({
    ...data,
    source: "manual",
    createdBy,
    updatedBy: createdBy
  }));

  await seedCollection("events", events, (data) => ({
    ...data,
    createdBy,
    updatedBy: createdBy
  }));

  await seedCollection("joinApplications", joinApplications);
  await seedCollection("consentApplications", consentApplications);

  for (const link of consentLinks) {
    const { token, ...data } = link;
    await set("eventConsentLinks", token, {
      ...data,
      createdBy
    });
  }

  await seedCollection("eventConsentResponses", parentResponses);

  console.log("\nTEST seed complete.");
  console.log(`Leader profiles: ${adminUsers.length}`);
  console.log(`Parent profiles: ${parentAccounts.length}`);
  console.log(`Members: ${members.length}`);
  console.log(`Events: ${events.length}`);
  console.log(`Join enquiries: ${joinApplications.length}`);
  console.log(`Consent records: ${consentApplications.length}`);
  console.log(`Parent consent links: ${consentLinks.length}`);
  console.log(`Parent responses: ${parentResponses.length}`);
  console.log("\nRole scenarios:");
  console.log(`  Leader + Parent: ${roleProfiles.leaderParent.displayName} -> ${roleProfiles.leaderParent.memberIds.join(", ")}`);
  console.log(`  Parent only: ${roleProfiles.parentOnly.displayName} -> ${roleProfiles.parentOnly.memberIds.join(", ")}`);
  console.log(`  Leader only: ${roleProfiles.leaderOnly.displayName} -> no parent account`);
  console.log("\nThese TEST_uid accounts are Firestore profile records only and are NOT login-capable Firebase Auth accounts.");
  console.log("All seeded documents are marked testData=true.");
}

const cleanupTargets = {
  adminUsers: adminUsers.map((x) => x.id),
  parentAccounts: parentAccounts.map((x) => x.id),
  members: members.map((x) => x.id),
  events: events.map((x) => x.id),
  joinApplications: joinApplications.map((x) => x.id),
  consentApplications: consentApplications.map((x) => x.id),
  eventConsentLinks: consentLinks.map((x) => x.token),
  eventConsentResponses: parentResponses.map((x) => x.id)
};

async function cleanup() {
  console.log("Removing only known TEST seed documents...");

  for (const [collectionName, ids] of Object.entries(cleanupTargets)) {
    for (const id of ids) {
      const ref = db.collection(collectionName).doc(id);
      const snapshot = await ref.get();
      if (!snapshot.exists) continue;

      if (snapshot.data()?.testData !== true) {
        throw new Error(
          `Refusing to delete ${collectionName}/${id}: testData marker is missing.`
        );
      }

      await ref.delete();
      console.log(`  deleted ${collectionName}/${id}`);
    }
  }

  console.log("\nTEST cleanup complete. Real records were not targeted.");
}

if (action === "seed") {
  await seed();
} else {
  await cleanup();
}

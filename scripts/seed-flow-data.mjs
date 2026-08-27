import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!rawCredentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
initializeApp({ credential: cert(JSON.parse(rawCredentials)) });
const db = getFirestore();
const marker = { testData: true, testSeed: "full-system-flows-v1", createdBySeed: "TEST_SEED" };
const now = Timestamp.now();

async function set(collection, id, data) {
  await db.collection(collection).doc(id).set({ ...data, ...marker, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function member(id) {
  const snapshot = await db.collection("members").doc(id).get();
  if (!snapshot.exists) throw new Error(`Population seed must create members/${id} before flow seeding.`);
  return { id, ...snapshot.data() };
}

async function organisationLeader(uid) {
  const snapshot = await db.collection("organisationLeadership").doc(uid).get();
  if (!snapshot.exists) throw new Error(`Population seed must create organisationLeadership/${uid} before flow seeding.`);
  return { uid, ...snapshot.data() };
}

const events = [
  ["TEST_flow_event_beavers_open", { title: "TEST Beavers Open Day Trip", description: "Canonical open day-trip example.", eventType: "Day Trip", section: "Beavers", location: "Dublin Zoo", meetingPoint: "Scout Den", returnDetails: "Scout Den", leaderNotes: "TEST DATA", startDate: "2026-09-12", endDate: "2026-09-12", status: "open", consentRequired: true, attendance: { TEST_member_beaver_01: "attending", TEST_member_beaver_02: "invited" }, consent: { TEST_member_beaver_01: "received", TEST_member_beaver_02: "required" }, createdAt: now, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_cubs_draft", { title: "TEST Cubs Draft Camp", description: "Canonical draft camp example.", eventType: "Camp", section: "Cubs", location: "Larch Hill", meetingPoint: "Scout Den", returnDetails: "Scout Den", leaderNotes: "TEST DATA", startDate: "2026-10-02", endDate: "2026-10-04", status: "draft", consentRequired: true, attendance: {}, consent: {}, createdAt: now, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_scouts_closed", { title: "TEST Scouts Closed Hike", description: "Canonical closed hike example.", eventType: "Hike", section: "Scouts", location: "Howth", meetingPoint: "Howth DART", returnDetails: "Howth DART", leaderNotes: "TEST DATA", startDate: "2026-08-01", endDate: "2026-08-01", status: "closed", consentRequired: false, attendance: {}, consent: {}, createdAt: now, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_ventures_completed", { title: "TEST Ventures Completed Activity", description: "Canonical completed activity example.", eventType: "Activity", section: "Ventures", location: "Scout Den", meetingPoint: "Scout Den", returnDetails: "Scout Den", leaderNotes: "TEST DATA", startDate: "2026-07-18", endDate: "2026-07-18", status: "completed", consentRequired: true, attendance: { TEST_member_venture_01: "attending" }, consent: { TEST_member_venture_01: "received" }, createdAt: now, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_rovers_open", { title: "TEST Rovers Open Service Project", description: "Canonical open service example.", eventType: "Service", section: "Rovers", location: "Community Centre", meetingPoint: "Scout Den", returnDetails: "Scout Den", leaderNotes: "TEST DATA", startDate: "2026-11-14", endDate: "2026-11-14", status: "open", consentRequired: false, attendance: {}, consent: {}, createdAt: now, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_all_sections", { title: "TEST All Sections Group Day", description: "Canonical all-sections event example.", eventType: "Activity", section: "All Sections", location: "Scout Den", meetingPoint: "Scout Den", returnDetails: "Scout Den", leaderNotes: "TEST DATA", startDate: "2026-12-05", endDate: "2026-12-05", status: "open", consentRequired: true, attendance: {}, consent: {}, createdAt: now, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }]
];

const joins = [
  ["TEST_flow_join_new", "new", "Beavers"],
  ["TEST_flow_join_contacted", "contacted", "Cubs"],
  ["TEST_flow_join_waiting", "waiting-list", "Scouts"],
  ["TEST_flow_join_accepted", "accepted", "Ventures"],
  ["TEST_flow_join_closed", "closed", "Rovers"]
];

const leaderRequests = [
  ["TEST_flow_leader_request_pending", "Pending Scouter", "Scouter", "Beavers", "pending"],
  ["TEST_flow_leader_request_approved", "Approved Section Leader", "Section Leader", "Cubs", "approved"],
  ["TEST_flow_leader_request_rejected", "Rejected Programme Scouter", "Programme Scouter", "Scouts", "rejected"]
];

function publicEvent(id, data) {
  return {
    eventId: id,
    title: data.title,
    description: data.description,
    eventType: data.eventType,
    section: data.section,
    location: data.location,
    startDate: data.startDate,
    endDate: data.endDate
  };
}

function canonicalYouthConsent(memberRecord, medical) {
  return {
    memberId: memberRecord.id,
    section: memberRecord.section,
    childName: memberRecord.displayName,
    childDOB: memberRecord.dateOfBirth,
    consentFrom: "2026-08-23",
    consentTo: "2027-07-31",
    photoConsent: "Yes",
    waterActivities: "Yes",
    canSwim: "Yes",
    seriousIllness: medical ? "Yes" : "No",
    regularMeds: medical ? "Yes" : "No",
    medAllergies: "No",
    allergies: "No",
    dietaryReqs: "No",
    vaccinated: "Yes",
    medicalFurtherInfo: medical ? "Asthma - TEST DATA" : "",
    gpName: "Test GP",
    gpTel: "012345678",
    gpAddress: "Test Medical Centre",
    lastCheckup: "2026-06-01",
    parent1Name: memberRecord.parentName || "Test Parent",
    parent2Name: "",
    homePhone: "",
    mobile1: memberRecord.mobileNumber || "0878000000",
    workPhone: "",
    email: memberRecord.emailAddress || "test.parent@example.com",
    homeAddress: "Test Address",
    altContactName: memberRecord.emergencyContactName || "Test Emergency",
    altContactPhone: memberRecord.emergencyContactPhone || "0877000000",
    additionalInfo: "",
    sig1Name: memberRecord.parentName || "Test Parent",
    sig2Name: "",
    sigDate: "2026-08-23",
    declarationConfirmed: true,
    medicationManagement: { enabled: medical },
    authorisedScouters: [],
    formType: "youth-activity-consent",
    formVersion: "stage2-2026-08",
    status: "active",
    source: "website",
    submittedAt: now
  };
}

async function seed() {
  for (const [id, data] of events) await set("events", id, data);
  for (const [id, data] of events.filter(([, event]) => event.status === "open")) await set("publicEvents", id, publicEvent(id, data));

  for (const [id, status, section] of joins) {
    await set("joinApplications", id, {
      childFirstName: "Test",
      childLastName: status.replaceAll("-", " "),
      dateOfBirth: "2018-05-10",
      school: "Test School",
      parentName: "Test Parent",
      relationship: "Parent",
      mobileNumber: "0860000000",
      emailAddress: `${id.toLowerCase()}@example.com`,
      section,
      previousScoutExperience: "No",
      previousScoutGroup: "",
      emergencyContactName: "Test Emergency",
      emergencyContactPhone: "0861000000",
      volunteeringInterest: "No",
      additionalInformation: "TEST DATA",
      informationConfirmed: true,
      contactConsent: true,
      source: "website",
      status,
      notes: "",
      contactHistory: [],
      submittedAt: now
    });
  }

  const beaver = await member("TEST_member_beaver_01");
  const cub = await member("TEST_member_cub_01");
  const scouter = await organisationLeader("TEST_uid_scout_section_leader");
  await set("consentApplications", "TEST_flow_consent_youth_medication", canonicalYouthConsent(beaver, true));
  await set("consentApplications", "TEST_flow_consent_youth_clear", canonicalYouthConsent(cub, false));
  await set("consentApplications", "TEST_flow_consent_scouter", {
    memberId: "TEST_uid_scout_section_leader",
    section: "Scouter",
    name: scouter.displayName,
    dob: "1990-01-01",
    address: "Test Address",
    mobile: "0872000000",
    homePhone: "",
    workPhone: "",
    nextOfKinName: "Test Next of Kin",
    nextOfKinAddress: "Test Address",
    nextOfKinMobile: "0872000001",
    nextOfKinHome: "",
    nextOfKinWork: "",
    epilepsy: "No",
    diabetes: "No",
    asthma: "No",
    heartDisease: "No",
    highBloodPressure: "No",
    skinAllergies: "No",
    hearingDifficulties: "No",
    otherMedical: "",
    previousInjuries: "",
    onMedication: "No",
    medicationDetails: "",
    allergies: "",
    signature: scouter.displayName,
    signatureDate: "2026-08-23",
    declarationConfirmed: true,
    medicationManagement: { enabled: false },
    formType: "scouter-es3-medical-advice",
    formVersion: "stage2-2026-08",
    status: "active",
    source: "website",
    submittedAt: now
  });

  await set("eventConsentLinks", "TESTFLOWBEAVERSOPEN2026", { eventId: "TEST_flow_event_beavers_open", title: "TEST Beavers Open Day Trip", description: "Canonical open day-trip example.", eventType: "Day Trip", section: "Beavers", location: "Dublin Zoo", meetingPoint: "Scout Den", returnDetails: "Scout Den", startDate: "2026-09-12", endDate: "2026-09-12", consentRequired: true, active: true, createdAt: now, createdBy: "TEST_SEED" });
  await set("eventConsentLinks", "TESTFLOWINACTIVE2026", { eventId: "TEST_flow_event_all_sections", title: "TEST All Sections Group Day", description: "Canonical all-sections event example.", eventType: "Activity", section: "All Sections", location: "Scout Den", meetingPoint: "Scout Den", returnDetails: "Scout Den", startDate: "2026-12-05", endDate: "2026-12-05", consentRequired: true, active: false, createdAt: now, createdBy: "TEST_SEED" });

  const responseBase = { token: "TESTFLOWBEAVERSOPEN2026", eventId: "TEST_flow_event_beavers_open", dateOfBirth: beaver.dateOfBirth, parentName: beaver.parentName || "Test Parent", attendance: "attending", consentGiven: true, emergencyDetailsConfirmed: true, submittedAt: now };
  await set("eventConsentResponses", "TEST_flow_response_new", { ...responseBase, childName: beaver.displayName, medicalDetailsChanged: true, processingStatus: "new", matchedMemberId: "" });
  await set("eventConsentResponses", "TEST_flow_response_matched", { ...responseBase, childName: beaver.displayName, medicalDetailsChanged: false, processingStatus: "matched", matchedMemberId: beaver.id, processedBy: "TEST_SEED", processedAt: now });
  await set("eventConsentResponses", "TEST_flow_response_ignored", { ...responseBase, childName: "Duplicate Test", medicalDetailsChanged: false, processingStatus: "ignored", matchedMemberId: "", processedBy: "TEST_SEED", processedAt: now });

  await set("meetingRecords", "TEST_flow_meeting_group", { title: "TEST Group Council Meeting", meetingType: "group", section: "Group", meetingDate: "2026-08-20", attendees: ["TEST_uid_group_leader", "TEST_uid_group_secretary"], notes: "TEST DATA", decisions: "Programme plan reviewed.", actions: "Group Leader to publish programme plan.", createdBy: "TEST_SEED", createdAt: now, updatedBy: "TEST_SEED" });
  await set("meetingRecords", "TEST_flow_meeting_leader", { title: "TEST Cubs Leader Meeting", meetingType: "leader", section: "Cubs", meetingDate: "2026-08-21", attendees: ["TEST_uid_cub_section_leader", "TEST_uid_cub_programme_scouter"], notes: "TEST DATA", decisions: "Camp plan agreed.", actions: "Confirm camp kit list.", createdBy: "TEST_SEED", createdAt: now, updatedBy: "TEST_SEED" });

  const history = [
    ["created", "", "Beavers", "active", "active"],
    ["section-transfer", "Beavers", "Cubs", "active", "active"],
    ["status-change", "Cubs", "Cubs", "active", "inactive"],
    ["section-and-status-change", "Cubs", "Scouts", "inactive", "active"]
  ];
  for (const [changeType, fromSection, toSection, fromStatus, toStatus] of history) {
    await set("memberHistory", `TEST_flow_history_${changeType}`, { memberId: "TEST_member_beaver_06", memberName: "TEST Lifecycle Member", changeType, fromSection, toSection, fromStatus, toStatus, changedBy: "TEST_SEED", changedAt: now });
  }

  for (const [uid, fullName, requestedRole, requestedSection, status] of leaderRequests) {
    await set("leaderRegistrationRequests", uid, { uid, fullName, email: `${uid.toLowerCase()}@example.com`, mobileNumber: "0872000090", requestedRole, requestedSection, reason: "TEST DATA role request", privacyConfirmed: true, status, submittedAt: now, reviewedAt: status === "pending" ? null : now, reviewedBy: status === "pending" ? "" : "TEST_SEED", reviewNote: status === "pending" ? "" : `TEST ${status}` });
  }

  await set("parentAccounts", "TEST_flow_parent_pending", { uid: "TEST_flow_parent_pending", email: "test.parent.pending@example.com", displayName: "Test Pending Parent", mobileNumber: "0878000100", status: "pending", memberIds: [], linkedSections: [], reviewedBy: "", reviewedAt: null, createdAt: now });
  await set("parentAccounts", "TEST_flow_parent_rejected", { uid: "TEST_flow_parent_rejected", email: "test.parent.rejected@example.com", displayName: "Test Rejected Parent", mobileNumber: "0878000101", status: "rejected", memberIds: [], linkedSections: [], reviewedBy: "TEST_SEED", reviewedAt: now, createdAt: now });

  console.log("Full-system canonical flow fixtures seeded.");
}

await seed();

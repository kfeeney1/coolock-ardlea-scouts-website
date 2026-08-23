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

const events = [
  ["TEST_flow_event_beavers_open", { title: "TEST Beavers Open Day Trip", eventType: "Day Trip", section: "Beavers", location: "Dublin Zoo", startDate: "2026-09-12", endDate: "2026-09-12", status: "open", consentRequired: true, attendance: { TEST_member_beaver_01: "attending", TEST_member_beaver_02: "invited" }, consent: { TEST_member_beaver_01: "received", TEST_member_beaver_02: "required" }, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_cubs_draft", { title: "TEST Cubs Draft Camp", eventType: "Camp", section: "Cubs", location: "Larch Hill", startDate: "2026-10-02", endDate: "2026-10-04", status: "draft", consentRequired: true, attendance: {}, consent: {}, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_scouts_closed", { title: "TEST Scouts Closed Hike", eventType: "Hike", section: "Scouts", location: "Howth", startDate: "2026-08-01", endDate: "2026-08-01", status: "closed", consentRequired: false, attendance: {}, consent: {}, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_ventures_completed", { title: "TEST Ventures Completed Activity", eventType: "Activity", section: "Ventures", location: "Scout Den", startDate: "2026-07-18", endDate: "2026-07-18", status: "completed", consentRequired: true, attendance: { TEST_member_venture_01: "attending" }, consent: { TEST_member_venture_01: "received" }, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_rovers_open", { title: "TEST Rovers Open Service Project", eventType: "Service", section: "Rovers", location: "Community Centre", startDate: "2026-11-14", endDate: "2026-11-14", status: "open", consentRequired: false, attendance: {}, consent: {}, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }],
  ["TEST_flow_event_all_sections", { title: "TEST All Sections Group Day", eventType: "Activity", section: "All Sections", location: "Scout Den", startDate: "2026-12-05", endDate: "2026-12-05", status: "open", consentRequired: true, attendance: {}, consent: {}, createdBy: "TEST_SEED", updatedBy: "TEST_SEED" }]
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

async function seed() {
  for (const [id, data] of events) await set("events", id, data);
  for (const [id, data] of events.filter(([, event]) => event.status === "open")) {
    await set("publicEvents", id, { eventId: id, title: data.title, section: data.section, status: data.status, startDate: data.startDate, endDate: data.endDate, location: data.location });
  }

  for (const [id, status, section] of joins) {
    await set("joinApplications", id, { childFirstName: "Test", childLastName: status, dateOfBirth: "2018-05-10", parentName: "Test Parent", relationship: "Parent", emailAddress: `${id.toLowerCase()}@example.com`, mobileNumber: "0860000000", emergencyContactName: "Test Emergency", emergencyContactPhone: "0861000000", section, informationConfirmed: true, contactConsent: true, source: "website", status, submittedAt: now });
  }

  await set("consentApplications", "TEST_flow_consent_youth_medication", { memberId: "TEST_member_beaver_01", childFirstName: "Test", childLastName: "Medication", section: "Beavers", formType: "youth", status: "active", source: "website", medicalConditions: "Asthma - TEST DATA", medicationRequired: true, submittedAt: now, expiryDate: "2027-08-23" });
  await set("consentApplications", "TEST_flow_consent_youth_clear", { memberId: "TEST_member_cub_01", childFirstName: "Test", childLastName: "Clear", section: "Cubs", formType: "youth", status: "active", source: "website", medicalConditions: "", medicationRequired: false, submittedAt: now, expiryDate: "2027-08-23" });
  await set("consentApplications", "TEST_flow_consent_scouter", { memberId: "TEST_uid_scout_section_leader", childFirstName: "Test", childLastName: "Scouter", section: "Scouter", formType: "scouter", status: "active", source: "website", medicalConditions: "", medicationRequired: false, submittedAt: now, expiryDate: "2027-08-23" });

  await set("eventConsentLinks", "TESTFLOWBEAVERSOPEN2026", { eventId: "TEST_flow_event_beavers_open", title: "TEST Beavers Open Day Trip", section: "Beavers", startDate: "2026-09-12", endDate: "2026-09-12", consentRequired: true, active: true, createdBy: "TEST_SEED" });
  await set("eventConsentLinks", "TESTFLOWINACTIVE2026", { eventId: "TEST_flow_event_all_sections", title: "TEST All Sections Group Day", section: "All Sections", startDate: "2026-12-05", endDate: "2026-12-05", consentRequired: true, active: false, createdBy: "TEST_SEED" });
  await set("eventConsentResponses", "TEST_flow_response_new", { token: "TESTFLOWBEAVERSOPEN2026", eventId: "TEST_flow_event_beavers_open", childName: "Test Beaver 01", parentName: "Test Parent", attendance: "attending", consentGiven: true, emergencyDetailsConfirmed: true, medicalDetailsChanged: true, processingStatus: "new", matchedMemberId: "", submittedAt: now });
  await set("eventConsentResponses", "TEST_flow_response_matched", { token: "TESTFLOWBEAVERSOPEN2026", eventId: "TEST_flow_event_beavers_open", childName: "Test Beaver 02", parentName: "Test Parent", attendance: "attending", consentGiven: true, emergencyDetailsConfirmed: true, medicalDetailsChanged: false, processingStatus: "matched", matchedMemberId: "TEST_member_beaver_02", processedBy: "TEST_SEED", processedAt: now, submittedAt: now });
  await set("eventConsentResponses", "TEST_flow_response_ignored", { token: "TESTFLOWBEAVERSOPEN2026", eventId: "TEST_flow_event_beavers_open", childName: "Duplicate Test", parentName: "Test Parent", attendance: "attending", consentGiven: true, emergencyDetailsConfirmed: true, medicalDetailsChanged: false, processingStatus: "ignored", matchedMemberId: "", processedBy: "TEST_SEED", processedAt: now, submittedAt: now });

  await set("meetingRecords", "TEST_flow_meeting_group", { title: "TEST Group Council Meeting", meetingType: "group", section: "Group", date: "2026-08-20", attendees: ["TEST_uid_group_leader", "TEST_uid_group_secretary"], notes: "TEST DATA", actionItems: [{ text: "Review programme plan", owner: "TEST_uid_group_leader", completed: false }], createdBy: "TEST_SEED" });
  await set("meetingRecords", "TEST_flow_meeting_leader", { title: "TEST Cubs Leader Meeting", meetingType: "leader", section: "Cubs", date: "2026-08-21", attendees: ["TEST_uid_cub_section_leader", "TEST_uid_cub_programme_scouter"], notes: "TEST DATA", actionItems: [{ text: "Confirm camp kit list", owner: "TEST_uid_cub_section_leader", completed: true }], createdBy: "TEST_SEED" });

  const history = [
    ["created", undefined, "Beavers", undefined, "active"],
    ["section-transfer", "Beavers", "Cubs", "active", "active"],
    ["status-change", "Cubs", "Cubs", "active", "inactive"],
    ["section-and-status-change", "Cubs", "Scouts", "inactive", "active"]
  ];
  for (const [changeType, fromSection, toSection, fromStatus, toStatus] of history) {
    await set("memberHistory", `TEST_flow_history_${changeType}`, { memberId: "TEST_member_beaver_30", changeType, ...(fromSection ? { fromSection } : {}), ...(toSection ? { toSection } : {}), ...(fromStatus ? { fromStatus } : {}), ...(toStatus ? { toStatus } : {}), changedBy: "TEST_SEED", changedAt: now });
  }

  for (const [uid, fullName, requestedRole, requestedSection, status] of leaderRequests) {
    await set("leaderRegistrationRequests", uid, { uid, fullName, email: `${uid.toLowerCase()}@example.com`, mobileNumber: "0872000090", requestedRole, requestedSection, reason: "TEST DATA role request", privacyConfirmed: true, status, submittedAt: now, reviewedAt: status === "pending" ? null : now, reviewedBy: status === "pending" ? "" : "TEST_SEED", reviewNote: status === "pending" ? "" : `TEST ${status}` });
  }

  await set("parentAccounts", "TEST_flow_parent_pending", { uid: "TEST_flow_parent_pending", email: "test.parent.pending@example.com", displayName: "Test Pending Parent", mobileNumber: "0878000100", status: "pending", memberIds: [], linkedSections: [], reviewedBy: "", reviewedAt: null, createdAt: now });
  await set("parentAccounts", "TEST_flow_parent_rejected", { uid: "TEST_flow_parent_rejected", email: "test.parent.rejected@example.com", displayName: "Test Rejected Parent", mobileNumber: "0878000101", status: "rejected", memberIds: [], linkedSections: [], reviewedBy: "TEST_SEED", reviewedAt: now, createdAt: now });

  console.log("Full-system flow fixtures seeded: joins, parent states, leader requests, events/public events, consent, responses, meetings and member lifecycle history.");
}

await seed();

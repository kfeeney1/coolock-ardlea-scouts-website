export const FIRESTORE_ROOT_COLLECTIONS = Object.freeze([
  "adminUsers",
  "auditLog",
  "consentApplications",
  "equipmentCategories",
  "equipmentHistory",
  "equipmentIncidents",
  "equipmentItems",
  "equipmentLoans",
  "equipmentLocations",
  "equipmentProgrammeRequirements",
  "eventConsentLinks",
  "eventConsentResponses",
  "eventGalleryAccess",
  "events",
  "financeReconciliations",
  "financeTransactions",
  "joinApplications",
  "leaderRegistrationRequests",
  "meetingRecords",
  "memberAdventureSkillProgress",
  "memberHistory",
  "members",
  "organisationLeadership",
  "parentAccounts",
  "parentGalleryEvents",
  "parentWeeklyMeetings",
  "programmeLibrary",
  "publicEvents",
  "publicLeadership",
  "publicSiteContent",
  "siteSettings",
  "weeklyMeetings"
]);

export const FIRESTORE_ROOT_COLLECTION_SET = new Set(FIRESTORE_ROOT_COLLECTIONS);

// Written only by trusted Admin SDK maintenance tools and deliberately absent
// from client Firestore rules. Storage rules read this projection when
// authorising parent event-gallery access.
export const FIRESTORE_ADMIN_ONLY_ROOT_COLLECTIONS = Object.freeze(["eventGalleryAccess"]);

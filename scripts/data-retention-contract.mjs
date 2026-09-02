import { FIRESTORE_ROOT_COLLECTIONS } from "./firestore-collection-contract.mjs";

export const DATA_SENSITIVITY = Object.freeze({
  PUBLIC: "public",
  INTERNAL: "internal",
  PERSONAL: "personal",
  SENSITIVE: "sensitive",
  SPECIAL_CATEGORY: "special-category"
});

export const RETENTION_DISPOSITIONS = Object.freeze({
  SOURCE_PROJECTION: "source-projection",
  MANUAL_REVIEW: "manual-review-required",
  NO_ROUTINE_DELETE: "no-routine-deletion",
  CONFIGURATION: "configuration-lifecycle"
});

const policy = (collection, domain, sensitivity, disposition, reviewTrigger, rationale, sourceCollection = null) => ({
  collection,
  domain,
  sensitivity,
  disposition,
  reviewTrigger,
  rationale,
  sourceCollection
});

export const DATA_RETENTION_CONTRACT = Object.freeze([
  policy("adminUsers", "identity", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "leader-offboarding", "Leader identity/access records must be reviewed during explicit offboarding; client deletion is not a retention mechanism."),
  policy("auditLog", "audit", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "governance-review", "Audit history supports accountability and must not be aged out by routine client automation."),
  policy("consentApplications", "consent-medical", DATA_SENSITIVITY.SPECIAL_CATEGORY, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "consent-purpose-ended", "Consent applications can contain medical, medication, GP, contact and emergency information. Removal requires a documented purpose/retention review before any destructive tooling is introduced."),
  policy("equipmentCategories", "equipment", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.CONFIGURATION, "category-retired", "Reference data should be retired deliberately so historic equipment records remain understandable."),
  policy("equipmentHistory", "equipment", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "governance-review", "Equipment history is operational evidence and should remain stable enough to explain later stock and custody changes."),
  policy("equipmentIncidents", "equipment", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "governance-review", "Incident history may be needed for safety, maintenance and accountability and must not be routinely purged."),
  policy("equipmentItems", "equipment", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "asset-retired", "Asset records require a deliberate retirement path so linked loan/history records are not orphaned."),
  policy("equipmentLoans", "equipment", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "governance-review", "Loan history records custody and return activity and must not be automatically removed."),
  policy("equipmentLocations", "equipment", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.CONFIGURATION, "location-retired", "Locations are reference data and should be retired only after dependent equipment has been reviewed."),
  policy("equipmentProgrammeRequirements", "equipment", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.CONFIGURATION, "programme-retired", "Programme requirement mappings are reference data and follow the programme/equipment lifecycle."),
  policy("eventConsentLinks", "event-consent", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "event-consent-purpose-ended", "Links between events, members and consent records should be reviewed when the event/consent purpose ends."),
  policy("eventConsentResponses", "event-consent", DATA_SENSITIVITY.SENSITIVE, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "event-consent-purpose-ended", "Event consent responses can contain child-specific attendance/consent information and require explicit review before deletion."),
  policy("eventGalleryAccess", "gallery", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.SOURCE_PROJECTION, "source-access-revoked", "This trusted-admin projection exists only to authorise gallery access and should follow the source entitlement lifecycle.", "parentGalleryEvents"),
  policy("events", "events", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "governance-review", "Event records carry operational history, attendance and consent context and are not routine purge candidates."),
  policy("financeReconciliations", "finance", DATA_SENSITIVITY.SENSITIVE, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "finance-governance-review", "Reconciliation evidence must remain available for financial accountability; no generic age-based purge is allowed."),
  policy("financeTransactions", "finance", DATA_SENSITIVITY.SENSITIVE, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "finance-governance-review", "Financial ledger history must not be removed by generic retention automation."),
  policy("joinApplications", "applications", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "application-closed-or-converted", "Applications contain child, parent and emergency-contact data. Closed/converted records need an explicit retention decision while preserving member provenance."),
  policy("leaderRegistrationRequests", "applications", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "registration-resolved", "Registration requests contain leader identity/contact data and must be reviewed after approval/rejection rather than retained by accident."),
  policy("meetingRecords", "meetings", DATA_SENSITIVITY.SENSITIVE, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "governance-review", "Meeting records and revisions can contain attendance, notes and incident context and are operational history."),
  policy("memberAdventureSkillProgress", "member-programme", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "member-offboarding-review", "Badge progress is member-owned programme history and intentionally persists across section transfers."),
  policy("memberHistory", "member-history", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "member-offboarding-review", "Lifecycle history is immutable operational provenance for section/status changes and must not be treated as disposable current-state data."),
  policy("members", "members", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "member-left-or-offboarding", "Member records contain child and emergency-contact details. Status changes are not deletion; offboarding must be explicit and auditable."),
  policy("organisationLeadership", "identity", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "leader-role-ended", "Operational leadership assignments should be ended/retired deliberately while preserving enough history for accountability."),
  policy("parentAccounts", "identity", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.MANUAL_REVIEW, "parent-offboarding", "Parent accounts contain explicit member links; lifecycle changes belong to the Stage 19.5 offboarding path, not generic retention deletion."),
  policy("parentGalleryEvents", "gallery", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.SOURCE_PROJECTION, "source-event-access-ended", "Parent gallery event projections should follow event/entitlement state and carry no independent retention claim.", "events"),
  policy("parentWeeklyMeetings", "meetings", DATA_SENSITIVITY.PERSONAL, RETENTION_DISPOSITIONS.SOURCE_PROJECTION, "source-meeting-ended", "Parent-safe weekly meeting projections follow the canonical weekly meeting lifecycle.", "weeklyMeetings"),
  policy("programmeLibrary", "programme", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.CONFIGURATION, "programme-retired", "Programme templates are reference content and require deliberate retirement when no longer in use."),
  policy("publicEvents", "public-projection", DATA_SENSITIVITY.PUBLIC, RETENTION_DISPOSITIONS.SOURCE_PROJECTION, "source-event-removed", "Public event documents are safe projections and must follow the canonical event lifecycle.", "events"),
  policy("publicLeadership", "public-projection", DATA_SENSITIVITY.PUBLIC, RETENTION_DISPOSITIONS.SOURCE_PROJECTION, "source-role-ended", "Public leadership documents are safe projections and must follow canonical leadership state.", "organisationLeadership"),
  policy("publicSiteContent", "site-content", DATA_SENSITIVITY.PUBLIC, RETENTION_DISPOSITIONS.CONFIGURATION, "content-replaced", "Published site content is configuration/reference data and should be versioned or replaced deliberately."),
  policy("siteSettings", "site-content", DATA_SENSITIVITY.INTERNAL, RETENTION_DISPOSITIONS.CONFIGURATION, "setting-replaced", "Site settings are configuration data and are not candidates for age-based deletion."),
  policy("weeklyMeetings", "meetings", DATA_SENSITIVITY.SENSITIVE, RETENTION_DISPOSITIONS.NO_ROUTINE_DELETE, "governance-review", "Weekly meetings can contain attendance, notes, medical issues and badgework context and must not be routinely purged.")
]);

export function validateDataRetentionContract(contract = DATA_RETENTION_CONTRACT, rootCollections = FIRESTORE_ROOT_COLLECTIONS) {
  const errors = [];
  const rootSet = new Set(rootCollections);
  const seen = new Set();
  const allowedSensitivity = new Set(Object.values(DATA_SENSITIVITY));
  const allowedDispositions = new Set(Object.values(RETENTION_DISPOSITIONS));

  for (const entry of contract) {
    if (!entry || typeof entry !== "object") {
      errors.push("Retention contract contains a non-object entry.");
      continue;
    }
    if (!rootSet.has(entry.collection)) errors.push(`Unknown Firestore root collection: ${entry.collection}.`);
    if (seen.has(entry.collection)) errors.push(`Duplicate retention policy for ${entry.collection}.`);
    seen.add(entry.collection);
    if (!allowedSensitivity.has(entry.sensitivity)) errors.push(`Invalid sensitivity for ${entry.collection}.`);
    if (!allowedDispositions.has(entry.disposition)) errors.push(`Invalid disposition for ${entry.collection}.`);
    if (!entry.reviewTrigger || typeof entry.reviewTrigger !== "string") errors.push(`Missing review trigger for ${entry.collection}.`);
    if (!entry.rationale || typeof entry.rationale !== "string") errors.push(`Missing rationale for ${entry.collection}.`);
    if (entry.disposition === RETENTION_DISPOSITIONS.SOURCE_PROJECTION) {
      if (!entry.sourceCollection || !rootSet.has(entry.sourceCollection)) errors.push(`Projection ${entry.collection} must name a canonical source collection.`);
    } else if (entry.sourceCollection !== null) {
      errors.push(`Non-projection ${entry.collection} must not declare sourceCollection.`);
    }
  }

  for (const collection of rootCollections) {
    if (!seen.has(collection)) errors.push(`Missing retention policy for ${collection}.`);
  }

  return errors;
}

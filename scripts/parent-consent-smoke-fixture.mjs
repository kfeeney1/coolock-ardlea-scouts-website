export const parentConsentSmokeIds = Object.freeze({
  parentId: "TEST_uid_cub_parent_1",
  parentEmail: "test.cub.parent1@example.com",
  childId: "TEST_member_cub_01",
  eventId: "TEST_parent_consent_smoke_cubs",
  consentToken: "TEST_CUB_PARENT_CONSENT_SMOKE",
  title: "TEST Cubs Parent Consent Smoke"
});

function futureDate(days = 30) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildParentConsentSmokeFixture(startDate = futureDate()) {
  const { childId, eventId, consentToken, title } = parentConsentSmokeIds;
  const event = {
    title,
    description: "Deterministic linked-child consent request used by the Firebase TEST deployment smoke.",
    eventType: "Activity",
    section: "Cubs",
    location: "TEST Scout Den",
    meetingPoint: "TEST Scout Den",
    returnDetails: "TEST Scout Den",
    leaderNotes: "TEST DATA ONLY.",
    startDate,
    endDate: startDate,
    status: "open",
    consentRequired: true,
    audience: { version: 3, mode: "members", sectionIds: [], memberIds: [], resolvedMemberIds: [] },
    attendance: { [childId]: "invited" },
    consent: { [childId]: "required" },
    consentLinkToken: consentToken,
    createdBy: "TEST_SEED",
    updatedBy: "TEST_SEED"
  };
  const audienceMembership = {
    eventId,
    eventSection: "Cubs",
    memberId: childId,
    scopeSection: "Cubs",
    selectedBySection: false,
    selectedIndividually: true,
    updatedBy: "TEST_SEED"
  };
  const consentLink = {
    eventId,
    title,
    description: event.description,
    eventType: event.eventType,
    section: event.section,
    location: event.location,
    meetingPoint: event.meetingPoint,
    returnDetails: event.returnDetails,
    startDate,
    endDate: startDate,
    consentRequired: true,
    active: true,
    audienceMemberIds: [],
    audienceVersion: 3,
    createdBy: "TEST_SEED",
    updatedBy: "TEST_SEED"
  };
  return { event, audienceMembership, consentLink };
}

/** Preserve Parent Login's existing value and materialize its default when creating the shared projection. */
export function resolveParentLoginSeedState(parentLogin, publicNavigation) {
  const parentLoginEnabled = parentLogin
    ? parentLogin.parentLoginEnabled === true
    : true;
  if (publicNavigation && publicNavigation.parentLoginEnabled !== parentLoginEnabled) {
    throw new Error("Parent Portal consent smoke fixture invalid: siteSettings/parentLogin and siteSettings/publicNavigation disagree on parentLoginEnabled.");
  }
  return { parentLoginEnabled, createCanonicalSetting: !parentLogin };
}

export function validateParentConsentSmokeFixture({
  parent,
  child,
  event,
  audienceMembership,
  consentLink,
  consentSettings,
  publicNavigationSettings
}) {
  const { parentId, parentEmail, childId, eventId, consentToken, title } = parentConsentSmokeIds;
  const problems = [];
  const list = (value) => Array.isArray(value) ? value : [];

  if (!parent) problems.push(`missing parentAccounts/${parentId}`);
  else {
    if (parent.status !== "approved") problems.push(`parentAccounts/${parentId} must be approved`);
    if (parent.email !== parentEmail) problems.push(`parentAccounts/${parentId} must use ${parentEmail}`);
    if (!list(parent.memberIds).includes(childId)) problems.push(`parentAccounts/${parentId} must link ${childId}`);
    if (!list(parent.linkedSections).includes("Cubs")) problems.push(`parentAccounts/${parentId} must link the Cubs section`);
  }

  if (!child) problems.push(`missing members/${childId}`);
  else if (child.status !== "active" || child.section !== "Cubs") problems.push(`members/${childId} must be an active Cubs member`);

  if (consentSettings?.parentConsentEnabled !== true) problems.push("siteSettings/parentConsent.parentConsentEnabled must be true for this consent smoke journey");
  if (publicNavigationSettings?.parentConsentEnabled !== true) problems.push("siteSettings/publicNavigation.parentConsentEnabled must be true for this consent smoke journey");

  if (!event) problems.push(`missing events/${eventId}`);
  else {
    if (event.title !== title) problems.push(`events/${eventId} must be titled ${title}`);
    if (event.status !== "open") problems.push(`events/${eventId} must be open`);
    if (event.section !== "Cubs") problems.push(`events/${eventId} must target Cubs`);
    if (event.consentRequired !== true) problems.push(`events/${eventId} must require consent`);
    if (!event.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(event.startDate)) problems.push(`events/${eventId} must have an ISO date`);
    if (event.startDate < new Date().toISOString().slice(0, 10)) problems.push(`events/${eventId} must be upcoming`);
    if (event.audience?.version !== 3 || event.audience?.mode !== "members") problems.push(`events/${eventId} must use a v3 selected-member audience`);
    if (event.consent?.[childId] !== "required") problems.push(`events/${eventId} must mark ${childId} as requiring consent`);
  }

  if (!audienceMembership) problems.push(`missing events/${eventId}/audienceMembers/${childId}`);
  else if (audienceMembership.eventId !== eventId
    || audienceMembership.memberId !== childId
    || audienceMembership.eventSection !== "Cubs"
    || audienceMembership.scopeSection !== "Cubs"
    || audienceMembership.selectedIndividually !== true) {
    problems.push(`events/${eventId}/audienceMembers/${childId} must include the linked child through the selected-member audience`);
  }

  if (!consentLink) problems.push(`missing eventConsentLinks/${consentToken}`);
  else if (consentLink.eventId !== eventId
    || consentLink.title !== title
    || consentLink.active !== true
    || consentLink.consentRequired !== true
    || consentLink.audienceVersion !== 3
    || consentLink.startDate !== event?.startDate
    || consentLink.endDate !== event?.endDate
    || !Array.isArray(consentLink.audienceMemberIds)
    || consentLink.audienceMemberIds.length !== 0) {
    problems.push(`eventConsentLinks/${consentToken} must be active, consent-required, and project ${eventId} as a v3 audience`);
  }

  if (problems.length) throw new Error(`Parent Portal consent smoke fixture invalid: ${problems.join("; ")}.`);
  return true;
}

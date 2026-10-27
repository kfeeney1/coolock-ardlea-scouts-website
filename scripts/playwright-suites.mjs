export const suiteSpecs = {
  "smoke-navigation": [
    "leader-info.spec.ts",
    "leader-journey.spec.ts",
    "leader-navigation-info.spec.ts",
    "leader-navigation.spec.ts",
    "leader-navigation-version.spec.ts",
    "leader-navigation-personas.spec.ts",
    "leader-navigation-contract.spec.ts",
    "leader-navigation-state.spec.ts",
    "leader-navigation-direct-routes.spec.ts",
    "leader-navigation-mobile-transition.spec.ts",
    "leader-navigation-back.spec.ts",
    "leader-navigation-accessibility.spec.ts",
    "navigation-recovery.spec.ts",
    "navigation-route-identities.spec.ts",
    "loading-shell.spec.ts",
    "logout.spec.ts"
  ],
  "authentication-rbac": [
    "admin-overview.spec.ts",
    "login-dashboard-routing.spec.ts",
    "leader-access-management.spec.ts",
    "organisation-chart.spec.ts",
    "parent-access-management.spec.ts",
    "password-visibility.spec.ts",
    "release-authorization-boundaries.spec.ts",
    "role-permissions.spec.ts",
    "roles-permissions.spec.ts",
    "parent-login-visibility.spec.ts",
    "parent-consent-visibility.spec.ts",
    "schedule-experience-setting.spec.ts",
    "leader-training-setting.spec.ts",
    "leader-training-records.spec.ts",
    "leader-training-calendar.spec.ts",
    "maintenance-access.spec.ts",
    "group-calendar.spec.ts",
    "calendar-record-layout.spec.ts",
    "calendar-date-actions.spec.ts",
    "calendar-sources.spec.ts",
    "maintenance-appointments.spec.ts",
    "scheduled-maintenance-tasks.spec.ts",
    "maintenance-persistence.spec.ts",
    "site-settings.spec.ts"
  ],
  "members-parents-consent": [
    "consent-action-stability.spec.ts",
    "consent-section-symbols.spec.ts",
    "form-validation-focus.spec.ts",
    "section-consent-ux.spec.ts",
    "join-consent-record-pages.spec.ts",
    "member-history-search.spec.ts",
    "member-management-targeting.spec.ts",
    "member-leader-transition.spec.ts",
    "member-record-page.spec.ts",
    "rover-membership.spec.ts",
    "mobile-consent-medication.spec.ts",
    "scouter-consent-inheritance.spec.ts",
    "parent-approved-journey.spec.ts",
    "parent-leader-context.spec.ts",
    "parent-portal.spec.ts",
    "poll-management-acknowledgement.spec.ts",
    "dashboard-polls.spec.ts",
    "polls.spec.ts"
  ],
  "activities-programme": [
    "activity-log.spec.ts",
    "attendance-insights.spec.ts",
    "attendance-matrix.spec.ts",
    "event-consent-linking.spec.ts",
    "event-gallery.spec.ts",
    "event-record-page.spec.ts",
    "event-schedule.spec.ts",
    "event-audience-selection.spec.ts",
    "sw403-programme-scouter-event-save.spec.ts",
    "sw362-event-edit-navigation.spec.ts",
    "event-create-readiness.spec.ts",
    "meeting-records.spec.ts",
    "programme-library.spec.ts",
    "weekly-activity-audit.spec.ts",
    "weekly-mobile-layout.spec.ts",
    "weekly-schedule.spec.ts",
    "meeting-workflow-shell.spec.ts",
    "meeting-create-plan.spec.ts",
    "meeting-plan-compact.spec.ts",
    "meeting-save-before-share.spec.ts",
    "meeting-lifecycle.spec.ts",
    "meeting-review-badgework.spec.ts",
    "meeting-run-incidents.spec.ts",
    "meeting-integration-accessibility.spec.ts",
    "schedule-accessibility.spec.ts",
    "schedule-experience-matrix.spec.ts",
    "weekly-meeting-share.spec.ts",
    "weekly-parent-sharing.spec.ts",
    "weekly-parent-programme-history.spec.ts",
    "weekly-planner-followup.spec.ts",
    "weekly-record-integrity.spec.ts",
    "weekly-meeting-date-defaults.spec.ts",
    "weekly-meeting-navigation.spec.ts",
    "weekly-meeting-reopen-navigation.spec.ts",
    "weekly-meeting-copy-dialog.spec.ts",
    "weekly-meeting-copy-page.spec.ts",
    "future-closed-meeting-cleanup.spec.ts",
    "weekly-section-tracker.spec.ts",
    "weekly-section-tracker-history-permissions.spec.ts",
    "weekly-attendance-uniform.spec.ts",
    "weekly-meeting-history-access.spec.ts"
  ],
  badgework: [
    "adventure-skills-badgework.spec.ts",
    "badgework-skill-filter.spec.ts",
    "sw265-badgework-navigation.spec.ts"
  ],
  equipment: [
    "damaged-equipment-issues.spec.ts",
    "equipment-checkout.spec.ts",
    "equipment-loading.spec.ts",
    "equipment-inventory-filters.spec.ts",
    "programme-equipment.spec.ts",
    "email-action-links.spec.ts",
    "equipment-leader-dashboard.spec.ts",
    "equipment-reports.spec.ts",
    "detailed-inventory.spec.ts"
  ],
  "finance-subs": [
    "finance-cashbook.spec.ts",
    "finance-reporting.spec.ts",
    "finance-transfers.spec.ts",
    "reports.spec.ts",
    "subs-management.spec.ts"
  ],
  "public-pages": [
    "leader-communications.spec.ts",
    "public-smoke.spec.ts",
    "sitewide-tile-filters.spec.ts"
  ],
  "platform-ui": [
    "accessibility-baseline.spec.ts",
    "mobile-accessibility-closeout.spec.ts",
    "mobile-back-navigation.spec.ts",
    "overlay-menu-history.spec.ts",
    "overlay-reopen-history.spec.ts",
    "mobile-dialog-actions.spec.ts",
    "mobile-operational-pass.spec.ts",
    "section-aware-cards.spec.ts",
    "sitewide-dropdown-geometry.spec.ts",
    "theme-parity.spec.ts",
    "wcag-regression.spec.ts",
    "webkit-critical-path.spec.ts"
  ],
  "domain-deployment": ["test-environment-smoke.spec.ts"]
};

export const smokeSpecs = [
  "public-smoke.spec.ts",
  "leader-navigation.spec.ts",
  "logout.spec.ts"
];

const keywordSuites = [
  [/badge|skill/i, "badgework"],
  [/equipment|quartermaster|bosun/i, "equipment"],
  [/finance|subs|cashbook|treasurer|payment/i, "finance-subs"],
  [/member|parent|consent|guardian|join/i, "members-parents-consent"],
  [/activity|event|programme|meeting|weekly|attendance|planner/i, "activities-programme"],
  [/role|permission|rbac|auth|access|organisation|organization/i, "authentication-rbac"],
  [/public|contact|about|leadership|who.?s.?who/i, "public-pages"],
  [/theme|mobile|navigation|layout|dropdown|accessibility|wcag/i, "platform-ui"],
  [/deploy|hosting|domain|environment|firebase/i, "domain-deployment"]
];

export function suiteForSpec(specName) {
  return Object.entries(suiteSpecs).find(([, specs]) => specs.includes(specName))?.[0] ?? null;
}

export function suitesForChangedPath(file) {
  if (file.startsWith("e2e/") && file.endsWith(".spec.ts")) {
    const suite = suiteForSpec(file.slice("e2e/".length));
    return suite ? [suite] : null;
  }

  if (file.startsWith("docs/") || file === "README.md") return [];
  // Operational workflows and focused-selection artifacts do not change browser
  // behavior. Unit tests run through the required Quality job.
  if ([
    ".github/workflows/firestore-backup-freshness.yml",
    ".github/workflows/firestore-backup.yml",
    ".github/workflows/sw-318-first-run.yml",
    "scripts/focused-playwright-selection.mjs",
    "tests/unit/focusedPlaywrightSelection.test.ts",
    "tests/unit/playwrightSuites.test.ts"
  ].includes(file)) return [];
  if (file === ".github/workflows/playwright-e2e.yml" || file === "scripts/playwright-suites.mjs") return ["activities-programme", "platform-ui"];
  if (file === "src/hooks/useSaveOnNavigation.ts") return ["activities-programme", "platform-ui"];
  if (file === "src/hooks/useConfirmEventLeave.ts") return ["activities-programme", "platform-ui"];
  if ([
    "src/components/consent/ScouterConsentForm.tsx",
    "src/services/leaderProfile.ts",
    "src/services/leaderMedicalProfileLogic.ts",
    "src/services/scouterConsentPrefill.ts",
    "src/services/scouterConsentPrefillLogic.ts",
    "tests/unit/leaderMedicalProfileLogic.test.ts",
    "tests/unit/scouterConsentPrefill.test.ts",
  ].includes(file)) return ["members-parents-consent"];
  if (file === "scripts/seed-playwright-records.mjs") return ["members-parents-consent", "activities-programme"];
  if (file === "tests/unit/work-block-d-section-integrity.test.ts") return ["activities-programme", "members-parents-consent"];
  // Rover membership must always receive its focused lifecycle and permission coverage.
  if (/rover/i.test(file) && (file.startsWith("src/") || file.startsWith("tests/"))) return ["members-parents-consent", "authentication-rbac"];
  if (file === "src/components/admin/LeaderChildLinksSection.tsx") return ["authentication-rbac"];
  if (file === "src/components/admin/EquipmentItemFormDialog.tsx") return ["equipment"];
  if (file === "src/components/admin/BadgeworkTrackingDialogs.tsx") return ["badgework"];
  if (file === "src/components/admin/WeeklyMeetingHistoryPanel.tsx") return ["activities-programme"];
  if (file === "src/services/weeklyMeetingReopenFlow.ts") return ["activities-programme"];
  if (["src/services/weeklyTracker.ts", "src/services/weeklyTrackerLogic.ts", "src/services/weeklyMeetingDate.mjs", "src/services/weeklyMeetingDate.d.mts", "src/services/reporting.ts", "src/services/attendanceInsightsLogic.ts", "src/components/admin/WeeklyAttendancePanel.tsx", "src/components/admin/WeeklyMeetingSummary.tsx"].includes(file)) return ["activities-programme"];

  // Test infrastructure, shared application infrastructure, dependencies, Firebase rules,
  // workflow changes, and unknown paths are deliberately full-suite changes.
  const fullSuitePaths = [
    "playwright.config.ts",
    "package.json",
    "package-lock.json",
    "firebase.json",
    "firebase.test.json",
    "firestore.rules",
    "storage.rules",
    ".github/",
    "scripts/",
    "src/components/",
    "src/hooks/",
    "src/services/",
    "src/App.tsx",
    "src/main.tsx",
    "src/firebase.ts"
  ];
  if (fullSuitePaths.some((prefix) => file === prefix || file.startsWith(prefix))) return null;

  for (const [pattern, suite] of keywordSuites) {
    if (pattern.test(file)) return [suite];
  }

  return null;
}

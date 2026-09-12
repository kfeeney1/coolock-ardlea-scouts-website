export const suiteSpecs = {
  "smoke-navigation": [
    "leader-info.spec.ts",
    "leader-journey.spec.ts",
    "leader-navigation-info.spec.ts",
    "leader-navigation.spec.ts",
    "loading-shell.spec.ts",
    "logout.spec.ts"
  ],
  "authentication-rbac": [
    "admin-overview.spec.ts",
    "leader-access-management.spec.ts",
    "organisation-chart.spec.ts",
    "parent-access-management.spec.ts",
    "release-authorization-boundaries.spec.ts",
    "role-permissions.spec.ts",
    "roles-permissions.spec.ts",
    "site-settings.spec.ts"
  ],
  "members-parents-consent": [
    "consent-section-symbols.spec.ts",
    "join-consent-record-pages.spec.ts",
    "member-history-search.spec.ts",
    "member-management-targeting.spec.ts",
    "member-record-page.spec.ts",
    "mobile-consent-medication.spec.ts",
    "parent-approved-journey.spec.ts",
    "parent-portal.spec.ts"
  ],
  "activities-programme": [
    "activity-log.spec.ts",
    "attendance-insights.spec.ts",
    "event-consent-linking.spec.ts",
    "event-gallery.spec.ts",
    "event-record-page.spec.ts",
    "meeting-records.spec.ts",
    "programme-library.spec.ts",
    "weekly-activity-audit.spec.ts",
    "weekly-mobile-layout.spec.ts",
    "weekly-parent-sharing.spec.ts",
    "weekly-planner-followup.spec.ts",
    "weekly-section-tracker.spec.ts"
  ],
  badgework: [
    "adventure-skills-badgework.spec.ts",
    "badgework-skill-filter.spec.ts"
  ],
  equipment: [
    "equipment-checkout.spec.ts",
    "equipment-leader-dashboard.spec.ts",
    "equipment-reports.spec.ts"
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
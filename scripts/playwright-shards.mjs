// Whole-spec seconds summed over browser projects. Refreshed from completed,
// successful spec results in Playwright CI #4093 (18 Oct 2026): 92 files.
// Failed/unfinished specs keep their previous estimates; no partial duration is used.
// SW-186 persona/version replacements use the latest local Chromium 151 run below.
export const measuredPlaywrightSpecSeconds = {
  "leader-navigation-contract.spec.ts": 377.8,
  "leader-navigation-personas.spec.ts": 365.6,
  "member-leader-transition.spec.ts": 100.3,
  "member-record-page.spec.ts": 99.9,
  "navigation-recovery.spec.ts": 89.3,
  "leader-navigation-accessibility.spec.ts": 87.2,
  "leader-navigation-back.spec.ts": 85.0,
  "leader-access-management.spec.ts": 71.1,
  "sw362-event-edit-navigation.spec.ts": 67.5,
  "polls.spec.ts": 66.9,
  "equipment-checkout.spec.ts": 58.6,
  "event-record-page.spec.ts": 54.9,
  "event-audience-selection.spec.ts": 52.4,
  "parent-approved-journey.spec.ts": 51.0,
  "parent-leader-context.spec.ts": 49.9,
  "leader-navigation-state.spec.ts": 45.6,
  "rover-membership.spec.ts": 45.2,
  "damaged-equipment-issues.spec.ts": 43.0,
  "weekly-meeting-date-defaults.spec.ts": 42.0,
  "adventure-skills-badgework.spec.ts": 40.5,
  "role-permissions.spec.ts": 37.5,
  "sitewide-dropdown-geometry.spec.ts": 37.5,
  "email-action-links.spec.ts": 36.4,
  "weekly-record-integrity.spec.ts": 34.9,
  "navigation-route-identities.spec.ts": 33.7,
  "weekly-meeting-navigation.spec.ts": 33.6,
  "parent-consent-visibility.spec.ts": 32.6,
  "weekly-section-tracker.spec.ts": 32.6,
  "finance-cashbook.spec.ts": 31.1,
  "leader-navigation-version.spec.ts": 28.8,
  "join-consent-record-pages.spec.ts": 28.0,
  "meeting-records.spec.ts": 25.6,
  "public-smoke.spec.ts": 24.7,
  "site-settings.spec.ts": 23.8,
  "mobile-operational-pass.spec.ts": 22.6,
  "logout.spec.ts": 22.3,
  "finance-reporting.spec.ts": 21.0,
  "member-management-targeting.spec.ts": 19.9,
  "equipment-inventory-filters.spec.ts": 19.6,
  "equipment-reports.spec.ts": 18.9,
  "sw403-programme-scouter-event-save.spec.ts": 18.2,
  "login-dashboard-routing.spec.ts": 18.1,
  "roles-permissions.spec.ts": 16.8,
  "mobile-accessibility-closeout.spec.ts": 16.4,
  "parent-login-visibility.spec.ts": 15.5,
  "subs-management.spec.ts": 15.5,
  "weekly-meeting-copy-page.spec.ts": 15.3,
  "weekly-meeting-history-access.spec.ts": 14.8,
  "weekly-planner-followup.spec.ts": 14.4,
  "leader-navigation.spec.ts": 14.3,
  "weekly-attendance-uniform.spec.ts": 14.2,
  "section-aware-cards.spec.ts": 13.9,
  "sw265-badgework-navigation.spec.ts": 13.7,
  "event-gallery.spec.ts": 13.4,
  "admin-overview.spec.ts": 13.0,
  "parent-access-management.spec.ts": 12.3,
  "detailed-inventory.spec.ts": 11.9,
  "organisation-chart.spec.ts": 11.9,
  "test-environment-smoke.spec.ts": 11.7,
  "weekly-section-tracker-history-permissions.spec.ts": 11.6,
  "loading-shell.spec.ts": 10.6,
  "poll-management-acknowledgement.spec.ts": 10.6,
  "leader-info.spec.ts": 10.3,
  "leader-journey.spec.ts": 9.9,
  "scouter-consent-inheritance.spec.ts": 9.9,
  "programme-equipment.spec.ts": 8.4,
  "activity-log.spec.ts": 8.3,
  "accessibility-baseline.spec.ts": 8.2,
  "webkit-critical-path.spec.ts": 8.1,
  "mobile-back-navigation.spec.ts": 7.8,
  "parent-portal.spec.ts": 7.6,
  "release-authorization-boundaries.spec.ts": 7.5,
  "leader-communications.spec.ts": 7.3,
  "reports.spec.ts": 7.3,
  "weekly-parent-sharing.spec.ts": 7.2,
  "equipment-leader-dashboard.spec.ts": 6.4,
  "mobile-dialog-actions.spec.ts": 6.2,
  "sitewide-tile-filters.spec.ts": 5.7,
  "consent-action-stability.spec.ts": 5.6,
  "badgework-skill-filter.spec.ts": 5.2,
  "weekly-activity-audit.spec.ts": 4.8,
  "programme-library.spec.ts": 4.7,
  "future-closed-meeting-cleanup.spec.ts": 4.6,
  "attendance-insights.spec.ts": 4.4,
  "wcag-regression.spec.ts": 4.0,
  "form-validation-focus.spec.ts": 3.9,
  "leader-navigation-info.spec.ts": 3.8,
  "password-visibility.spec.ts": 3.6,
  "weekly-meeting-copy-dialog.spec.ts": 3.4,
  "theme-parity.spec.ts": 3.0,
  "event-consent-linking.spec.ts": 2.4,
  "weekly-meeting-share.spec.ts": 2.4,
  "weekly-mobile-layout.spec.ts": 2.3,
  "mobile-consent-medication.spec.ts": 1.9,
  "finance-transfers.spec.ts": 1.8,
  "member-history-search.spec.ts": 1.7,
  "section-consent-ux.spec.ts": 1.4,
  "consent-section-symbols.spec.ts": 1.3
};

// New specs without history start at 15s until report data is available.
export const unmeasuredSpecSeconds = 15;

function specName(spec) {
  return String(spec).replaceAll("\\", "/").split("/").at(-1);
}

export function estimateSpecsSeconds(specs) {
  return specs.reduce((total, spec) => {
    const name = specName(spec);
    return total + (measuredPlaywrightSpecSeconds[name] ?? unmeasuredSpecSeconds);
  }, 0);
}

export function assignSpecsToShard(specs, shardNumber, shardCount = 2) {
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new RangeError("shardCount must be a positive integer");
  }
  if (!Number.isInteger(shardNumber) || shardNumber < 1 || shardNumber > shardCount) {
    throw new RangeError(`shardNumber must be between 1 and ${shardCount}`);
  }

  const uniqueSpecs = [...new Set(specs.map(specName))];
  const bins = Array.from({ length: shardCount }, () => ({ specs: [], seconds: 0 }));
  const weightedSpecs = uniqueSpecs
    .map((name) => ({ name, seconds: measuredPlaywrightSpecSeconds[name] ?? unmeasuredSpecSeconds }))
    .sort((left, right) => right.seconds - left.seconds || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

  for (const spec of weightedSpecs) {
    let lightestBin = 0;
    for (let index = 1; index < bins.length; index += 1) {
      if (bins[index].seconds < bins[lightestBin].seconds) lightestBin = index;
    }
    bins[lightestBin].specs.push(spec.name);
    bins[lightestBin].seconds += spec.seconds;
  }

  return bins[shardNumber - 1].specs;
}

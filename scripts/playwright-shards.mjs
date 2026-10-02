// Per-spec seconds measured from two successful full-main runs on 2026-10-01/02.
// Each estimate sums test durations from all browser projects. A PR run from
// 2026-10-01 confirmed the same high-cost specs and ordering. Refresh these
// weights from Playwright HTML reports when workload changes materially.
export const measuredPlaywrightSpecSeconds = {
  "navigation-recovery.spec.ts": 93.1,
  "equipment-checkout.spec.ts": 73.0,
  "role-permissions.spec.ts": 42.0,
  "member-record-page.spec.ts": 39.1,
  "sitewide-dropdown-geometry.spec.ts": 35.6,
  "damaged-equipment-issues.spec.ts": 35.3,
  "weekly-record-integrity.spec.ts": 34.9,
  "adventure-skills-badgework.spec.ts": 33.1,
  "weekly-section-tracker.spec.ts": 32.6,
  "parent-approved-journey.spec.ts": 29.9,
  "leader-access-management.spec.ts": 29.3,
  "event-record-page.spec.ts": 27.3,
  "meeting-records.spec.ts": 24.4,
  "mobile-operational-pass.spec.ts": 24.1,
  "email-action-links.spec.ts": 23.9,
  "join-consent-record-pages.spec.ts": 22.5,
  "member-management-targeting.spec.ts": 17.8,
  "roles-permissions.spec.ts": 17.7,
  "equipment-reports.spec.ts": 17.3,
  "subs-management.spec.ts": 17.2,
  "section-aware-cards.spec.ts": 15.8,
  "weekly-planner-followup.spec.ts": 14.4,
  "accessibility-baseline.spec.ts": 13.5,
  "leader-navigation.spec.ts": 13.0,
  "public-smoke.spec.ts": 12.3,
  "event-gallery.spec.ts": 12.1,
  "leader-journey.spec.ts": 11.5,
  "organisation-chart.spec.ts": 11.5,
  "activity-log.spec.ts": 11.3,
  "mobile-accessibility-closeout.spec.ts": 10.9,
  "leader-info.spec.ts": 10.7,
  "webkit-critical-path.spec.ts": 8.1,
  "wcag-regression.spec.ts": 7.3,
  "section-consent-ux.spec.ts": 7.2,
  "weekly-activity-audit.spec.ts": 7.1,
  "parent-access-management.spec.ts": 7.0,
  "parent-portal.spec.ts": 6.8,
  "mobile-back-navigation.spec.ts": 6.7,
  "programme-library.spec.ts": 6.7,
  "reports.spec.ts": 6.7,
  "badgework-skill-filter.spec.ts": 6.5,
  "leader-communications.spec.ts": 5.9,
  "site-settings.spec.ts": 5.9,
  "mobile-dialog-actions.spec.ts": 5.5,
  "admin-overview.spec.ts": 5.3,
  "sitewide-tile-filters.spec.ts": 5.3,
  "release-authorization-boundaries.spec.ts": 4.9,
  "attendance-insights.spec.ts": 4.0,
  "weekly-parent-sharing.spec.ts": 4.0,
  "password-visibility.spec.ts": 3.6,
  "theme-parity.spec.ts": 3.6,
  "leader-navigation-info.spec.ts": 3.2,
  "consent-section-symbols.spec.ts": 3.0,
  "logout.spec.ts": 3.0,
  "event-consent-linking.spec.ts": 2.6,
  "finance-cashbook.spec.ts": 2.6,
  "equipment-leader-dashboard.spec.ts": 2.4,
  "weekly-mobile-layout.spec.ts": 2.3,
  "mobile-consent-medication.spec.ts": 2.2,
  "finance-reporting.spec.ts": 2.1,
  "member-history-search.spec.ts": 2.1,
  "loading-shell.spec.ts": 1.9,
  "finance-transfers.spec.ts": 1.8
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

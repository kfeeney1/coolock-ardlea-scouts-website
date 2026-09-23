export type OperationalStatus = "verified" | "guidance" | "unknown";

export const SYSTEM_INFORMATION = {
  lastReviewed: "2026-09-23",
  project: {
    applicationName: "Coolock Ardlea Scouts Website",
    scoutGroup: "80th / 160th Coolock Ardlea Scouts",
    repository: "kfeeney1/coolock-ardlea-scouts-website",
    repositoryUrl: "https://github.com/kfeeney1/coolock-ardlea-scouts-website",
    defaultBranch: "main",
    productionDomain: "https://coolockardleascouts.ie"
  },
  environments: [
    { name: "TEST", projectId: "coolock-ardlea-scouts-test", data: "Synthetic test data only", deployment: "main automatically deploys after required assurance", email: "No real email", status: "verified" as OperationalStatus },
    { name: "PRODUCTION", projectId: "coolock-ardlea-scouts", data: "Real personal data; consent and medical data are sensitive", deployment: "Manual protected GitHub Actions deployment only", email: "Real email where configured", status: "verified" as OperationalStatus }
  ],
  monitoringPolicy: { backupWarningAgeHours: 168, backupCriticalAgeHours: 192, monitorFreshnessHours: 26, approval: "Technical defaults pending organisational approval" },
  services: [
    { name: "Firestore Backup", purpose: "Production Firestore export and restore assurance", scope: "PRODUCTION", identifier: "coolock-ardlea-scouts / firestore-backups", owner: "Repository maintainers", url: "https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions", secrets: ["FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION_BACKUP"] },
    { name: "GitHub", purpose: "Source control, pull requests, CI and deployments", scope: "TEST + PRODUCTION", identifier: "kfeeney1/coolock-ardlea-scouts-website", owner: "Repository maintainers", url: "https://github.com/kfeeney1/coolock-ardlea-scouts-website", secrets: ["E2E_TEST_USER_PASSWORD", "FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION"] },
    { name: "Firebase", purpose: "Hosting, Authentication, Firestore, Storage and Emulator Suite", scope: "TEST + PRODUCTION", identifier: "coolock-ardlea-scouts-test / coolock-ardlea-scouts", owner: "Owner not recorded", url: "https://console.firebase.google.com/", secrets: ["Firebase deployment service-account credentials"] },
    { name: "Resend", purpose: "Transactional email delivery", scope: "Configured email environments", identifier: "Provider account identifier not recorded", owner: "Owner not recorded", url: "https://resend.com/", secrets: ["RESEND_API_KEY"] },
    { name: "Cloudflare Workers", purpose: "Trusted email-service boundary", scope: "Email worker", identifier: "Worker identifier must be verified live", owner: "Owner not recorded", url: "https://dash.cloudflare.com/", secrets: ["Provider/API secrets managed outside the client"] },
    { name: "Hosting Ireland / DNS", purpose: "Domain registration and DNS authority", scope: "PRODUCTION", identifier: "coolockardleascouts.ie", owner: "Owner not recorded", url: "https://www.hostingireland.ie/", secrets: [] },
    { name: "Jira", purpose: "Development backlog, acceptance and operational evidence", scope: "Project", identifier: "SW", owner: "Project maintainers", url: "https://www.atlassian.com/software/jira", secrets: [] }
  ],
  serviceLimits: [
    { service: "Firestore", metrics: "reads, writes, deletes, storage, export freshness", source: "Google Cloud/Firebase provider data where authorised", thresholds: "Provider quota dependent; unknown until authoritative usage is collected", recovery: "Open Firebase/Google Cloud console and follow operations runbook" },
    { service: "Firebase Authentication", metrics: "user/provider quota", source: "Firebase/Google Cloud provider data where authorised", thresholds: "Provider quota dependent", recovery: "Review Authentication quotas and provider state" },
    { service: "Firebase Storage", metrics: "storage and transfer", source: "Firebase/Google Cloud provider data where authorised", thresholds: "Provider quota dependent", recovery: "Review Storage usage and billing" },
    { service: "Firebase Hosting", metrics: "storage and transfer", source: "Firebase provider data where authorised", thresholds: "Provider quota dependent", recovery: "Review Hosting usage and releases" },
    { service: "GitHub Actions", metrics: "workflow health, Actions/storage allowances", source: "GitHub Actions and billing/usage APIs where authorised", thresholds: "Provider plan dependent", recovery: "Inspect failed workflows and account usage" },
    { service: "Resend", metrics: "send volume, delivery failures, bounce/complaint state, domain verification", source: "Resend API where authorised", thresholds: "Provider plan/reputation dependent", recovery: "Inspect Resend operational metrics; email must not be sole alert path" },
    { service: "Cloudflare Workers", metrics: "requests, errors, execution limits", source: "Cloudflare API where authorised", thresholds: "Provider plan dependent", recovery: "Inspect Worker analytics and limits" },
    { service: "Domain / DNS", metrics: "renewal, DNS and TLS state", source: "Registrar/DNS/provider console", thresholds: "Manual/provider-specific", recovery: "Verify registrar, DNS and Firebase custom-domain state" }
  ],
  workflows: [
    { file: ".github/workflows/firestore-backup.yml", name: "Firestore Backup", purpose: "Scheduled production Firestore export", trigger: "weekly schedule, protected manual", target: "production", preMerge: false, postMerge: false, manual: true, checks: ["export"] },
    { file: ".github/workflows/firestore-backup-freshness.yml", name: "Firestore Backup Freshness", purpose: "Independent daily freshness assurance", trigger: "daily schedule, manual", target: "production", preMerge: false, postMerge: false, manual: true, checks: ["audit"] },
    { file: ".github/workflows/firestore-recovery-drill.yml", name: "Firestore Recovery Drill", purpose: "Synthetic non-production restore rehearsal", trigger: "monthly, pull request, manual", target: "emulator", preMerge: true, postMerge: false, manual: true, checks: ["recovery-drill"] },
    { file: ".github/workflows/quality.yml", name: "Quality", purpose: "Repository quality gate", trigger: "pull_request, push(main), manual", target: "local/demo", preMerge: true, postMerge: true, manual: true, checks: ["quality"] },
    { file: ".github/workflows/firestore-rules.yml", name: "Firebase Rules", purpose: "Firestore and Storage emulator Rules validation", trigger: "relevant pull_request, push(main), manual", target: "demo emulator", preMerge: true, postMerge: true, manual: true, checks: ["rules"] },
    { file: ".github/workflows/post-merge-ci-guard.yml", name: "Post-merge CI Guard", purpose: "Require exact-SHA Quality, E2E and TEST deployment evidence", trigger: "TEST deployment completion, hourly, manual", target: "main", preMerge: false, postMerge: true, manual: true, checks: ["guard"] },
    { file: ".github/workflows/firebase-hosting-merge.yml", name: "Firebase PRODUCTION Manual Deploy", purpose: "Protected production deployment", trigger: "workflow_dispatch only", target: "production", preMerge: false, postMerge: false, manual: true, checks: ["validate_and_deploy"] }
  ],
  architecture: [
    "React 19 + TypeScript + Vite client application",
    "React Router routes with authenticated leader route protection and role-aware UI",
    "Firebase Authentication with adminUsers-backed leader authorisation",
    "Firestore domain services protected by Firestore Rules",
    "Firebase Storage attachments protected by Storage Rules",
    "Separate TEST and PRODUCTION Firebase projects",
    "Trusted email worker boundary; provider credentials never belong in the browser",
    "Public, parent, leader and Super Admin experiences share the application shell"
  ],
  domains: [
    ["Public site / Join Us", "/, /join", "public/join records", "public + authorised management"],
    ["Leader access", "/leader/access", "adminUsers / organisationLeadership", "admin/group leadership"],
    ["Parents & families", "/parent, /leader/parent-access", "parent/family records", "parent + authorised leaders"],
    ["Members / consent / medical", "/leader/members, /leader/consents", "member/consent records", "authorised leaders; sensitive data"],
    ["Meetings / attendance / badgework", "/leader/weekly, /leader/meetings, /leader/badgework", "meeting and badgework records", "section/group permissions"],
    ["Events / activities", "/leader/events", "event records", "section/group permissions"],
    ["Communications", "/leader/communications", "email worker", "authorised leaders"],
    ["Finance / floats", "/leader/subs, /leader/finance", "finance records", "finance/group permissions"],
    ["Equipment / stores", "/leader/equipment", "equipment records", "role/section permissions"],
    ["Policies / reports", "/leader/policies, /leader/reports", "documents/report services", "audience + role permissions"],
    ["Super Admin", "/leader/system", "repository documentation only", "Super Admin only"]
  ],
  parkedWork: [
    "SW-164 Hall Hire — PARKED. Do not develop without separate organisational approval.",
    "SW-41 adult/leader Join Us — blocked pending stakeholder discussion.",
    "SW-79, SW-80 and SW-86 — organisational approval required."
  ],
  security: [
    "TEST uses synthetic data only; never copy production data into TEST.",
    "Production contains real personal data; medical and consent information is sensitive.",
    "Firestore Rules and Storage Rules are security boundaries; UI visibility is not authorisation.",
    "Never expose passwords, private keys, service-account JSON, secret/token values, cookies, private email content or personal application logs.",
    "Automated tests must not write to production.",
    "Preserve stable identifiers, audit history and historical/immutable records where applicable."
  ],
  operations: [
    "Local setup and operational recovery: README.md and docs/operations-runbook.md.",
    "Playwright: docs/playwright-testing.md and docs/playwright-role-testing.md.",
    "Production readiness: docs/production-readiness.md and docs/stage-19-launch-readiness-review.md.",
    "Backups/recovery: docs/firestore-backup-recovery.md.",
    "Production deployment remains manual and protected; do not automate it as part of routine development.",
    "For live status, query GitHub Actions, Firebase deployment evidence and Jira rather than trusting static ticket or SHA text."
  ]
} as const;

export function buildAiHandoverPrompt(): string {
  const d = SYSTEM_INFORMATION;
  return `# Coolock Ardlea Scouts — AI Development Handover

Repository: ${d.project.repository}
Documentation last reviewed: ${d.lastReviewed}

You are continuing authorised development of this repository. Static documentation is guidance, not live authority. Before acting, verify current Jira, GitHub and deployment state.

## Mandatory baseline
Verify current main SHA, open PRs, recent merges, required PR checks, exact-SHA post-merge Quality/E2E/TEST-deploy evidence, Firebase TEST deployed revision, production deployed revision, and the current Jira board. Do not trust embedded historical SHAs or ticket statuses.

## Environment model
TEST and PRODUCTION are separate Firebase projects. TEST is ${d.environments[0].projectId} and contains synthetic data only. PRODUCTION is ${d.environments[1].projectId} and contains real personal data. main auto-deploys to TEST through the repository's protected workflow model. Production deployment is manual and protected. Never copy production data into TEST.

## Delivery workflow
Create a focused feature branch. Inspect Jira, related code and existing implementations before editing. Implement cohesive work blocks rather than duplicate patches. Update Playwright coverage with product changes. Run formatting/linting, TypeScript/build, unit/component tests, Rules/emulator checks and the complete required PR E2E command. Open one focused PR, monitor and repair CI, and merge only after required checks pass. After merge, verify exact-SHA post-merge Quality, full E2E and Firebase TEST deployment, then reconcile Jira. Defer production manual tests unless explicitly authorised.

## Security and data integrity
Do not weaken Firestore or Storage Rules. Do not expose secrets or add secret-reading browser APIs. Never use production personal data for tests. Preserve medical, consent, financial and audit integrity. Use stable IDs. Make multi-record writes atomic or idempotent where appropriate and preserve historical records. Production writes and destructive actions require the existing safeguards and explicit authority.

## Roles
Respect Super Admin, Group roles, section roles, parents and public users. Leaders can hold multiple appointments and sections; permissions must reflect the union of legitimate assignments without accidental privilege escalation.

## Product domains
${d.domains.map(x => `- ${x[0]}: ${x[1]}`).join("\n")}

Inspect existing implementations before building anything new. Search Jira for duplicates before creating a ticket. Preserve mobile, keyboard, screen-reader and browser/Android Back behaviour. Treat dropdown geometry, scroll stability and transient-UI dismissal as protected regression areas.

When a task authorises full implementation, do not stop after analysis or merely opening a PR: continue through authorised CI/merge/TEST/Jira steps. Stop and report when blocked by missing permissions, required organisational decisions, protected production approval, unavailable credentials, or destructive production actions requiring confirmation.

## Parked / blocked work
${d.parkedWork.map(x => `- ${x}`).join("\n")}

In particular, do not develop SW-164 Hall Hire unless the user separately authorises it after organisational decisions are made.

No credentials are contained in this handover. Live GitHub, Firebase and Jira state is authoritative over this static documentation.
`;
}

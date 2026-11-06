# SW-242 external service assurance and recovery

Verified/reviewed **6 November 2026 (UTC)**. This is a dated investigation, not a live health feed. SW-114 remains Done with its 29 September PMT pass. SW-164 Hall Hire remains paused; none of this work enables, deploys or changes Hall Hire.

## Evidence and access

Repository baseline: `7ccde0e698b6142895fbe30b7bb4a8da9ac3286e`. No applicable AGENTS.md was found in the checkout or workspace ancestors. Jira epic/related work/comments, current main, open PRs, deployment workflows and existing monitoring/recovery/email runbooks were reviewed before changes. Existing infrastructure is reused.

| Evidence checked | Result and limitation |
| --- | --- |
| Firebase identities/configuration | `.firebaserc`, `src/firebase.ts`, `firebase*.json` pin TEST `coolock-ardlea-scouts-test` and PRODUCTION `coolock-ardlea-scouts`; local is `demo-coolock-ardlea-scouts`. Client rejects mismatched project identities. Repository configuration is not provider account-plan evidence. |
| Stable TEST metadata | Read-only GET `/build-info.json` returned main `7ccde0e6`, environment `test`, built 6 November. This verifies existing deployment metadata only, not authenticated functionality or these unmerged PRs. |
| GitHub baseline assurance | Quality [42215826249](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/42215826249), E2E [42215826332](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/42215826332), Rules [42215826258](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/42215826258), TEST [42215826340](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/42215826340) and post-merge guard [42216319180](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/42216319180) succeeded for baseline main. |
| Backup workflows | Weekly export [41297515021](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/41297515021), 1 November: success. Daily freshness [42223871321](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/42223871321), 6 November: inspection and publication/readback steps succeeded. Monthly synthetic recovery [41301548162](https://github.com/kfeeney1/coolock-ardlea-scouts-website/actions/runs/41301548162): success. These are execution evidence; no live restore was performed. |
| Cloudflare read-only API | Canonical email Worker exists, production delivery mode, production Firebase identity, daily `0 8 * * *` schedule. Legacy suffixed `-production` Worker also exists with no cron. Do not remove it without independently checking routes/dependencies. Hall TEST Worker exists and remains paused/out of scope. Account default and email Worker `usage_model=standard` are not proof of a Free subscription. |
| Cloudflare subscription access | Account subscriptions GET returned 403. Connector states OAuth cannot cover that endpoint; a separately scoped Billing Read API token or owner console evidence is required. No token was requested, read or committed. Plan, spend, quota usage and provider alerts remain unverified. |
| Resend usage API | Account aggregate snapshot: daily 0/100 (reset 6 November 23:59:59.999Z); monthly 3/3,000 (reset 21 November 16:48:28.206Z); rate limit 10 requests/1,000ms. These are account-wide retrieved limits, not an inferred plan name, environment-specific app usage or a durable live feed. Daily zero is verified zero. |
| Resend domain/webhooks | Group sending domain verified, sending enabled, receiving disabled; read-only list returned **zero webhooks**. Verification does not establish delivery, reputation or absence of suppressions. No message, address, subject, provider credential or webhook secret was retrieved for this audit. |
| Google Cloud / registrar access | No authenticated GCP CLI/service account or GCP connector is available in this workspace. No authenticated registrar access. Current billing plan, IAM, budgets, alert destinations, adjusted quotas, bucket location/classes/lifecycle, actual workloads and domain renewal remain unknown. Historical Blaze references are not current account verification. |

## Dependency inventory

Owner for infrastructure is the repository/account maintainer; formal operational ownership and secondary responders are not verified. “Unknown” below never means healthy or zero. TEST and PRODUCTION must be checked separately in their own project consoles. Shared Resend/Workers/GitHub account allowances must not be attributed wholly to either environment.

| Dependency / purpose | Configuration and available evidence | Quota/billing behaviour and failure impact | Coverage / recovery |
| --- | --- | --- | --- |
| Firestore / app records, indexes | Both Firebase projects; Rules enforce access. Console usage, API quota and Cloud Monitoring metrics available with appropriate access; none collected by this browser. | Document ops/storage/index/API limits differ from free allowances. Generic free daily quota is not a Blaze spending cap. Exhaustion or API limits can reject reads/writes. Actual adjusted limits and plan unknown. | Configuration alone now unavailable; inspect project usage/errors, reduce accidental fan-out, preserve failed changes for safe retry. |
| Firebase Authentication / sign-in and recovery | Both projects, Auth SDK; provider/IP/operation-specific limits and Identity Platform status require console evidence. | Throttling can reject sign-in/account recovery independently of database health. Plan/provider-specific limits must not become one overall percentage. | No privileged health collector. Inspect auth error category/provider status; avoid login retry loops and preserve account access controls. |
| Firebase Hosting / site, TEST previews and releases | Separate project targets; successful workflow/build metadata. | Published reference: 10 GB hosting storage and 10 GB/month transfer at no cost; Blaze overage can incur charges. Stored releases consume project storage. These are reference allowances, not verified remaining capacity. | Existing deploy/smoke/guard workflows. Compare approved commit, release and build metadata; investigate quota before deleting releases or retrying. |
| Cloud Storage / attachments and backup objects | Both projects; production backup bucket pinned in workflow. Rules/CORS are separate from service health. | Storage, operations, retrieval and network costs depend on location/class; current settings unknown. Capacity or request denial affects attachments and backup assurance. | Daily backup check does not monitor all attachments. Inspect targeted object/bucket permissions and project usage; never bulk-download personal files for a health check. |
| Functions / other GCP workloads | `functions/` contains TEST event backend. `maintenance-functions/` is deployment-blocked by existing predeploy guard; app uses existing Worker paths. Firebase Hosting `/api` routing and deployment selections must be read per environment. Actual deployed GCP inventory is not accessible. | Functions, Cloud Run, builds, Artifact Registry, Scheduler/PubSub/Eventarc and Logging can have separate limits/costs where enabled. Source code is not proof that any resource is deployed or absent. | No new deployment/API enabling. Inspect actual regional functions/services, triggers, max instances, invocations, errors, container storage and logging exclusions/retention before making health or zero-cost claims. |
| Cloudflare email Worker / trusted backend and reminders | Canonical production Worker and daily cron verified above; handles email and other authorised backend work. | Conditional Free reference: 100,000 requests/day, midnight UTC reset; CPU/subrequest limits are invocation constraints. Current plan unverified; do not calculate remaining Free allowance. | No automatic analytics feed in app. Review Worker requests/errors/CPU and cron results in protected console. Check canonical name before rollback; never deploy the safe-default TEST config over production. |
| Resend / transactional delivery | Server-side existing integration, verified sending domain and API account snapshot above. | Daily/monthly windows are separate; whichever allowance exhausts first can block sending. Rate-limit 429 needs bounded backoff, quota exhaustion needs reset/remediation. Delivered/reputation health cannot be inferred from send acceptance. | SW-108 deliverability runbook remains canonical. No webhooks currently configured: bounce/complaint/suppression/event health is a gap. Use provider console and existing application error reporting; do not send test mail. |
| GitHub Actions / CI, TEST deployment, protected production, backups | Public repository verified via connected API; standard Ubuntu runners, pinned actions and lockfiles. Existing guard checks exact main SHA. | Standard hosted runners in public repositories do not consume included compute usage. Artifact/cache storage and larger runners have separate rules. Account budgets, notification settings and current storage are unknown. API rate limits can block guard checks. | Actions/check pages are an external channel independent of Firebase/email. Notification delivery/subscriber settings are unverified. Inspect failed steps and credential scopes; preserve exact-SHA gates and protected production approval. |
| npm, GitHub Actions publishers, SDK/tool distribution | Lockfiles, pinned action SHAs, dependency audits; firebase-tools, Node/Java and browser downloads needed by assurance/deploy jobs. | Registry outage, package/advisory changes or tool/runtime incompatibility can block CI. No account usage meter in app. | Existing Quality/supply-chain checks. Repair documented tool versions or demonstrated defects; never weaken tests, ceilings or deploy gates to bypass an outage. |
| Backups / recovery | Existing weekly export, daily independent inspection, monthly synthetic drill; two minimal Firestore observations. | Exports read documents and retain billed objects under provider rules; restore has costs and data integrity consequences. Existing workload only, unchanged. Freshness is not proof of restorable completeness. | 168h warning / 192h critical; monitor daily evidence max age 26h, weekly execution 192h. Failed publication remains failed and previous evidence expires. See recovery steps below and existing recovery runbook. |
| Registrar, DNS, TLS / public reachability | HostingIreland identified in existing documentation; Firebase custom domain configuration requires live review. | Renewal/expiry and DNS failure can disable public reachability independent of Firebase health. Provider contract/expiry unknown. Managed certificate issuance can still fail due to DNS. | Manual console/status review; use days remaining after expiry is verified, never a usage percentage. Preserve DNS records and account ownership. |

No additional critical paid API was identified in the source/configuration reviewed. This is not a claim that the inaccessible GCP account contains no other resources. Jira is delivery evidence, not a runtime dependency.

## Sources and threshold decisions

All links below were checked through authoritative provider documentation on **6 November 2026**. Recheck on plan/provider changes and at the next operations review; account values require separate verification. Published limits must remain configured references unless retrieved for this account, metric, period and environment.

- [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) and [billing](https://firebase.google.com/docs/firestore/pricing): usage console/API quota sources; free allowances versus chargeable operations. Do not label free allowance exhaustion as a universal service shutdown.
- [Authentication limits](https://firebase.google.com/docs/auth/limits): provider and operation constraints; investigate the specific failed operation.
- [Hosting usage/pricing](https://firebase.google.com/docs/hosting/usage-quotas-pricing): project storage and monthly transfer allowances/overages.
- [Cloud Storage pricing](https://cloud.google.com/storage/pricing): storage, processing and transfer components; location and storage class matter.
- [Functions quotas](https://firebase.google.com/docs/functions/quotas): resource, time, API and networking limits; billing and container-storage implications.
- [Firebase billing safeguards](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills): alerts-only budgets do not stop services. Provider documentation now describes service-specific spend-cap budgets for some services; no cap was verified or configured here, and this does not establish a Firestore/Storage/Hosting cap.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): conditional Free request reference and invocation limits. `standard` usage model is not subscription evidence.
- [Resend account usage API](https://resend.com/changelog/account-usage-api): supported `GET /usage`, account-wide windows/reset times and retrieved limits; full-access key requirement. Do not broaden a sending credential solely to add monitoring.
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) and [budgets/alerts](https://docs.github.com/en/billing/concepts/budgets-and-alerts): runner/storage distinctions and provider notifications; account configuration must be checked separately.

70% Notice, 85% Warning and 95% Critical are sensible **only** for finite positive capacity/volume limits with nonnegative usage, a matching scope/window and known provenance. At 100%, the reader uses Exhausted only for an explicitly identified hard cap (`limitKind=hard-cap`); consumed allowance/reference values remain Critical without claiming service exhaustion. A configured reference must be labelled, not mistaken for a retrieved account cap. No percentage is shown for an unknown limit. Reset expiry must invalidate old window data. Current PR classifies numeric thresholds but introduces no quota collector or real alerts.

Do not apply that model to backup age, TLS/domain expiry, instantaneous CPU/concurrency, request bursts, bounce/complaint rates, an uncapped paid usage allowance or a financial budget. Use hours/days, provider-defined reputation criteria, direct failure signals or separately labelled spend. The Resend snapshot gives meaningful daily/monthly usage fractions only at its retrieval time; it is not embedded in the UI as current usage.

## Gap analysis and cost boundary

SW-573/#971 addresses indefinitely trusted Healthy states, malformed timestamps/environments, environment mixing, unverified limit provenance and misleading configuration health. It labels partial coverage. SW-574/#972 corrects fabricated zero age and distinguishes failed inspection from verified absence while preserving failure/readback enforcement. SW-575 records this investigation/runbook. None reopens SW-114 or claims new PMT.

No new platform, subscription, billable resource, API enabling, provider collection job or scheduled workload is introduced. Existing backup/export frequencies, IAM, destinations and retries are unchanged. Page freshness timers only evaluate in-memory evidence; they do not poll providers or Firestore. Existing observation reads and publication/readbacks remain the only runtime monitoring operations. Synthetic browser fixtures run only in the local demo emulator and are removed after the test. Existing PR CI runs on the repository's standard public runners; normal existing artifact retention applies.

A continuous Resend/GCP/Cloudflare collector is **not implemented**: connected read access is not a deployable least-privilege runtime credential, and extra Firestore writes/Worker subrequests/Actions storage cannot be guaranteed cost-free merely because volume is small. A collector must reuse an existing execution only after scopes, windows, free headroom and destinations are concretely verified. No arbitrary HTTP monitoring target, new cron, metrics platform or paid notification channel is approved.

Remaining gaps:

1. GCP: read-only project inventory/usage/quota access separately for TEST/PRODUCTION; linked billing plan and budget/alert configuration evidence, bucket lifecycle and actual enabled server workloads. Do not copy service-account JSON into Jira or chat.
2. Cloudflare: Billing Read token or owner console confirmation of Workers subscription; analytics/cron health evidence and configured alert coverage. Existing legacy Worker needs route/dependency review before any retirement.
3. Resend: continuous aggregate usage/reputation/event ingestion unavailable; zero configured webhooks. An existing receiver and a safe aggregate-only event mapping plus allowed destination must be agreed before setup; no test message/event is authorised.
4. GitHub: account billing/storage usage and account notification subscriptions/destinations are not exposed by the repository connector. Workflow success does not prove someone receives failures.
5. Registrar: expiry, DNS ownership and renewal notification destination are unverified. Managed restore in a non-production target still needs separate planned authorisation and cost assessment; synthetic drill is not that evidence.

## Practical incident response

For every incident: identify environment/project/service first, record UTC time, safe error category and workflow/commit reference, and check provider status plus the protected console. Never paste raw response bodies, tokens, recipients, private paths or member data. Use existing GitHub failure/check visibility and configured provider channels. Do not send a message or test email without explicit authorisation. If destinations are unknown, record the gap instead of inventing one.

### Quota, billing or rate-limit failures

1. Determine whether this is a hard quota, per-second 429, daily/monthly window, no-cost allowance or billing issue; check actual account settings and reset time. Preserve edits and avoid repeated submissions.
2. For transient rate limits respect provider retry-after and existing bounded/idempotent retry paths; do not repeatedly rerun bulk sends or deployments. For exhaustion, pause unnecessary load through existing authorised feature controls and wait for the verified reset or prepare a code efficiency fix.
3. Check both project and shared account usage. Do not upgrade plans, request paid quota or disable billing automatically. Prepare cost consequences for an owner decision if recovery cannot stay within existing infrastructure.
4. After recovery, verify the original operation safely, refresh observations and check source/time. Do not replace missing metrics with zero or silently keep old green snapshots.

### Email failure

1. Distinguish Worker authentication/configuration, Worker runtime limit, Resend rate/quota rejection, unverified domain and deliverability failures. Check canonical Worker and production mode/project without reading secret values.
2. Inspect aggregate provider counters/status and existing SW-108 deliverability guidance. No webhook configuration means event health is unknown, not zero bounces or complaints.
3. Preserve existing send/idempotency records before retry; provider acceptance is not delivery. Never resend a whole batch blindly. Repair the specific secret/configuration through existing protected deployment procedures; no test email without separate authorisation.
4. Report email incidents through existing non-email GitHub/check visibility or an already configured external channel. Do not rely on the failing email provider as its only warning channel.

### Backup failure or stale monitoring

1. Inspect **both** Firestore Backup and Firestore Backup Freshness Actions. Determine export failure, missing completed-export metadata, inaccessible bucket, stale backup, failed observation publication or stopped scheduling.
2. Verify scheduled workflow enablement and least-privilege `production-monitoring` environment credential/IAM through existing administrative procedures. Do not add deployment/admin privileges to fix a monitoring 403.
3. Inspect only timestamp prefixes and completion metadata, not backup contents. Warning after 168h and critical after 192h remain unchanged; a daily observation older than 26h is unavailable. An execution success alone does not prove current freshness.
4. If an export is actually required, use the existing protected backup workflow only with appropriate operational authorisation and cost awareness. This investigation did not dispatch it. Preserve previous exports and retention policy.
5. Use [Firestore backup recovery](../firestore-backup-recovery.md) for restore decisions. Select intended source/target, assess overwrite/cost risk and get the required operational authorisation before a managed import. Never import production personal data into TEST.
6. If publication fails, the Actions job remains failed. Repair access and verify authenticated write/readback on the next authorised run; never backdate an observation to make it fresh.

### Deployment or supply-chain failure

1. Read failed Quality/E2E/Rules/build/deploy steps for the exact commit. Separate provider outage/rate limit, authentication, Firebase configuration, npm/tool version and application failures.
2. Keep production deployment manual. Do not use another project's credential, disable Rules, increase ceilings, skip tests or rely on retries for a pass.
3. Restore purpose-scoped credentials or fix demonstrated code/configuration problems in a focused PR. Inspect standard runner, artifact retention and quota/budget configuration if Actions is blocked.
4. After an owner merge, require exact-SHA main Quality/E2E/TEST deployment and guard evidence. Check TEST build metadata and authenticated synthetic behaviour before planning a protected production release/rollback. A successful build is not production acceptance.

### Domain/DNS/TLS failure

Check authoritative registrar/DNS and Firebase custom-domain certificate state. Preserve the last known records; renew or change paid services only through owner-authorised actions. Verify DNS/certificate propagation and public reachability separately from application authentication/database health.

## Validation and manual acceptance

Development/CI: run required Quality checks, synthetic observation/payload tests, Super Admin Rules tests and desktop/mobile browser checks. Local emulator requires Java 21+; this workspace has Java 17, so emulator/browser integration cannot be represented as executed here. CI must run the repository's configured compatible runtime. Required checks must pass for final PR heads.

Live TEST: baseline public build metadata was verified, but no authenticated TEST credentials are available and unmerged PRs are not deployed to stable TEST. After owner merges, verify exact deployed SHA and use synthetic observations in TEST only.

Manual plan: Super Admin opens dashboard/System Information in mobile and desktop supported themes; configuration alone is not Healthy; zero is visibly different from missing/failed/stale; each row has environment/source/time and limit provenance; production rows in TEST cannot contribute healthy state; failed refresh clears old green results; partial coverage warning remains. Verify ordinary leader/parent/public denial. With synthetic fixtures exercise 70/85/95/100 and invalid limits, stale/future timestamp, unknown source, failed backup inspection and ageing backup. Do not alter production monitoring records to simulate failures. Retain separate post-merge TEST and owner production PMT results in Jira.

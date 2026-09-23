# Operational monitoring inventory

Last reviewed: 2026-09-23. This file is version-controlled operational metadata; live provider consoles, GitHub Actions and authenticated monitoring observations are authoritative.

## Status model

Healthy, Warning, Critical, Unknown, Unavailable and Not applicable are supported. Backup assurance additionally uses Missing. Unknown, Missing and Unavailable are never converted to Healthy. Overall aggregation is fail-closed: Critical/Missing wins, then Warning; Unknown/Unavailable remains visible.

Backup technical defaults are Warning after 168 hours, Critical after 192 hours, and monitoring evidence stale after 26 hours. These defaults are pending organisational approval and are not a retention policy.

## Inventory

| Service | Scope | Purpose | Owner | Metrics/source | Limits/thresholds | Refresh | Impact / recovery | Secret names |
|---|---|---|---|---|---|---|---|---|
| Firestore Backup | PROD | managed export/recovery | repository maintainers | backup workflow + independent freshness workflow via unattended `production-monitoring` environment | 168h warning / 192h critical; 26h monitor freshness | backup weekly; assurance daily | data-recovery exposure; inspect workflows/runbook | FIREBASE_SERVICE_ACCOUNT_COOLOCK_ARDLEA_SCOUTS_PRODUCTION_BACKUP |
| Firestore | TEST+PROD | application database | owner not recorded | Google Cloud/Firebase usage API when authorised | provider/plan dependent; otherwise Unknown | provider dependent | availability/data writes; Firebase console/runbook | deployment service-account credential names only |
| Firebase Auth | TEST+PROD | authentication | owner not recorded | provider quota/status where authorised | provider dependent | provider dependent | sign-in failure; Firebase console | deployment service-account credential names only |
| Firebase Storage | TEST+PROD | attachments/assets | owner not recorded | provider usage where authorised | provider dependent | provider dependent | attachment failure; Firebase console | deployment service-account credential names only |
| Firebase Hosting | TEST+PROD | web hosting | owner not recorded | provider usage/deployment evidence | provider dependent | deploy/periodic | site availability; Firebase console | deployment service-account credential names only |
| Emulator Suite | local/CI | safe test isolation | repository maintainers | CI workflow results | Not applicable | each CI run | test assurance loss; repair CI | none |
| GitHub Actions | BOTH | CI/deploy/schedules | repository maintainers | GitHub Actions workflow evidence; account usage where authorised | plan dependent | each run/provider | assurance/deploy failure; Actions console | E2E_TEST_USER_PASSWORD plus named deployment credentials |
| Resend | configured email environments | transactional email | owner not recorded | supported Resend API metrics/domain state where authorised | plan/reputation dependent | provider dependent | email delivery failure; Resend console/runbook | RESEND_API_KEY |
| Cloudflare Workers | email boundary | trusted email worker | owner not recorded | supported Cloudflare analytics/API where authorised | plan dependent | provider dependent | email boundary failure; Cloudflare console | provider/API secret names only |
| Hosting Ireland / DNS | PROD | domain/DNS | owner not recorded | registrar/DNS/provider console | renewal/provider dependent | manual/provider | domain outage; registrar + Firebase custom-domain checks | none recorded |
| Jira | project | backlog/evidence | project maintainers | Jira live issue state | Not applicable | on reconciliation | loss of delivery evidence; Jira | connector-managed |

Management links are defined once in `src/operations/systemInformation.ts`. Do not duplicate credentials or private account/billing identifiers in this inventory.

## Collection architecture

Privileged provider credentials never enter the browser. The `operationalMonitoring` Firestore collection contains only allowlisted aggregate observations and is client-readable only by Super Admin. Trusted service accounts may write through provider APIs; Firestore Rules deny client writes. The backup and freshness workflows publish privacy-safe observations after authenticating server-side. If authentication itself is unavailable, the observation eventually becomes stale and the UI reports Unknown/Unavailable rather than Healthy.

The backup credential is stored only in the `production-monitoring` GitHub
environment. That environment has no required reviewers and no application
deployment credential, so schedules run unattended without weakening the
manual approval on the separate `production` deployment environment.

Other providers remain documented/static until a supported least-privilege server-side collection path is justified. Their missing live usage is intentionally Unknown rather than fabricated. Do not scrape provider HTML.

## Recovery and review

Every observation must identify its source and observation time. Provider failures must retain an explicit non-healthy state. Management links point to protected provider consoles; remediation guidance never contains credentials. No production email or external alert is sent from TEST/CI.

Restore procedure and limitations are in `docs/firestore-backup-recovery.md`. A managed restore is not verified merely because the emulator recovery drill passes.

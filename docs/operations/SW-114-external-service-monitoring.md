# SW-114 — External service limits and operational monitoring

## Evidence model

Every service metric must be labelled as one of: **authoritative live usage**, **provider-console alert**, **locally measured**, **configured reference**, or **unknown/unavailable**. Never infer provider usage from configuration alone, and never expose provider credentials or billing identifiers to the browser.

## Active service inventory

| Service | Purpose / environment | Limit evidence available to this repository | Monitoring approach | Operator action |
| --- | --- | --- | --- | --- |
| Firebase Authentication | User authentication; TEST and PRODUCTION | Provider-managed quotas; no privileged usage API is called by the client | Provider console / configured reference until a least-privilege server collector is approved | Review Firebase console quotas and auth errors |
| Cloud Firestore | Application data; TEST and PRODUCTION | Application detects quota/resource-exhausted failures; provider quota remains external | Locally observed failures plus provider console | Review Firestore usage/quota and read/write pressure |
| Firebase Storage | Attachments, images and backup bucket; TEST and PRODUCTION | Bucket configuration is known; capacity/transfer usage is not authoritative in the client | Provider console; backup freshness has a separate trusted workflow | Review Storage usage and backup workflow |
| Firebase Hosting | Web hosting / TEST previews / PRODUCTION | Deploy success is available in GitHub; transfer/storage usage is provider-side | GitHub deployment evidence plus provider console | Review Hosting usage and deploy failures |
| Google Cloud / Firestore export | Production backup/export | Backup destination and maximum age are repository-controlled; actual latest export requires authenticated GCP access | Scheduled Firestore Backup Freshness workflow | Restore the production backup credential/IAM if the workflow cannot authenticate |
| Resend | Production email delivery | Delivery events are handled by the existing email architecture; plan allowance/rate data is not exposed to the frontend | Provider console / webhook evidence; server-side collector only if later authorised | Review sending allowance, bounces, complaints and suppression state |
| Cloudflare | Email/backend edge infrastructure where configured | No trustworthy quota feed is exposed to the application | Provider console / manual verified reference | Review Worker/request limits and error events |
| GitHub Actions | CI, release and deployment automation | Workflow results are authoritative for executions; plan minutes/storage are account-side | GitHub UI/provider alerts | Review Actions usage, artifacts and failed workflows |
| Hosting Ireland / domain services | Domain/DNS administration | Renewal/contract limits are not exposed through the application | Manual verified reference with review date | Verify domain renewal/DNS ownership in provider console |

## Security boundary

Privileged provider APIs must not be called directly from the React application. A future live-usage collector must run server-side with least-privilege credentials, explicit TEST/PRODUCTION targeting, bounded retries, cached last-known-good values, safe redaction, and idempotent alerting. CI must use synthetic/mocked provider responses and must not generate production alerts.

## Threshold semantics

Percentage-based quotas may use Notice 70%, Warning 85%, Critical 95%, Exhausted 100% when those thresholds are meaningful. Backup freshness uses its established maximum-age threshold instead. Domain expiry should use days remaining. Email reputation must use provider-defined bounce/complaint semantics rather than invented percentages.

## Current monitoring gaps

Provider plan/tier, billing allowance and current usage cannot be treated as authoritative without provider-side access. These values must remain **unknown/unavailable** in the product rather than guessed. Adding live collection requires explicit provider credentials/scopes and should be done independently for each provider so a failure in one adapter cannot block the operational-health page.

## Retention and privacy

Normalised operational snapshots must contain no member/parent/leader personal data and no raw provider responses when a metric is sufficient. Retention duration for any future historical snapshots requires alignment with SW-80 before production persistence is enabled. The service inventory should be reconciled with SW-86 before organisational approval.

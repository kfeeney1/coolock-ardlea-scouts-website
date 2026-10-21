# SW-521 Maintenance rollout

SW-334 is integrated on main via PR #901. Maintenance uses the same Auth, Firestore and Storage SDK services as the website. No new Functions, Cloud Run, Cloud Build or Artifact Registry deployment is required. Existing Firebase usage can still be metered; this is not a guarantee of a zero bill. The explicit maintenance Functions deployment block remains mandatory.

## Setting and safe defaults

Sign in as an active Superuser, open Leader Dashboard → Superuser Settings (`/leader/settings`) → Maintenance. Refresh responsible leaders after canonical access or appointment changes. Select **Maintenance enabled** to opt in. The independent `siteSettings/maintenanceExperience` document stores `version`, `sdkRevision: 1` and actor/time audit fields. Missing configuration, disabled configuration and legacy enabled configuration without revision 1 all remain disabled. Other redesign settings are unchanged.

Only the existing recognised local, TEST and Production Firebase environment/project pairs can use this runtime. Configuration changes require an active Superuser in Security Rules. Membership, canonical leader eligibility, assignment, document access and task writes remain independently authorised by backend rules.

## Acceptance and rollback

This code change does not enable either live environment. Under SW-522, verify the exact deployed TEST application and rules, then deliberately enable TEST for controlled acceptance. Production remains disabled until TEST acceptance and deliberate rollout. Development checks and CI are not live TEST acceptance or Production Manual Testing.

Select **Maintenance disabled** to roll back. Navigation disappears and direct routes show the disabled state; Firestore maintenance operations are denied. Tasks, metadata and files are retained, allowing later re-enablement. Storage independently enforces canonical member authorisation: disabling the rollout does not revoke an authorised member's access to a previously known object path. Revoking membership does revoke that access.

SW-522 tracks deployed TEST verification, desktop and Android screenshots, and owner-recorded Production Manual Testing. Do not mark the epic or children Done from implementation or CI alone.

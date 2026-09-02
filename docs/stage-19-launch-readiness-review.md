# Stage 19 launch-readiness review

Reviewed against `main` after Stage 19.6.

## Decision

**Stage 19 engineering controls are substantially complete, but the site should not yet be labelled fully launch-ready.**

The remaining blockers are operational or repository-setting dependencies rather than reasons to weaken application security, provenance checks, retention controls, or deterministic tests.

## Readiness scorecard

| Area | Status | Evidence / remaining action |
| --- | --- | --- |
| Architecture | Ready | The Vite/React/Firebase architecture remains appropriate. Firestore Rules remain the authoritative client-data security boundary; public/parent projections and presentation-only themes remain the required pattern. |
| Authentication / RBAC | Ready in code | System roles, section scoping, explicit parent/member links, Rules emulator coverage and browser role journeys form the current baseline. Do not replace Rules enforcement with UI-only checks. |
| Security / privacy | Ready in code | Sensitive child, medical, consent and emergency information remains excluded from URLs, general audit descriptions and telemetry. Stage 19.4/19.5 add explicit retention, export and offboarding boundaries. |
| Data compatibility / provenance | Blocked operationally | Production TEST-data cleanup remains deliberately parked. The existing provenance audit must remain strict; cleanup must resume only through the guarded Stage 18.16 process with exact manifest/count confirmation and a verified recent backup. |
| CI / merge governance | **Blocker** | GitHub currently reports `main` as unprotected and the repository has no active/evaluating ruleset. Quality and other checks can run, but repository settings do not yet make them mandatory before every merge or prevent an ordinary direct push. Configure branch protection or a repository ruleset and run `Branch Protection Audit` manually. |
| Deployment evidence | Ready in code | Stage 19.1 validates `/build-info.json` and post-deploy commit identity. Production release confidence still depends on the post-deploy smoke passing for the deployed commit. |
| Operational health | Ready | The super-admin health panel exposes only non-sensitive deployment/capability state and does not introduce a privileged client-side security boundary. |
| Backup / recovery | Partially ready | Scheduled backup and a deterministic emulator restore rehearsal exist. A real managed non-production Firestore import remains required before claiming managed restore permissions/project-location compatibility have been proven. |
| Storage-backed attachments | **Unavailable by design** | Production Storage remains disabled under the current no-Blaze constraint after the availability probe returned 404. Gallery/receipt attachment readiness must not be claimed until a supported storage path is selected, enabled and security-tested. Core non-attachment functionality can remain deployable. |
| Reporting / read discipline | Ready | Stage 19.6 protects dashboard/report query fan-out, aggregate-count use, caching and snapshot reuse without silently truncating operational data. |
| Accessibility / frontend resilience | Ready baseline | Representative public, parent and leader routes have semantic/accessibility regression coverage, route-level code splitting remains in place, and the root error boundary prevents a blank application on unexpected render failure. |
| Deterministic testing | Ready | Unit, Rules emulator and seeded Playwright layers remain separate from production data. Production data must never become the source of browser-test fixtures. |
| Retention / offboarding | Ready governance baseline | Stage 19.4 prohibits invented automatic deletion policy; Stage 19.5 separates access revocation from historical-data deletion and constrains exports. |

## Launch blockers

### 1. Protect `main`

This is the clearest outstanding release-governance blocker. Configure GitHub branch protection or an active repository ruleset so changes go through pull requests and the merge-critical checks cannot be bypassed accidentally. At minimum preserve required Quality, Playwright and Firebase Rules gates. Keep production Hosting deployment as the post-merge release path.

After configuring it, manually run **Branch Protection Audit** and retain the passing run as evidence.

### 2. Complete the parked production TEST-data cleanup before treating provenance as clean

Do not solve this by weakening the provenance audit, renaming historical TEST records, or adding a CI purge. Resume the Stage 18.16 guarded cleanup from a trusted local environment when laptop access is available: dry-run, exact project confirmation, exact expected counts, exact target-manifest hash, verified recent backup, execute, then rerun the read-only production audit.

## Required pre-launch evidence

Before a major public/operational launch, collect a single release evidence set:

1. Quality, Firestore Rules, Firebase Hosting and Playwright checks green for the release change.
2. `main` branch protection/ruleset enabled and Branch Protection Audit passing.
3. Production Firestore provenance/compatibility audit passing after the parked TEST-data cleanup is completed.
4. Production Hosting deployment successful and Post-deploy smoke passing against the exact deployed commit.
5. One authenticated ordinary-leader smoke proving section isolation.
6. One authenticated parent smoke proving only explicitly linked member data is visible.
7. One real email-delivery smoke through the production email Worker.
8. A recent verified Firestore backup before any destructive migration or cleanup.
9. Storage explicitly recorded as unavailable unless/until a supported attachment backend is enabled and tested.

The authenticated and real-email checks deliberately remain human release checks: CI must not gain broad production user credentials merely to automate them.

## Non-blocking follow-up

A real managed restore exercise should be scheduled when a suitable non-production Firebase project is available. The emulator recovery drill proves the repository's deterministic export/import verification logic, but not cloud IAM, managed import permissions or project/location compatibility.

Attachment features should remain capability-gated until the project chooses a supported storage solution. Do not silently degrade security or move sensitive files into public Hosting to work around the current Storage limitation.

## Stage 19 conclusion

Stage 19 has delivered the intended engineering controls for deployed-release evidence, operational health, recovery rehearsal, retention/privacy lifecycle, export/offboarding governance and reporting/read-budget protection.

The stage can be considered **engineering-complete** once this review is merged. **Production launch-ready** remains a separate operational state and should only be declared after the blockers and release evidence above are satisfied.
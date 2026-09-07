# Development and readiness report

**Evidence baseline:** `main` at `8fca06f4cb403a7147e510dd9ebf9c5482ab3301` on 7 September 2026, reviewed together with the live Jira backlog and recent merged pull requests.

This report describes the current product and operational position. It deliberately avoids treating historical numbered development stages as the source of truth.

## Executive status

The application is a production-oriented React/Firebase Scout-group website with separate public, parent and leader experiences. Core member, programme, meeting, event, consent, Adventure Skills, equipment, finance, gallery, reporting and administration workflows are implemented and covered by layered automated checks.

The repository has strong safeguards around authorization, deterministic test data, deployment, recovery and production-data changes. Readiness is not equivalent to “all backlog work complete”: several product/operations items remain deferred or open in Jira and are listed below.

## Architecture

- React 19, TypeScript and Vite provide the single-page application.
- React Router supplies public, parent and protected leader/admin routes.
- Material UI provides the component and theme foundation.
- Firebase Authentication establishes identity.
- Cloud Firestore is the primary application datastore.
- Firebase Storage is used by supported attachment domains when the environment is provisioned for them.
- Firebase Hosting serves previews and production releases.
- A Cloudflare email Worker is the trusted provider boundary for email delivery; provider credentials are not exposed to the browser.
- Route-level lazy loading keeps operational areas out of the initial public bundle.
- Public/parent-safe projections are used where a restricted operational record should not be exposed directly.

There is no general-purpose application server between the browser and Firestore. Client services organise domain access but are not an authorization boundary.

## Delivered functionality

### Public website

The public experience includes Home, About/Who’s Who, Activities, joining enquiries, public consent forms and Contact. Public leadership is opt-in and uses a safe public projection rather than exposing internal leader records.

### Parent Portal

Approved parent accounts can be linked to specific children. Parent-facing workflows include permitted consent information, event tasks/consent, parent-safe meeting information, eligible event galleries and read-only Adventure Skills progress. Parent access is child-linked rather than broad section access.

### Leaders, roles and member management

The Leader Portal supports leader registration/approval, profiles, section assignments, system roles, organisational Scout roles, member management, section moves/history, parent-link administration and organisational information. Navigation adapts to the signed-in user’s permitted routes.

### Meetings and programme

Weekly Meetings supports planning, attendance, programme items, Adventure Skills work, equipment requirements, notes/incidents, copy/reuse and protected historical handling after closure. A section-scoped Programme Library supports reusable programme items. Formal Meeting Records are a separate workflow for leader/Group Council records and retained revision history.

### Events, attendance and consent

Events support creation and lifecycle management, public projections, event consent, attendance, completion/history and eligible event galleries. Attendance Insights combines recorded Weekly Meeting and Event attendance with date and member views.

### Adventure Skills / Badgework

Adventure Skills tracks member-owned competency progress and awards, supports multi-member entry, per-child views, shared competency handling, award/history workflows and parent read-only visibility. Progress remains with the member across section moves.

### Equipment and stores

Equipment & Stores covers inventory, categories, locations, stock status, checkout/return, incidents, immutable history, meeting/event programme requirements and reservations, and focused reporting. Permissions remain role/section scoped.

### Finance and receipts

Section Floats uses an append-oriented ledger model with reconciliation and traceable corrections. Supported receipt attachments can be associated with transactions where the Storage-backed attachment capability is provisioned. The implemented finance/gallery attachment domains should not be confused with a claim that every possible file-storage use case is complete.

### Galleries and images

Event Galleries support authorised leader image management and consent/access-aware parent viewing for eligible events. Gallery media is not a public photo feed.

### Reports, records and operations

The portal includes scoped reports/exports, attendance insights, communications, activity logging, organisational information and administrative settings/access workflows.

## Roles and RBAC

The system separates platform roles from Scouting organisational roles.

Platform identities include public, parent, leader, admin and super-admin. Operational Scout roles such as Group Leader, Group Secretary and Group Quartermaster / Bo’sun can provide domain-specific responsibility without replacing the platform-role model.

Authorization is layered around:

- authenticated identity;
- active canonical leader profile where required;
- platform role;
- authorised sections;
- organisational role where a domain needs it;
- explicit parent/member linkage;
- route/UI visibility for usability.

UI hiding is not treated as authorization. Firestore and Storage Rules remain authoritative for direct client-accessible data.

## Firebase boundaries

### Authentication

Firebase Authentication supplies identity. The application then loads canonical role/section data from Firestore for leader authorization. Parent access is approved and linked separately.

### Firestore

Firestore Security Rules are the primary data-access boundary. Current rule contracts cover public projections, member/parent linkage, leader section scope, restricted history, finance, equipment, events, consent, Adventure Skills and administrative records.

### Storage

Storage Rules protect the supported finance-receipt and event-gallery paths. Availability must be verified in the target environment before claiming an attachment workflow is operational there.

### Hosting and deployment

Pull requests receive a Firebase Hosting preview. Merges to `main` use the production Hosting workflow and post-deploy verification checks the deployed release identity.

## Testing strategy

The repository uses complementary layers rather than relying on one browser suite:

1. Node-based unit tests for pure domain/permission logic.
2. Email Worker contract tests.
3. Firestore and Storage emulator-backed security-rule tests.
4. Deterministic seed-contract and fixture validation.
5. Playwright browser journeys using Firebase Auth, Firestore and Storage emulators.
6. Firebase Hosting preview validation.
7. Live post-deployment smoke verification.
8. Explicit production compatibility/provenance audits where production data itself must be assessed.

Automated browser tests do not use production data as their fixture source.

## Playwright coverage

The current E2E suite covers representative public, parent and leader journeys plus focused operational areas including navigation, accessibility/mobile behaviour, members, meetings, attendance, events/consent, Adventure Skills, equipment, finance, reports and galleries.

The CI workflow seeds canonical emulator-only identities and records, verifies seed idempotency, builds the same application that is served to the browser tests, and runs Chromium plus selected WebKit coverage. Alternate styling must remain presentation-only and is expected to exercise the same route/RBAC contracts.

## CI and merge controls

The repository has separate Quality and Playwright E2E workflows plus Firebase/security/preview checks. The active main-branch ruleset requires the stable `quality` and `e2e` status contexts before a normal pull request can merge.

Quality includes linting, unit and Worker tests, production dependency audit, seed/test contract checks, source-complexity checks, hosting/deployment configuration checks, RBAC checks, workflow security checks and a production build.

Additional workflows cover Firestore Rules, Hosting previews/deployments, post-deploy smoke, production data audits, backup freshness and recovery-related checks.

## Operational safeguards

- Deterministic test data is explicitly marked and designed for emulator/test use.
- There is no normal CI workflow that seeds or purges production TEST data.
- Production TEST-data deletion is guarded by project, dry-run, manifest/count, confirmation and backup requirements.
- Live schema/provenance audits fail closed on ambiguous records rather than silently relabelling data.
- Scheduled Firestore backups and documented recovery procedures exist.
- A non-production recovery drill validates the repository’s export/import verification path.
- Production deployments carry build/release identity and are followed by post-deploy smoke verification.
- Authenticated sessions include inactivity handling.
- Sensitive member/consent/medical information must not be placed in general logs, URLs or telemetry.

## Production status

The main application and established Firebase-backed operational workflows are production-oriented and deployed through the repository’s controlled Hosting pipeline. A green application build alone is not sufficient evidence for every external dependency or operational capability.

The following should be treated separately from the shipped application code:

- custom-domain completion remains a deferred operational item in Jira;
- full production email/provider rollout remains deferred;
- broader receipt/file/image-storage provisioning or data-population work remains separately tracked even though specific receipt/gallery product flows exist in code;
- production TEST-data cleanup remains an explicitly guarded/manual operation;
- server-authoritative Adventure Skills award-completion enforcement remains deferred;
- newly raised product/backlog work is not implied complete by this report.

## Current known/deferred items

At the evidence baseline, Jira still tracks the following material unfinished or deferred work:

- **SW-13** — complete domain registry/setup (deferred).
- **SW-14** — complete production email setup (deferred).
- **SW-15** — broader receipt/file/image storage completion (deferred; do not interpret this as saying existing finance receipt and event gallery code is absent).
- **SW-23** — guarded production TEST-data cleanup (deferred/manual mutation boundary).
- **SW-24** — server-authoritative Adventure Skills award-completion enforcement (deferred).
- **SW-27** — Modern Scout theme provisioning/relevance verification (the next Work Block E item at this report baseline).
- **SW-28** — background page-jump menu defect.
- **SW-29** — charity-number footer change.
- **SW-30** — populate equipment from supplied spreadsheet (deferred).
- **SW-31** — import members from supplied spreadsheets.

The live Jira backlog should be rechecked before a future release decision because this list can change after the report is merged.

## Remaining risks

1. **External production integrations:** domain, email and Storage provisioning can make a coded feature unavailable or partially available even when CI is green.
2. **Production-data operations:** TEST-data cleanup and future migrations can be destructive; existing backup/manifest/project-confirmation gates must not be bypassed.
3. **Authorization drift:** new routes or data collections must be reflected in the RBAC matrix, Rules and representative security tests.
4. **Adventure Skills award integrity:** SW-24 remains the explicit hardening item for a server-authoritative award-completion boundary.
5. **Growing operational breadth:** new imports/data-population work should preserve provenance, validation and repeatability rather than become ad-hoc production scripts.
6. **Mobile/regression risk:** the portal is feature-rich and must retain focused mobile/Back/navigation Playwright coverage as workflows change.
7. **Documentation drift:** product help should describe current user workflows; implementation/security details should stay in engineering documentation and be updated with code changes.

## Readiness conclusion

The repository has a mature production baseline and substantial delivered operational functionality, with strong CI, emulator-backed security tests, deterministic Playwright fixtures and guarded production operations. It should not be described as “finished” solely because earlier development stages are complete. Release/readiness decisions must include the live Jira backlog and the state of external production dependencies, especially domain, email, Storage provisioning and any approved production-data mutation.

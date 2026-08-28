# Current system architecture

This document describes the current production architecture of the Coolock Ardlea Scouts website. It is intentionally independent of the numbered development-stage history so future changes can be reviewed against one current-state baseline.

## System shape

The application is a Vite/React single-page application hosted on Firebase Hosting.

Primary application flow:

`Browser -> React -> Firebase SDK -> Firebase Authentication / Cloud Firestore`

Email flow:

`Browser -> Cloudflare email Worker -> Firestore REST / Resend`

There is no general-purpose application server between the browser and Firestore. Files under `src/services` organise application logic and Firestore access but execute in the client and therefore are not a security boundary. Firestore Security Rules remain the authoritative database authorisation layer.

## Frontend

- React and React Router provide the SPA and route model.
- MUI provides the component/theme foundation.
- Route-level lazy loading keeps leader-only areas out of the initial public-site bundle.
- `AdminAuthProvider` owns authenticated leader profile state, section assignments and inactivity handling.
- `ThemeExperienceProvider` applies a presentation-only UI theme. Themes share the same routes, components, services, permissions and Firestore data.
- Public content is provided through `PublicSiteContentProvider`.

The default Scout frontend and the Modern Scout frontend must remain functionally identical. Theme-specific business logic, routes, permissions or persistence are not permitted.

## Authentication and authorisation

Firebase Authentication establishes identity.

Leader access additionally requires an active canonical `adminUsers/{uid}` profile. Section assignments and system role are loaded from Firestore rather than inferred from the Firebase account alone.

System roles are:

- `leader`
- `admin`
- `super-admin`

Operational Scout roles such as Group Leader, Group Secretary and Group Quartermaster / Bo'sun are held separately in organisation leadership data. These roles may grant domain-specific capabilities but do not replace the system-role model.

Parent access is linked explicitly to approved member IDs. Parents do not receive general section-level access to member records.

## Firestore security boundary

Firestore Security Rules are the primary backend authorisation boundary and must enforce every client-accessible read and write independently of UI visibility.

Rules use:

- authenticated UID checks;
- canonical active-leader validation;
- role checks;
- authorised-section checks;
- parent/member linkage;
- field allowlists;
- server timestamps where appropriate;
- authenticated actor attribution;
- append-only or delete-denied history where appropriate.

UI permission checks exist for usability and navigation only. A hidden button must never be treated as an access-control mechanism.

## Core data domains

The current application includes the following persistent domains:

- leader/admin accounts and registration requests;
- parent accounts and member links;
- members and member history;
- public join applications;
- events and public event projections;
- event consent links and responses;
- weekly meetings and parent-safe weekly meeting projections;
- meeting records and historical revisions/audit information;
- organisation leadership and public leadership projections;
- communications/audit information;
- Adventure Skills requirement progress and awards;
- equipment inventory, locations/categories, loans, programme requirements/reservations, incidents and history;
- site/public content and settings.

Where a public or parent-facing view requires only a safe subset of operational data, prefer an explicit projection rather than broadening read access to the operational source document.

## Adventure Skills boundary

Adventure Skills progress is member-owned rather than section-owned so section transfers do not reset or copy progress.

Requirement completion and badge/stage award are separate states. Requirements may carry completion provenance. Awards are explicit actions and must not be inferred merely because requirements are complete.

## Equipment boundary

Equipment inventory, loans, programme requirements/reservations, incidents and history are separate domain concepts.

Stock-changing operations must remain transaction-safe. Historical events should preserve immutable snapshots needed to understand what happened even if current equipment metadata later changes.

## Email Worker

The Cloudflare Worker is a trusted external-integration boundary for email delivery because provider credentials are never exposed to the browser.

The Worker must:

- restrict supported methods and paths;
- enforce allowed origins as a browser-control layer;
- enforce request-size limits;
- verify Firebase identity for authenticated operations;
- load protected records itself when recipient/action validation depends on persisted state;
- derive privileged recipients from trusted data rather than accepting arbitrary browser-supplied recipient lists;
- escape untrusted values before inserting them into HTML email;
- keep Resend and other provider credentials server-side.

Origin/CORS validation is not a complete anti-abuse control for anonymous public endpoints. Public-write and public-notification flows require dedicated anti-automation/rate-limit protections as Stage 14 hardening work.

## Testing layers

The expected test pyramid is:

1. unit tests for pure domain and permission-calculation logic;
2. Firestore emulator tests for Rules contracts;
3. deterministic seeded Playwright journeys for browser behaviour;
4. Firebase Hosting preview checks;
5. live post-deployment smoke checks;
6. explicit production Firestore compatibility/provenance audits where live data must be verified.

Playwright seed data must be deterministic and safe to seed repeatedly without requiring cleanup first. Production data must never be used as the source of truth for browser-test fixtures.

## Production data compatibility

Firestore is schemaless at the database level, so compatibility is protected by a combination of TypeScript models, Rules validation, deterministic seed contracts and production audit/reconciliation scripts.

Any schema change that may affect existing production documents must include one of:

- backward-compatible readers;
- a safe explicit reconciler/migration;
- a production compatibility audit proving no migration is required.

Do not make browser tests depend on destructive production cleanup or reseeding.

## CI/CD gates

The production baseline includes:

- linting;
- unit tests;
- production dependency audit;
- seed-contract checks;
- hosting-security/configuration checks;
- TypeScript/Vite production build;
- Firestore Rules emulator tests when applicable;
- deterministic Playwright testing;
- Firebase Hosting preview/deployment workflows;
- post-deployment live smoke checks;
- production Firestore data audits;
- scheduled Firestore backups.

A feature should not be considered complete merely because the UI builds. Its relevant data, security, seed and regression contracts must remain green.

## Security and privacy constraints

The system handles information about children and may contain consent, emergency-contact and medical information.

Do not place sensitive values in:

- URLs;
- general-purpose audit descriptions;
- analytics;
- client-side telemetry;
- unredacted error logs.

Prefer structured identifiers and deliberately safe summaries in logs/audit entries.

## Performance principles

- Keep route-level code splitting.
- Prefer constrained Firestore queries and server-side counts over loading entire historical collections into the browser.
- Add composite indexes to `firestore.indexes.json` when production query patterns require them.
- Do not introduce a reporting backend until real data volume demonstrates that client-side reporting is no longer appropriate.

## Operational resilience

Production Firestore backups are scheduled and recovery procedures are documented. High-risk migrations should require a recent verified backup.

A backup is only fully trusted when restoration has also been rehearsed. Stage 14 should introduce a periodic non-production restore drill.

## Architectural rules for future development

1. Do not introduce another backend, state-management framework or repository abstraction without a demonstrated product need.
2. Keep Firestore Rules as the authoritative data-access boundary for direct client access.
3. Keep UI themes presentation-only.
4. Extract pure domain logic from high-churn UI components and unit-test it.
5. Decompose large pages by user responsibility, not merely by file size.
6. Preserve member-owned Adventure Skills progress across section transfers.
7. Preserve transaction-safe equipment stock operations and append-only history.
8. Prefer explicit public/parent projections over granting broad read access to operational documents.
9. Keep Playwright deterministic and emulator-backed.
10. Treat security, privacy, data compatibility, accessibility and operational recovery regressions as production regressions, not optional cleanup.

## Stage 14 consolidation priorities

The current architecture remains suitable and does not require a rewrite. Stage 14 should strengthen the existing design through targeted work:

- public endpoint anti-abuse protection;
- a reviewed RBAC/Firestore permission matrix;
- targeted decomposition of high-churn operational pages;
- pinned/reproducible browser-test dependencies and compact WebKit coverage;
- modularisation and direct testing of the email Worker;
- source-complexity regression checks;
- stricter CSP evaluation in preview;
- release/build identification;
- restore-drill verification.

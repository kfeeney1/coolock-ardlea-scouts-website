# Stage 23.9 — Integrated production-readiness closeout

## Scope and evidence

This closeout revalidates the current `main` branch after the Stage 23 hardening sequence. It is a repository and product-control review; it does not mutate Firebase production data, alter RBAC, change Firestore/Storage Rules or change application behaviour.

Evidence reviewed includes the current Quality contract, Playwright workflow and deterministic emulator seed, RBAC matrix, active GitHub main-branch ruleset, Stage 23 implementation PRs and the Stage 23.7/23.8 performance and cleanup-readiness findings.

## Stage 23 outcomes

The planned hardening sequence is complete:

- **Parent experience coherence** — PR #386 updated the parent surface to a coherent Parent Portal and retained mobile/parent regressions.
- **Cross-feature mobile operations** — PR #388 extended the existing Pixel-sized operational suite across high-frequency leader workflows rather than adding duplicate route-smoke coverage.
- **Relationship integrity** — PR #389 broadened the existing read-only operational-integrity validator across member, parent, event, consent and meeting relationships.
- **Operator data health** — PR #390 added an explicit, super-admin-only read-only operational-data check without running broad integrity reads on ordinary dashboard load.
- **Accessibility and focus management** — PR #391 hardened focus restoration, Escape dismissal, touch targets and the Leader-menu Back/history race with Playwright regression coverage.
- **Performance/read efficiency** — PR #392 revalidated lazy-route boundaries, dashboard caching/count aggregation and remaining functional document reads; no evidence-backed query/schema change was justified.
- **Guarded production TEST-data cleanup readiness** — PR #393 revalidated the dry-run/manifest/count/project/backup gates against the current schema without deleting or relabelling production data.

## Cross-role readiness review

### Public surface

Public routes remain explicitly represented in the RBAC contract, with public forms separated from protected leader operations. Public Firestore projections remain limited to their intended read/write contracts rather than exposing administrative collections.

### Parent surface

The Parent Portal remains a distinct parent entry surface. Parent Firestore access is constrained to linked-member/projection contracts for members, Adventure Skills, consent/medical information, gallery events and weekly programme information.

### Leader and administrator surfaces

Leader routes remain protected and role/section aware. The RBAC matrix distinguishes ordinary leader access, administrator-only access and group-audit roles. Finance, equipment, attendance, events, meetings, members and Badgework retain section/role-specific Firestore contracts.

### Super-admin/operator surface

The operational-health surface now separates deployment/configuration health from explicit data-integrity health. The data check is read-only and user-triggered, and its broad scan is super-admin scoped. Production TEST-data cleanup remains a trusted-administrator action outside GitHub Actions and is read-only by default.

## CI and regression gates

The current Quality contract covers lint, unit tests, email-worker tests, deterministic seed contract, Playwright suite shape, source-complexity limits, hosting/deploy configuration, Firestore audit coverage, RBAC matrix/test coverage, workflow permissions/action pinning/production-credential boundaries, smoke-script syntax and the production build.

Playwright E2E remains a separate full-browser Firebase-emulator workflow using deterministic seed data. Stage 23 implementation PRs were held until both Quality and Playwright were green; failures were investigated and fixed rather than bypassed.

The active `main` GitHub ruleset requires pull requests and the `quality` status check. At the time of this review it did **not** make Playwright a GitHub-enforced required status check. SW-25 subsequently closed that governance residual by adding the stable `e2e` GitHub Actions job context to the required checks while retaining `quality`, strict latest-branch checking and the existing no-bypass policy.

## Security and data controls

- The canonical RBAC matrix covers public, parent, leader, admin and super-admin identities across application routes, Firestore collections and Storage paths.
- Quality verifies both the RBAC matrix and RBAC test coverage.
- Firestore/Storage production access remains governed by explicit Rules; Stage 23 did not replace security Rules with client-only checks.
- Operational integrity tooling is read-only and does not automatically repair live records.
- Production credential checks prevent TEST-data purge tooling from being invoked by production GitHub workflows.
- The guarded cleanup remains fail-closed on project, counts, manifest digest and verified-backup evidence.

## Severity outcome

### P0

None identified.

### P1

None identified from the current repository, CI, security/RBAC, operational-control and Stage 23 regression evidence.

### Residual P2 / deliberately deferred work

1. **Playwright ruleset enforcement — completed by SW-25** — the active GitHub `main` ruleset now requires the Playwright `e2e` check in addition to `quality`, and the repository audit fails if either context drifts out of enforcement.
2. **Production domain cut-over** — remains parked until the production domain is ready.
3. **Production email rollout** — remains parked with the domain because sender identity, production links and DNS authentication are coupled to it.
4. **Production TEST-data deletion** — remains parked. Stage 23.8 revalidated the guarded process only; no production deletion occurred.
5. **Adventure Skills server-authoritative award-completion enforcement** — remains an explicit deferred design decision.
6. **Public information/final report** — FAQ/info refresh and the full development/readiness report are post-closeout follow-up work, as defined by SW-6.

Historical Badgework import is not a residual item: it was explicitly determined not to be required and was removed from the roadmap.

## Closeout decision

Stage 23 can close with **no identified P0 or P1 production blocker** in the current repository/product-control scope. The remaining items are either deliberately parked external rollout work, a deferred product-design decision, or P2 governance/documentation follow-up.

This conclusion does not authorise the parked production TEST-data deletion, production-domain cut-over or production email rollout. Those remain separate controlled operations.

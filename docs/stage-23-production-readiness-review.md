# Stage 23 production-readiness review

## Scope

This review re-checks the application after the Badgework refinement programme (#352-#379) and the site-wide mobile Back work (#380-#384). It is intentionally narrower than the Stage 20.7 product-maturity review: it looks for regressions or new operational risks introduced by the subsequent feature growth.

Domain cut-over and production email rollout are explicitly parked until the production domain is ready. Historical Badgework import has been removed from the roadmap because it is not required. Server-authoritative Adventure Skills award-completion enforcement remains a separate deferred design decision.

## Current baseline

The repository has a strong automated baseline:

- React/Vite/TypeScript production build with lazy-loaded routes.
- Firebase Auth, Firestore and Storage with explicit Rules.
- Protected leader routes and role/section-aware application services.
- Deterministic Firebase-emulator Playwright seeding.
- Quality checks for lint, unit tests, email-worker tests, seed contract, Playwright suite shape, source complexity, hosting/deploy configuration, Firestore audit coverage, RBAC matrix/test coverage, workflow permissions/action pinning/production credentials and production build.
- Existing accessibility, finance, equipment, attendance, events, parent and Badgework E2E coverage.
- Existing read-only operational-integrity checks for finance and equipment relationships, alongside Adventure Skills and projection integrity checks.
- Site-wide Back regressions including a tightened one-press mobile dismissal contract from #384.

## Severity outcome

### P0

None identified from the current repository and test review.

### P1

None identified after #384. The reported sticky/mobile Back defect was treated as a P1 usability regression and is fixed with green Quality, Hosting and Playwright checks.

### P2 hardening work

The following work is valuable before calling the current product surface fully hardened.

1. **Parent experience coherence** — The `/parent` route now contains Adventure Skills, events/event consent and medical/consent workflows, but several labels still describe it as a "Parent Consent Portal". Multi-child and task-oriented use should be reviewed as one coherent parent experience.
2. **Cross-feature mobile operational regression coverage** — Individual features are well tested, but recent mobile work has concentrated on navigation/Back semantics. Extend the existing mobile operational coverage with a Pixel-sized journey across the newer/high-frequency leader surfaces and assert no overflow/sticky-action regressions.
3. **Broader relationship-integrity coverage** — The existing `firestore-operational-integrity` audit already validates finance and equipment relationships. Extend that read-only integrity layer to cover the cross-feature relationships that are not currently represented there, especially members/parent links, events/consents and attendance/meeting references.
4. **Operational-health depth** — The existing super-admin health panel reports build/configuration capability. It should also expose safe read-only data-integrity status so deployment health and data health are not conflated.
5. **Accessibility after overlay/navigation changes** — Existing accessibility coverage predates the full Back/overlay stack. Add focus-restoration, dialog/listbox and touch-target contracts around the newest interaction patterns.
6. **Performance/read-efficiency revalidation** — Feature growth since the existing Firestore read-budget work warrants a fresh review of broad listeners, duplicate loads, lazy-route boundaries and large-page read patterns.
7. **Production TEST-data cleanup readiness** — Keep deletion parked, but revalidate the guarded manifest/dry-run/backup procedure against the current schema so the eventual operator action is still safe.
8. **Stage closeout** — Re-run a current-state cross-role review after the above work and record any residual/deferred items before updating the public-facing FAQ/info material and producing the final report.

## Planned PR sequence

- **#386** Parent experience coherence and regression coverage — complete.
- **#387** was allocated to Dependabot and merged after rebasing onto #386.
- **Next development PR** Extend cross-feature leader mobile operational regression coverage.
- Then broaden the existing read-only operational-integrity audit across parent/member/event/attendance relationships.
- Extend the existing super-admin operational-health panel with data-health status.
- Complete accessibility and focus-management hardening.
- Revalidate performance and Firestore read efficiency.
- Revalidate guarded production TEST-data cleanup readiness; no deletion.
- Close Stage 23 with an integrated regression/readiness review.
- After closeout: update FAQ/info content to reflect the finished product surface and add a full development/readiness report.

## Explicitly parked / excluded

- Production-domain cut-over: parked until the domain is ready.
- Production email rollout: parked with the domain because sender identity, production links and DNS authentication are coupled to it.
- Historical Badgework import: not required; removed from the roadmap.
- Server-authoritative Adventure Skills award-completion enforcement: deferred design decision, not silently implemented in this stage.
- Production TEST-data deletion: parked; the cleanup-readiness PR may only revalidate the guarded process.

## Merge rule

Every implementation PR in this sequence must retain the existing Quality and Playwright gates. A failing gate is a defect to investigate and fix; the gate must not be weakened to make the branch green.

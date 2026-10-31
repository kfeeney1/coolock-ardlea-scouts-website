# SW-571 — controlled Hall Hire TEST rehearsal

## Purpose and limits

After #966, TEST has an isolated booking transport implementation, but the SW-569 final publisher requires genuine deployed acceptance before readiness. SW-571 supplies a **separate private rehearsal operation** so that acceptance can be executed without inventing evidence or publishing final readiness. It does not create synthetic accounts, assign roles, seed source facts or mark any check passed.

Only the exact `coolock-ardlea-scouts-test` project or explicitly configured loopback `demo-` emulation is supported. Production is blocked by CLI and native mutation helpers. The existing verified operator ID token and ADC are used; the transaction rereads current active Superuser and Council authority before starting. Do not put credentials in arguments, history, reports or Jira. No new HTTP endpoint, deployment, service, subscription, scheduled job, paid resource or additional dependency is introduced. Plans/start use the existing bounded collector (at most 12,016 reads per operation) and start/stop add four/six writes respectively. Existing Firebase quotas/usage still apply; run deliberately within the existing allowance, not as a recurring job.

A rehearsal is a **manual session, without automatic expiry**. The operator is responsible for stopping it, including after a failed acceptance run. A current active Superuser can stop after losing Council membership. The normal Hall Hire switch and readiness revocation remain emergency controls. Revocation alone does not close the private rehearsal marker: explicitly stop before final reconciliation/publication.

## Prerequisites

1. Complete SW-570 account plan/quota verification and actual isolated TEST Worker configuration/deployment. Keep email disabled and Production unchanged. No deployment was performed by SW-571.
2. Pin the exact reviewed main commit actually deployed to both TEST Hosting and the booking Worker. Wait for its checks and deployments; use the real 40-hex SHA, not a PR branch or guessed revision.
3. Finish source-owner review/reconciliation using the existing audit and manifest tool. All legacy sources, including far-future/historical records, and all indexed periods must reconcile. Never infer hall use from location text. The rehearsal does not bypass these checks, or classify unknown records as non-hall.
4. Keep both rollout projections and both readiness booleans off. Use controlled synthetic TEST records/accounts through the existing workflows; do not copy Production/member/contact data. No accounts or permissions are created by the rehearsal tool.
5. Supply the existing current `HALL_OPERATOR_ID_TOKEN` privately and ADC for TEST. Supply the actual `VITE_HALL_BOOKING_API_URL` from SW-570. Live TEST rejects Auth/Firestore emulator bindings; demo mode needs both explicit loopback emulators and produces only synthetic evidence.

## Plan and start

Use today's **Dublin date** through exactly 365 days later. For example, on 31-10-2026 use `2026-10-31` through `2027-10-31`. Command dates remain ISO; site display remains DD-MM-YYYY.

```bash
npm run control:hall -- --mode=rehearsal-plan --project=coolock-ardlea-scouts-test --from=2026-10-31 --through=2027-10-31 --commit=THE_ACTUAL_40_HEX_DEPLOYED_MAIN_SHA
```

The CLI fetches only fixed public TEST Hosting build metadata and SW-570's restricted Worker health/negative-boundary preflight. It verifies matching project/revision/environment/source. It sends no valid token to public probes, no booking command, mail or enquiry. Metadata/probes remain `functionalAcceptance:false`. Current deployment availability is required for planning/starting, but not for shutdown.

The read-only result contains static blockers/references and a digest, with `acceptanceRecorded:false` and `activationApproved:false`. No source purpose, hirer, programme or contact fields are reported. If `canStart` is false, resolve the actual blockers through their owning workflows and obtain a new plan. Do not narrow the horizon to hide facts.

```bash
npm run control:hall -- --mode=rehearsal-start --project=coolock-ardlea-scouts-test --from=2026-10-31 --through=2027-10-31 --commit=THE_ACTUAL_40_HEX_DEPLOYED_MAIN_SHA --plan=THE_REVIEWED_64_HEX_DIGEST
```

Start repeats the public preflight and atomically rereads current operator authority, canonical records, versions, configuration and occupancy. Changed plans or concurrent starts reject. It increments the existing shared resource revision, sets private/public readiness true and creates a private rehearsal marker, immutable start receipt and system audit. **The independent Superuser Hall Hire switch stays off.** Only then explicitly enable it through existing Superuser settings for controlled TEST acceptance. The tool creates no final readiness receipt, acceptance JSON, baseline or Production approval.

The session record is private under `hall/group/testRehearsals`; all client reads/writes remain denied. The public readiness projection still contains only `{ready:true}`. All booking/source writes continue through their existing authoritative role, canonical scope, conflict, neutral projection and immutable audit controls.

## Execute, stop and reconcile

Execute and record SW-561's real deployed checks against synthetic records and the exact frontend/Worker revisions. Cover manual/recurring/blocked bookings, occurrence exceptions/Dublin DST, source lifecycle, concurrent conflicts/adjacency, scoped and direct-access denials, neutral public availability, both rollout states and all UI/device requirements. Health checks, emulator/CI results and starting a rehearsal do not count as passes. A frontend/Worker deployment change requires a fresh run against matching revisions.

Cancel temporary bookings and release source reservations through their authoritative workflows while testing. Retain records/history as evidence; do not bulk-delete reservations, indexes or source reviews. Then always run:

```bash
npm run control:hall -- --mode=rehearsal-stop --project=coolock-ardlea-scouts-test
```

Shutdown needs a current verified active Superuser, but not Council membership or a working Worker. It atomically turns private/public readiness and both rollout projections off, increments the **current** resource revision, closes the private marker and creates immutable close history/system audit. It never restores a stale resource snapshot or deletes/rewrites bookings, source records, indexes, reviews, history or a prior baseline. Repeating an already completed stop performs no writes. An audit/receipt failure aborts the whole transaction; inspect the failure and use the normal switch/revoke controls as appropriate, without claiming the session closed.

After stopping, reconcile any newly created synthetic source records using explicit source-owner decisions. Without a prior accepted baseline these remain legacy facts needing review; the rehearsal does not silently mark them non-hall. Active rehearsal markers block all preactivation imports and final readiness publication, even if someone separately revoked readiness. After shutdown the existing SW-569 final publisher still requires fresh, complete, genuine SW-561 acceptance evidence, a new current reconciliation digest and its normal separate Superuser rollout action.

## Assurance and Android PMT

Automated coverage exercises read-only/digest/source/deployment/environment guards and real emulator transactions: stale/racing starts, live authority changes, immutable audit failure atomicity, private receipts, real booking/source writes, public privacy and record-preserving shutdown. Synthetic emulator outcomes cannot satisfy live TEST evidence. No live rehearsal, feature activation, import, final readiness publication or Production deployment was performed during implementation.

Android PMT remains pending: 320px and all themes/header; keyboard/focus/calendar navigation; single-occurrence versus series actions; source permissions/conflict/adjacency; neutral slots/enquiry wording; Back/draft retention; switch off/on and stopped/revoked readiness preserving records. Record device/browser, exact deployed frontend/Worker revisions, results and cleanup in SW-561. Production Manual Testing remains separate.

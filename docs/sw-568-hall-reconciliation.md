# SW-568 — read-only Hall Hire reconciliation

Jira: https://kfeeney1.atlassian.net/browse/SW-568
Prerequisites: merged SW-563–SW-567. Supports SW-560 and SW-561.

## What this verifies

`npm run audit:hall` diagnoses the canonical source → private reservation → private conflict index → neutral public availability chain. It uses the existing hall domain, Europe/Dublin/DST conversion, bounded recurrence/exceptions and half-open intervals. It checks deterministic source ownership, missing/orphaned/duplicate links, source schedule/state drift, source/book revisions, overlap, missing/extra/stale indexes/projections, public privacy shape and the current immutable history/audit heads. Empty historical day documents left by cancellation are valid.

The reader uses a single Firestore read-only transaction, including queries and audit heads. Concurrent source writes cannot mix old and new source/index versions into one report. Every collection query is limited to 1,001 documents; the extra document detects incomplete scans. At most 1,000 are analysed per collection. An incomplete scan always fails, even if the included documents look consistent. Total occurrence expansion is bounded to 20,000 day slots; exceeding it also fails. The date horizon is explicit and limited to 366 inclusive dates. Booking/source structural validity and public privacy shapes are checked across scanned records; day-by-day occupancy consistency is checked within that horizon only.

Source reads select scheduling/resource fields only. Booking reads exclude purpose, hirer/contact and notes. History reads select current occupancy/revision and generic actor evidence only. Public availability is read without a field mask so extra private fields cannot be silently hidden by the audit. Output contains static issue codes, safe record references, exact source versions and counts, never field values or provider error bodies. Keep reports and decisions private: record references are operational data, not public availability.

There are no writes, repairs, deploys or readiness/rollout changes. Every report contains `activationApproved: false`. A clean report is a point-in-time diagnostic over its explicit horizon and supplied decisions, not Firebase TEST acceptance, activation approval or a Production pass.

## Operator procedure

Use an existing authenticated operator identity with read access (ADC); no credentials are accepted in arguments or printed. Explicitly name the project. The production project is supported only for an authorised read-only inspection; this does not authorise a Production deployment or data change. Emulator runs require a loopback emulator and a `demo-` project; project/environment mismatches fail closed. No automatic audit schedule or new service is introduced. Live runs consume existing Firestore reads: the complete maximum is 8,010 document reads (six sentinel-bounded scans, four settings/lock reads, and two audit heads per included booking); normal runs depend on record counts. Do not run against live data solely to obtain a green result.

Example TEST invocation (choose the actual verification horizon):

```bash
npm run audit:hall -- --project=coolock-ardlea-scouts-test --from=2026-10-31 --through=2027-10-30
```

The CLI requires supported Node 24+ with type stripping. It returns 0 for diagnostic consistency, 2 for reported inconsistencies/unknown decisions and 1 if it cannot complete. Error output is generic and does not echo file contents, credentials or Firestore errors. Redirect JSON into a private review location, never a public artifact or public site collection.

1. Review all `inventory` references through the existing protected meeting, event or maintenance UI. No location, event type, section or Scout activity implies use of the hall.
2. Confirm whether each relevant unmarked legacy source uses the hall. A released source with a cancelled linked reservation and canonical revision already records explicit release and needs no new legacy classification. Cancelled hall maintenance retains its explicit marked ownership and cancelled reservation.
3. Record only the exact `path`, `version` and confirmed `resource` (`none` or `group-hall`) in a private JSON array. The version is Firestore seconds:nanoseconds; any source edit, including an unselected programme edit, invalidates an earlier decision. The file is bounded to 1 MB and 3,000 unique decisions; unknown keys, paths, resources and duplicate references are rejected.
4. Rerun with `--decisions=/absolute/private/path/decisions.json`. A confirmed hall-use decision without a canonical reservation is reported as `confirmed-hall-needs-reservation`; it is never treated as occupied or approved automatically. Missing/stale/removed decisions remain failures. The auditor cannot manufacture reservations or turn off conflict protection.
5. Correct findings through the record's owning workflow. Already-marked sources can move/release off-state; manual bookings use their own workflow. New preactivation legacy hall records require a separately reviewed controlled migration using the shared authoritative source writer, current source versions, conflict lock, privacy projection and immutable audit. This audit does not implement that migration. Do not temporarily mark readiness true to bypass the new-source gate, write public indexes by hand or create duplicate manual bookings.
6. Re-run after any correction. Do not use a truncated report, silently ignore errors or widen repository checks/limits to call an incomplete scan clean. Large datasets need a separately designed partitioned snapshot audit before activation.

Decision schema example only — this is not a decision about a real record:

```json
[{"path":"events/synthetic-example","version":"1234567890:123456789","resource":"none"}]
```

## Ownership, repair and rollback

Canonical meetings/events/appointments own their resource use. The digest source reservation is an index, not a second editable booking record. Source adapters reserve/release it atomically and manual booking APIs reject edits to source-owned records. Meeting programme/parent projection changes and event audience/consent projections remain owned by their existing workflows. A manual recurring booking that represents a legacy section meeting must be reviewed for ownership/conflicts before linking any canonical occurrence; do not infer or duplicate it from title/location.

Source deletion without a release, changing source times without updating reservations, editing indexes directly or privacy leakage all produce diagnostic failures. Preserve evidence and use an authorised controlled correction; the audit deliberately does not auto-repair an ambiguous owner, lost source, overlap or private projection. Any repair must recheck the current version/authority and use the same lock/audit boundary.

The independent Superuser switch remains the rollback control. Turning it off preserves canonical records/history and the authoritative source conflict protections. Keep source writers/rules deployed while marked records exist. This PR leaves readiness false in actual environments and contains no activation command.

## Evidence and remaining acceptance

Pure tests cover DST/recurrence/exceptions, source ownership/drift, explicit versioned decisions, adjacency/conflicts/cancellation, malformed/stale/missing indexes, privacy, audit heads, scan bounds and strict environment selection. Firestore emulator tests use actual meeting/event/maintenance/manual writers, compare full records/history before and after reader/CLI runs, exercise stale decisions and over-limit scans, off-state release and concurrent rescheduling. Synthetic fixtures temporarily set readiness to exercise existing writers; this is not a live readiness decision.

Remaining: confirm actual legacy hall/resource/time facts, implement/apply reviewed preactivation corrections and readiness publication, verify deployed Firebase TEST/configuration at an exact revision, and execute SW-561 integrated acceptance. Venue facts remain unpublished until confirmed. Nothing is Done or Production-accepted from these checks.

Android PMT after deployed TEST setup: check all themes and 320px layouts; keyboard/focus/date controls; Council/manual/source lifecycle and series exceptions; conflicts/concurrency/adjacency; public privacy; native Back/draft preservation; and off/on record preservation with conflicts still enforced. Production deployment still requires explicit authorisation.

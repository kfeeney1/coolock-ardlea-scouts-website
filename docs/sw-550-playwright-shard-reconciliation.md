# SW-550: reconcile badgework integration assurance capacity

Combining the independently green SW-544/SW-545 foundations exposes the existing
four-shard unit guard: predicted bins are 901.0–901.2 seconds, just beyond its
unchanged 900-second browser budget. Completed CI shows that the older estimates
also understate the current suite's real cost; reducing selected weights simply
to pass the guard would hide this.

This increment refreshes all available complete spec measurements from the green
exact-head Playwright run 40603859829 (SW-544 #942), plus the ten completed setting
cases from green run 40589645926 (#943). The `Playwright END` reporter records each
passed or intentionally skipped case and its duration. Failed/partial results
were not used. Durations are summed per spec across browser projects and rounded
to tenths of a second; no spec, browser project or assertion is removed.

The full current suite is distributed across six isolated emulator runners using
the same deterministic weighted assignment. The unit guard verifies all six
configured matrix entries, complete exactly-once full/affected-suite assignment,
balance and the same 900-second maximum. Generic two-shard assignment coverage
and the 15-second fallback for unmeasured specs remain. On current main the six
estimated bins are 754.7–756.2 seconds before job setup. These are estimates,
not a claim of a deployed or Production pass.

The required aggregate `e2e` check still depends on the complete shard matrix;
any failed/cancelled shard fails the aggregate. Timeouts, retries, failure policy,
source-complexity ceilings, seed isolation, test selection and assertions remain
unchanged. Each additional runner repeats setup, trading more parallel CI work
for a shorter critical path while retaining the per-shard browser budget.

This is an assurance dependency of SW-546 and the remaining badgework work. It
does not complete SW-550's cross-role UI, Firebase TEST or separate PMT acceptance.

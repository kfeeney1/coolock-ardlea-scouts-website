# SW-49 test evidence targets

Required CI evidence for merge:

- Quality gate: lint, unit tests, email-worker tests, deterministic seed contract, RBAC matrix checks, build and repository safety checks.
- Firebase Rules workflow: Firestore and Storage emulator tests, including direct Deputy Group Leader allow/deny boundaries.
- Playwright E2E: desktop and mobile role catalogue, DGL operational permission display, Activity Log, Settings/subs access, explicit Leader Access denial, and navigation visibility.
- Preview deploy: build remains deployable in the PR test environment.

Any failure must be investigated at its root. Tests are not to be skipped, weakened or quarantined to obtain green CI.

# Stage 18.8 — release authorization boundaries

Stage 18.8 converts two high-value pre-release authorization checks from manual-only verification into deterministic Playwright regression coverage.

## Covered boundaries

The release suite now proves, with the canonical emulator seed:

- an ordinary Scouts leader can open a Scouts member record assigned to their section;
- the same leader cannot open a Beavers member record by navigating directly to its record URL;
- the denied cross-section record does not render member details or the member name;
- an approved parent can see a linked member in the Parent Portal;
- the same parent cannot see an unlinked member from the same section, including after searching by the exact member name.

These checks exercise the application through authenticated browser journeys against the Firestore/Auth emulators and the branch's real Firestore rules. They supplement, rather than replace, the lower-level Firestore RBAC tests.

## Stable fixtures

The tests reuse the existing deterministic population seed and role environment variables. No new persistent production seed data is introduced. The assertions deliberately use canonical `TEST_` member IDs and seeded role accounts so re-seeding remains idempotent and the boundary cases are reproducible.

## Release meaning

A green Playwright run now provides automated evidence for the checklist requirements that an ordinary leader cannot read another section's member record and that a parent sees only linked member records. A real authenticated smoke test remains appropriate before a major production launch, but these two authorization boundaries no longer depend solely on a human remembering to test them.

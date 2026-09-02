# Stage 18.12 — Production TEST-data boundary

Stage 18.12 removes the repository workflow that could seed, reset or purge the canonical TEST dataset directly against the live Firebase project.

The canonical population, flow, public-content and Playwright fixtures remain part of emulator-backed CI. They are test infrastructure and are not a supported production data-management mechanism.

`check-workflow-production-credentials` now fails closed if a workflow combines the canonical production Firebase service-account secret with any TEST-data mutation script, including population, superadmin, flow, public-site, Playwright-record seeding or TEST-data purge scripts.

This prevents a future workflow from quietly reintroducing live TEST fixture creation while preserving legitimate credential-bearing operational workflows such as backup, data audit, parent programme rebuild and Firebase Hosting deployment.

Production records should be created and maintained through supported application/admin workflows or a separately reviewed production repair/migration procedure with a fresh verified backup. TEST fixtures should be created only in emulator or explicitly isolated non-production environments.

# Stage 18.4 — GitHub Actions least privilege

Stage 18.4 extends the production-hardening baseline to GitHub Actions token permissions.

Every workflow must explicitly declare a `permissions` block instead of inheriting repository defaults. `scripts/check-workflow-permissions.mjs` scans all `.github/workflows/*.yml` and `.yaml` files and fails when a workflow omits explicit permissions or grants `write-all`.

Write-scoped GitHub token permissions are deny-by-default. Any required write scope must be listed in the guard's narrow workflow-specific allowlist. The current baseline permits only `checks: write` in the live Firebase Hosting deployment workflow; all other workflows are expected to remain read-only from GitHub's perspective unless a reviewed exception is added.

The parent weekly-programme rebuild workflow previously used a production Firebase service-account secret while leaving GitHub token permissions implicit. It now explicitly grants only `contents: read`.

The contract runs inside `npm run quality`, so a newly added workflow cannot silently inherit broader repository token defaults and an existing workflow cannot gain a new write permission without changing the reviewed allowlist in the same pull request.

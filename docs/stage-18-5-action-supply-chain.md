# Stage 18.5 — GitHub Actions supply-chain integrity

Stage 18.5 hardens third-party code executed by GitHub Actions.

## Baseline

- Every external `uses:` reference in `.github/workflows` is pinned to a full 40-character commit SHA.
- Human-readable release tags remain as comments beside pinned SHAs so reviews can see the intended major action version.
- `scripts/check-workflow-action-pinning.mjs` fails closed when a workflow introduces a mutable tag, branch, missing ref, or shortened SHA.
- `npm run check:workflow-action-pinning` runs inside the repository `quality` gate.
- Dependabot now monitors the `github-actions` ecosystem weekly, so action updates arrive as reviewable pull requests instead of relying on mutable tags.

## Pinned action families

The current workflow set uses immutable revisions of:

- `actions/checkout`
- `actions/setup-node`
- `actions/setup-java`
- `actions/upload-artifact`
- `FirebaseExtended/action-hosting-deploy`
- `google-github-actions/auth`
- `google-github-actions/setup-gcloud`

This complements Stage 18.4: token permissions are least-privilege, while Stage 18.5 ensures the workflow code receiving those permissions and production credentials cannot silently change because an upstream tag moved.

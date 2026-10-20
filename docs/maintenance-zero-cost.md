# SW-330: zero-spend requirement

The owner requires no money to be spent on Maintenance. The prior Cloud Functions architecture is suspended, not accepted as zero cost. SW-331's deployment hold must land before any further Maintenance release. SW-333 PR #897 is draft pending this architecture revision; SW-334 must not be delivered using the suspended backend.

## Implemented hold

- TEST and Production release targets exclude Maintenance Functions.
- Both Firebase configurations reject an explicit Maintenance Functions deployment with a predeploy hook. Emulator development remains available.
- Live application builds hide Maintenance and block its routes through the existing access hook, even if a previous rollout setting says enabled. The Superuser setting explains the hold and cannot enable it.
- Maintenance API helpers reject before calling a live backend. No live configuration, tasks, document metadata or files are deleted or overwritten.
- Existing unrelated features, Firebase rules, appointment/membership protections and deployment checks remain intact.

This does not delete previously deployed resources, cancel a running deployment or guarantee that the existing Blaze projects have no charges. Cloud administration access was unavailable; any existing Maintenance functions, build artifacts and image storage need a read-only inventory before cleanup. Never disable project billing or remove shared infrastructure to accomplish this feature-level hold.

## Architecture constraint and required decision

Firebase Storage requires Blaze, including default buckets. Firestore and Hosting on an already-billed project also have metered usage. Direct browser SDK access would remove Functions/Cloud Build/Artifact Registry from Maintenance, but it would not guarantee a zero bill and must not be described as zero cost. Moving authorization into the browser without corresponding rules is unacceptable.

The complete shared workflow needs an agreed persistence host that cannot charge for overage, including private file storage and downloads, authenticated backend validation, backups and hosting. A candidate must provide a genuinely enforced free-plan quota with no billing fallback, or use group-owned server/storage capacity already available without incremental charges. Neither an alternate provider account nor an existing group server has been identified or authorized here. Local browser storage alone would break shared access, reload across devices and retained-document acceptance, so it is not a substitute.

Before implementation resumes, identify that host and confirm its quota exhaustion behaviour. Then adapt the existing Maintenance API boundary while retaining canonical membership, leader appointments, role unions, authenticated document access and separate TEST/Production data. Repeat access/rules, persistence, assignment and mobile acceptance against that final host. Do not enable rollout until that verification completes.

## Sources checked on 20-10-2026

- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 — Cloud Storage requires Blaze; no-cost usage does not remove billing eligibility.
- https://firebase.google.com/docs/firestore/pricing — free quotas and metered use.
- https://firebase.google.com/docs/projects/billing/spend-caps — caps can be delayed and overages are billed; not a zero-spend guarantee.

## Assurance and acceptance

Repository checks and focused cost-policy/deployment tests must pass on the PR head. This hold is not a delivered zero-cost shared Maintenance feature. Live TEST and Production Manual Testing remain pending. SW-330 and its children must not be marked Done based on the hold.

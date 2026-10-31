# SW-569 — controlled preactivation reconciliation and TEST readiness

Jira: https://kfeeney1.atlassian.net/browse/SW-569
Depends on merged SW-568/#964 and the canonical source adapters. Supports SW-560/SW-561.

## Boundaries

`npm run control:hall` is a private operator tool, not an HTTP endpoint. It uses existing ADC Firestore access plus a current Firebase ID token in `HALL_OPERATOR_ID_TOKEN`. Firebase Admin verifies the token, including revocation/disabled-account checks; actor UID is derived from verified claims and is never an argument. Keep the token out of command history, reports and logs. Each write transaction rereads active Superuser **and** Council authority. Maintenance imports additionally require current Maintenance/Calendar configuration and the actor's canonical maintenance access. These grants do not extend ordinary leaders' programme/member permissions.

Only the exact TEST project or a loopback `demo-` emulator can be mutated. Live Production writes are blocked, including when a caller supplies a misleading project argument to a mutation helper. Live TEST cannot use an Auth emulator; demo runs require both Firestore and Auth emulator configuration. No deployment, new service, email or automatic schedule is added. Production correction/readiness publication needs an explicitly authorised go-live change; this tool does not provide it.

Source reconciliation and final publication require both rollout booleans and both readiness booleans off, with no active TEST rehearsal. Neither mode offers a temporary readiness bypass. [SW-571](sw-571-hall-test-rehearsal.md) separately provides controlled TEST rehearsal setup and manual shutdown, without claiming acceptance or final publication. Existing source adapters still enforce off-state conflicts and can move/release their existing reservations. Readiness publication does not enable the independent Superuser Hall Hire switch.

## 1. Confirm facts and review a dry run

Start with SW-568's private inventory. Confirm resource use by opening the canonical protected record; never infer from location, section, title or event type. Use a private manifest with at most 100 unique source decisions and a horizon of at most 366 inclusive dates. Each decision is bound to the exact source updateTime version in the inventory. Hall decisions require an explicit unambiguous Dublin interval covered by that horizon. Non-hall decisions must omit interval data. Files are bounded to 1 MB; unknown keys, duplicate paths, missing dates/times and ambiguous DST inputs fail closed.

Schema example with synthetic facts only:

```json
{"schemaVersion":1,"from":"2026-11-05","through":"2026-11-06","decisions":[{"path":"events/synthetic-example","version":"1234567890:123456789","resource":"group-hall","interval":{"date":"2026-11-05","startTime":"18:00","endDate":"2026-11-05","endTime":"19:00"}}]}
```

```bash
npm run control:hall -- --mode=plan --project=coolock-ardlea-scouts-test --manifest=/absolute/private/manifest.json
```

The dry run reports record references, actions, blockers and a digest; no private programme, hirer/contact or notes are printed. It requires complete review of relevant legacy sources in its horizon, validates current source/audit/index/privacy state, simulates conflicts among proposed and existing one-off/recurring/blocked bookings, and rejects incomplete scans or projected scan-bound overflow. Stale/missing sources, unknown task ownership, missing current authority and unreconciled existing links block application. A clean diagnostic remains `activationApproved: false`.

Imports mark existing canonical sources; they never create duplicate source/manual records or move programme dates. Weekly meetings retain their canonical date. Open/closed events retain dates/section/audience/consent and reserve only within their canonical range. Explicitly confirmed historical use can also be backfilled for a closed meeting or completed event whose canonical end date is strictly before today; its closed/completed lifecycle is never changed. Closed future meetings and future completed events require their owning workflow, not an operator lifecycle override. Maintenance imports must match their already-recorded appointment interval, including all-day Dublin/DST boundaries and source task ownership. Use existing source workflows for changing/releasing already-managed hall use; the operator cannot silently override it or resolve an overlap by force.

## 2. Apply only the reviewed plan

```bash
npm run control:hall -- --mode=apply --project=coolock-ardlea-scouts-test --manifest=/absolute/private/manifest.json --plan=THE_EXACT_64_HEX_DIGEST
```

Application recomputes the dry run and rejects a changed digest before any writes. Every source then commits separately through the **same** shared source writer/global conflict lock, private day index, neutral public projection and immutable booking audit. Permissions, exact source version and linked task existence are reread inside the write transaction. Source updates patch hall metadata only and preserve creator/timestamp types, programme/member details, consent/audience and parent projections.

A private `hall/group/sourceReviews/{source digest}` receipt records the confirmed decision and exact Firestore creation identity; immutable receipt history and generic system audit are written atomically. Clients cannot read or forge these records. A non-hall review does not generate a booking record. Its lock revision still serialises the review. Imports and ordinary source writes share conflict handling, including concurrent submissions.

If a later source fails, earlier commits remain committed. Output distinguishes completed results, the failed reference/code and all remaining references. Obtain a fresh dry run before resuming; identical already-applied operations become no-ops without additional writes/audit. A crash or ambiguous response requires inspection and a new plan, never a claim that the whole batch rolled back. Existing source-version changes require renewed review; already-applied no-ops do not overwrite subsequent programme edits.

## 3. Legacy baseline and later lifecycle

Final readiness records a baseline from Firestore's consistent snapshot read time. Existing legacy non-hall decisions are attached to immutable Firestore creation metadata, not a client `createdAt` field. Later ordinary programme/date edits retain that explicit resource intent. Source deletion/recreation has a different creation identity and cannot inherit a prior legacy receipt.

After the baseline, newly created canonical sources default to non-hall until their owner explicitly reserves the hall through the normal UI. This is the resource model's default, not an inference from activity/location. Source creation metadata cannot be forged by client fields. Marked sources always need the matching canonical reservation and retain authoritative date/write protection. Explicitly released reservations retain cancelled booking/audit history; deletion of an already-released source is a valid historical reference. Active reservations with missing sources remain failures.

The auditor validates review ownership and current immutable history/audit evidence before using a legacy decision. Old receipts/history remain retained; a source-ID reuse does not erase prior generations. The baseline remains after readiness revocation, so rollback does not turn later legitimate non-hall records into perpetual ambiguous legacy records.

## 4. Record deployed TEST acceptance before final readiness

The operator must actually execute and record SW-561 deployed Firebase TEST acceptance. CI, emulator results and a clean reconciliation report do not constitute this evidence. SW-561's controlled TEST setup/cleanup uses the separate [SW-571 rehearsal modes](sw-571-hall-test-rehearsal.md); the final publisher still offers no provisional activation or evidence bypass. No actual acceptance file has been created by this implementation.

A private acceptance JSON object must contain exactly:

- `schemaVersion: 1`, `jira: "SW-561"`, `environment: "firebase-test"`, and `project: "coolock-ardlea-scouts-test"`.
- `commit` and `workerCommit`: the same exact 40-hex revision actually verified; `verifiedByUid`: the signed-in operator UID; `verifiedAt`: UTC ISO timestamp within the last 24 hours.
- `evidenceUrl`: the actual recorded Jira comment URL, `https://kfeeney1.atlassian.net/browse/SW-561?focusedCommentId=COMMENT_ID`.
- `passedChecks`: exactly `public-privacy`, `authorised-lifecycle`, `source-reconciliation`, `recurrence-dst`, `concurrency-adjacency`, `rollout-preservation`, `mobile-320`, `desktop-keyboard-focus`, `themes`, `enquiry`.

The operator attests the Worker revision and executed checks against that Jira evidence; these human outcomes are not invented or inferred by the code. The CLI independently fetches the fixed public TEST `build-info.json` without credentials or redirects, with a 4 KB/10-second bound. Its exact revision/environment/source and deployment time must match and precede acceptance. Emulator evidence is explicitly labelled synthetic and cannot be reused for live TEST. No production acceptance is inferred.

```bash
npm run control:hall -- --mode=readiness-plan --project=coolock-ardlea-scouts-test --from=2026-10-31 --through=2027-10-31 --evidence=/absolute/private/acceptance.json
```

Choose today's Dublin date through exactly 365 days later. Readiness checks **all** scanned legacy sources and all tracked occupied/index dates, including dates outside that display horizon. Every legacy record needs explicit ownership or review; unknown far-future/historical facts cannot be hidden by narrowing the horizon. Scan/occurrence limits still fail closed; large datasets require a separately designed consistent partition strategy.

Use the resulting digest with the same command in `--mode=publish --plan=THE_EXACT_64_HEX_DIGEST`. Publication rereads the complete snapshot, authority and evidence inside its write transaction. It writes server readiness, the safe `{ready:true}` projection, a private evidence/digest receipt and immutable system audit. A concurrent source/configuration change invalidates the reviewed plan. The Superuser switch remains off until separately enabled. Source facts, deployed Worker configuration and actual acceptance remain outstanding in this session; no live publication was run.

## Rollback, assurance and Android PMT

`--mode=revoke --project=coolock-ardlea-scouts-test` is audited and requires current active Superuser authority, even if Council membership was later revoked. It sets only readiness/private projection off, retaining bookings, reviews, baseline and history. The existing Superuser switch remains the ordinary UI rollback control and always permits switching off. Keep source writers/rules deployed while marked records exist; do not delete indexes or bypass conflicts.

The expanded read-only collector remains bounded to 12,011 document reads; operator planning/publication adds five current-authority reads (12,016 maximum). Normal usage depends on dataset size and consumes existing Firestore/Auth infrastructure; there is no new paid service or recurring job. No live credentials or records were inspected/changed by this implementation.

Development coverage includes strict manifests/environment isolation, exact source/creation versions, immutable review evidence, conflict races, partial/resumable commits, programme preservation, TEST evidence/deployment checks, baseline defaults and revocation. Deployed TEST acceptance and Production PMT remain separate. Production deployment remains unauthorised.

Android PMT after TEST setup: all themes/320px, visible focus and date controls; Council scope and booking/series lifecycle; source release/reschedule and concurrency/adjacency; public privacy and enquiry wording; native Back/draft preservation; switch off/on and revoked-readiness record preservation. Do not mark SW-164 or children Done from implementation/green CI alone.

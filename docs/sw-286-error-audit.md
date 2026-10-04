# SW-286 repository error audit and validation

Baseline: clean checkout of main `08aa2d4b7e85eb881bac35872b8fdfb1bf89a77e`.
Read SW-286 (no comments/links) and the complete SW-281 Production history through
PR #677. No open PRs at baseline. Quality, both E2E shards/aggregate, Rules, TEST
deployment, Branch Protection Audit and CI Guard subsequently passed on this SHA.
The connector denied direct branch-protection administration (403); the checked-in
audit requires quality/e2e and its live audit passed. The post-merge contract also
requires exact-SHA TEST deploy. No rules/configuration changes are made here.

The audit searched all frontend and backend source for catches/.catch, error/warn
logging, empty catches, generic error strings, error replacement, fire-and-forget
promises, network requests and Firebase operations. Initial frontend scan found
407 matches on 377 lines across 110 of 304 source files. Changes include shared error
boundaries, feature handlers and their domain validation helpers, not a UI redesign.

| Area | Finding | Treatment |
| --- | --- | --- |
| Auth / Leader Access | Generic login, raw exception dumps, reset delivery falsely implied, profile read failure indistinguishable from parent-only access | Safe category/reference, shared privacy-preserving reset helper; failed profile check has retry UI and grants no access |
| Members / parents / families | Raw messages, generic writes, console-only loads, optional lifecycle reads collapsed to empty | Common reporting; static business checks remain safe; optional lifecycle failures logged without granting parent access |
| Consent / medical / medications | Raw logs may carry private fields; candidate access errors swallowed | Safe diagnostic fields only; common failure references; candidate access catch now visible |
| Meetings / events / badgework | Generic writes/imports; cleanup exceptions discarded | Shared handlers and safe validation; rollback/superseded file cleanup logs without replacing primary cause |
| Finance / subscriptions / floats | Inconsistent errors and raw business exception text | Shared diagnostics and explicitly reviewed business/validation classes; retain save-versus-refresh distinction |
| Receipts | Per-feature code formatting, no common reference, upload timeout lacked code | Shared reference/context plus established safe Storage code; timeout code retained; denied upload cannot show previous upload success |
| Galleries / files / policies | Rejected multi-upload results lost; generic finish errors | Each rejection reports its cause/reference; partial uploads remain distinguishable; safe file-validation text retained |
| Equipment / stores / reports / settings | Raw exception rendering, console-only sign-out, generic save/export errors | Common UI reporting, visible sign-out failure; approved business checks preserved |
| Public forms / administration | Generic submit feedback; errors logged as entire objects | Common reporting without submitted payloads; operational/build checks show references |
| Backend / email | Unconfigured service silently returned; arbitrary HTTP error bodies copied into exceptions; server diagnostic lacked correlation | Service failures reject; status-bearing adapter excludes response bodies; safe server/browser correlation header |
| Secondary email / audit / refresh | Already-saved records could lose delivery evidence | Visible saved-record/email warning; safe diagnostic-only audit/refresh failures retain intentional non-fatal semantics |
| Runtime / async | Render dump includes error/info; unhandled actions have no UI | Render reference; uncaught action notice with sanitized diagnostics |

Intentionally retained: absent Storage object races, expected filtered parent
gallery candidates, local emulator gallery compatibility, legacy JSON decoding,
blocked local/session storage, expected inactive/unsupported role fallbacks,
public built-in content, clipboard manual-copy fallback, optional lifecycle/role
probes and speculative lazy imports. These remain fail-closed or non-operational
fallbacks. They are not mechanically converted into errors or permission grants.

All explicit frontend console error/warn calls now pass through the common
privacy boundary. Original cause remains in memory, but raw messages, component
props, sensitive request/response bodies and raw stacks are not persisted/logged.
The new diagnostic code vocabulary is bounded and context uses an allow-list.
Static domain errors receive explicit safe classes; interpolated/untrusted errors
retain the safe feature fallback. No authentication tokens or Firebase settings
are included in diagnostics.

## Deliberate failure injection (4 October 2026)

Performed separately from the test runner by rejecting service-boundary promises
with synthetic SDK errors, then exercising the actual shared report/receipt
helper. Also invoked the real backend adapter with an injected HTTP 503 response.
These are controlled local injections, not live Production failures or PMT passes.

| Failure | Retained evidence | User result |
| --- | --- | --- |
| Denied Firestore write | firestore/permission-denied; permission; ERR-8270F7F6378F | Member save failed; contact administrator |
| Storage photo upload denial | storage/unauthorized; permission; ERR-EF90C6223395 | Photo upload failed; contact administrator |
| Receipt upload denial | storage/unauthorized; transaction synthetic123; Scouts; ERR-B961696C4966 | Receipt upload denied; no success implied |
| Function unavailable | functions/unavailable; unavailable; ERR-CB6B8A5FC9D8 | Backend request failed; retry later |
| Network interruption | auth/network-request-failed; network; ERR-26773C3723EE | Sign in failed; check connection |
| Unexpected exception | unexpected; ERR-0AD50D21C0AB | Save settings failed; safe next action |
| HTTP backend failure | 503; backend/request-failed; ERR-ABC123ABC123 reused | Notification request failed; retry later |

For every case the UI string included its diagnostic reference, the exception
code/status survived, and synthetic private payload markers were absent from
user text and serialized diagnostics. Automated tests independently cover these
contracts, nested causes, validation, reference reuse and success without logs.

Local `quality:checks` (lint, unit, worker, contracts, typecheck/build) passed.
Local Chromium installation failed because the browser download returned an
invalid ZIP; no browser is installed. New desktop/mobile Playwright cases exercise
actual receipt upload denial and the common uncaught-action notice in the
repository's CI browser container. Firebase rules and full PR selection are
required remote evidence. Exact results/SHAs are recorded in the PR and Jira.

Client diagnostics remain console-only; no new persistent client logging service,
permissions expansion, Production deployment or Production PMT pass is implied.

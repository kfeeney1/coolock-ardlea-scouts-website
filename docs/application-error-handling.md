# Application errors (SW-286)

Report a failure at the boundary that owns the user action. The common module is
`src/services/applicationErrors.ts`. User text and developer diagnostics are
separate: never display or log an arbitrary SDK exception, its message, a request
body, response body, uploaded content, consent, medical data, passwords or tokens.

```ts
try {
  await saveRecord();
} catch (cause) {
  const failure = reportApplicationError(cause, {
    area: "Members",
    operation: "Save member",
    userMessage: "Member save failed.",
    identifiers: { recordId: memberId },
  });
  setError(failure.userMessage);
}
```

`applicationErrorMessage(cause, staticFallback, area, operation?)` is the equivalent
convenience helper for existing inline error states. Supply a static operation
such as “Save member”, rather than a member's name, email, file name or form value.
Defaults use the reviewed fallback text as the operation. No diagnostics are
emitted for successful calls.

The diagnostic contains a timestamp, configured environment, operation/area,
category, approved Firebase/application code, HTTP status, reference, safe source
locations, cause types/codes/statuses, and optional allow-listed identifiers.
Unknown exceptions remain unexpected; a bare TypeError is not guessed to mean
network failure. Firebase `unavailable` means the service could not complete the
request; it is distinguished from an explicit network error and from denial.

Only `recordId`, `transactionId`, `eventId` and canonical `section` are accepted
as context; values must be bounded storage-safe identifiers. Do not supply a
person's name, account UID, phone number, date of birth, form data, URL, file name,
file path, signed link or token. Sanitization is a final guard, not permission to
pass sensitive values. Never stringify an error to construct context.

`cause` retains the original object in memory and is deliberately non-enumerable.
The reporter does not serialize raw exception messages/stacks, customData or
arbitrary properties. Exception text can itself contain private medical or
provider payloads. Serialized diagnostics instead contain a safe code-based
summary and source basename/line/column locations, omitting function names,
absolute paths, hosts and query strings. Inspect the original cause in a local
debugger when deeper detail is needed, without persisting it. Repeated reporting
of the same exception for the same operation reuses its reference and console
record. Retrying a request that throws a new exception gets a new reference.

`UserInputError` permits reviewed validation text to reach the UI; use it only
for known validation output, never SDK/HTTP text. `UserFacingError` preserves
reviewed static business conditions without guessing a failure category.
`ServiceFailure` preserves a cause and supplies an explicit code/status for
adapter-generated failures. Do not wrap an SDK error merely to replace its text:
rethrow the original, or use `{ cause }` when a wrapper is necessary.

`requestBackend` marks fetch rejections as network errors at the fetch boundary,
retains HTTP status, and never consumes an unsuccessful response body. Backend
500 responses carry `X-Error-Reference` (exposed through CORS); its strictly
validated reference is reused in the browser report and server diagnostic.
Backend logs retain safe route, upstream category and status without recipients,
notification content or credentials.

Receipt helpers retain the established safe Storage code in addition to the
reference, distinguish check/upload/open/remove, and attach the transaction ID
and section. A failed receipt upload must clear earlier success progress.
Multi-file galleries report each failed transfer and distinguish partial success.

A saved record whose email notification fails uses `reportSecondaryFailure`.
It emits one warning through the application notice instead of rejecting the
successful write. Audit/refresh failures log a sanitized diagnostic and retain
the existing explicitly non-fatal behavior. Do not move success messages ahead
of the authoritative write. Do not encourage repeating an already saved action.

The render boundary provides a safe reference. `UnhandledErrorNotice` handles
otherwise uncaught runtime errors/rejected promises and suppresses the browser's
raw exception dump; handled errors remain in their feature UI. This is a final
fallback, not a substitute for feature-specific handlers.

## Investigating a reference

A browser `ERR-` reference identifies the matching “Application failure” console
record for that operation. Backend failures use the same ID in worker logs.
Ask for the complete safe message/reference, action, approximate time and
release/environment. Start with code, status, area, operation and identifiers.
Client diagnostics are not sent to a new remote collector or persisted in browser
storage by this change. Console records can disappear on reload; a receipt PMT
screenshot also retains its safe Storage code. Backend records follow existing
worker log retention. A durable client telemetry pipeline is separate work and
must define access, retention and data minimization before adding persistence.

## Intentional fallbacks

Keep expected absent-object races, legacy JSON decoders, private-mode storage
fallbacks, optional role probes, public-content fallback and lazy-route preloads.
Do not turn an expected absence into a failure toast. Catch callbacks in
SubsSettings and the badge-award dialog already delegate user feedback to their
parent handler and must not create a second toast. Clipboard fallback still lets
a user copy the displayed link manually. Preserve failed writes as failures.

Run `npm run quality:checks`, the selected PR Playwright suites and rules checks.
Unit coverage injects Firestore/Storage/Functions/Auth codes, HTTP/network errors,
unknown and nested causes, privacy payloads and successful requests. Browser
coverage checks uncaught action references and receipt upload rejection/recovery.

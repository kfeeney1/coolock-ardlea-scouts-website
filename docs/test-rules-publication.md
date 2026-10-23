# TEST Rules publication (SW-531)

The main TEST deployment uses the existing Firebase Admin SDK and the same TEST
credential to verify both Firestore and the explicit TEST Storage bucket Rules.
It compares the complete active source (including filename and additional files)
to the reviewed checkout. An exact match needs no republication. Changed source
is compiled by the Rules API's ruleset creation endpoint, published, then read
back to verify both the release reference and complete source.

The SDK only creates a missing release after NOT_FOUND; unlike the pinned CLI,
it does not mask every update failure with a create request and HTTP 409.
Transient HTTP 503 retains the existing four-attempt, 5/15/30 second budget.
An already compiled ruleset is retained across release retries. Other failures,
exhaustion or an unverified release stop deployment. Logs identify the stage and
HTTP status without SDK response bodies, credentials or participant data.

Only after both Rules releases are verified does the CLI deploy indexes and
Hosting. A temporary configuration retains the reviewed indexes and Hosting
settings, but omits Rules targets already handled above. This prevents the CLI
from recompiling Firestore Rules during an indexes-only deployment. The file is
created exclusively in the repository root and removed on success or failure.

No new API, IAM permission, application Rules change or backend is introduced.
Publication rejects Production, mismatched credentials, unexpected configuration
or Storage target, and emulator overrides. The normal seed, build metadata and
read-only live browser smoke gates remain in place. A successful deployment is
separate from Calendar live TEST acceptance and Production Manual Testing.

On failure, use the logged stage and status for investigation. Do not ignore a
Rules failure or deploy Hosting ahead of unverified Rules. A code rollback uses
the normal reviewed revert PR; it does not delete any active ruleset or source
record. Reverting the runner restores the previous CLI path and its known
duplicate-compilation and release-error masking behaviour.

## Compiler scope headroom (SW-532)

The first SDK deployment exposed an HTTP 400 at release publication after
ruleset creation. Firebase documents both compiler-stack 503 failures and
compiled executable size 400 failures for large inherited helper scopes:
https://firebase.google.com/docs/rules/rules-language#expression_complexity_and_compiler_limits

Live publication on main `6885a979` still failed with the classified compiled-size
error after both the scope changes and shared identity-expression reductions.
The candidate restores multi-consumer helpers to one shared declaration, keeps
60 single-consumer helpers local and retains the identity-expression reductions.
Root helper count alone is not a useful size budget: copying shared helpers into
several scopes made the local compiler representation substantially larger.

For comparison, the standalone compiler in the pinned Firestore emulator
`cloud-firestore-emulator-v1.22.0.jar` was invoked with let bindings, ternary
operators and cross-service Rules enabled. Each source used the same filename,
`firestore.rules`. Its `getRulesetAst().getSerializedSize()` reported:

| Revision | Local serialized AST bytes |
| --- | ---: |
| Previously published SW-339 baseline | 696,891 |
| Single-consumer localization (`2cee238d`) | 725,771 |
| Duplicated multi-consumer helpers (`0361f9ca`) | 923,421 |
| Identity-expression reduction (`6885a979`) | 923,397 |
| Shared declarations restored, identity reductions retained | 723,117 |
| Shared declarations plus incoming write-data aliases | 654,424 |

These are comparative local AST measurements, **not** the cloud compiled
executable size or proof of live acceptance. The final candidate is about 29%
smaller than current main on this measurement, and below the successful baseline.
Actual live release publication must pass before the deployment issue is resolved.

The incoming-data reduction moves 53 create/update conditions into local
single-consumer validators. Each receives `request.resource.data` once; its
original condition uses that parameter instead of repeating the member chain.
No read or delete condition is wrapped, existing-document data is not hoisted,
and guard order is preserved. Reverse-expanding the aliases reproduces all 231
original allow conditions exactly. All retained pre-existing helper bodies are
unchanged apart from indentation and their restored declaration scopes.

Source-contract tests retain their field, role and bounds assertions using the
incoming-data parameter, with a separate check that every validator is called
exactly once from create/update with canonical incoming data. Firestore and
Storage emulator suites exercise the deployed source directly. No coverage,
publication guard or permission condition is removed to obtain a smaller Rules
representation. Development checks, live TEST acceptance and Production Manual
Testing remain separate gates.

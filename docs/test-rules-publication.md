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

Collection-specific helpers now live in their sole consuming match rather than
being inherited by every match. This moves 60 helpers out of root scope, leaving
52 shared helpers. Function bodies and allow statements are unchanged. The
scope regression check limits root-helper growth and keeps representative
collection-only helpers local. Real permission behaviour remains covered by the
Firestore and Storage emulator suites.

HTTP 400 alone does not prove the executable size limit was reached. The runner
classifies known size/stack-limit messages into fixed safe labels; unrecognised
messages remain unclassified without exposing SDK payloads. Actual live release
publication must pass before this compiler-limit hypothesis is considered
resolved. No compiler failure is ignored or treated as a successful release.

The first live release after this reduction (main `2cee238d`) failed with the
classified compiled-size error, confirming the size diagnosis and showing that
52 root helpers were still too many. The follow-up leaves only 10 broadly shared
identity/section helpers at root. Helpers used by several collections are copied
unchanged into only their consuming scopes, and two unreferenced helpers are
removed. This trades a larger, still-under-limit source file (226,088 bytes) for
fewer inherited compiler symbols. Retained bodies and all 231 allow statements
remain unchanged. The regression ceiling is reduced to 14 root helpers. Actual
compiled size and live release acceptance must still be verified by deployment;
local emulator/CI success does not establish that the compiled-size limit passes.

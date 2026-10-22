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

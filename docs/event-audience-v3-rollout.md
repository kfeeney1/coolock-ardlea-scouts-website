# Event audience legacy records and refresh policy

The v3 audience model uses stable member IDs in `events/{eventId}/audienceMembers/{memberId}`. Legacy event records remain on their existing section or member audience path until an organiser deliberately changes the audience.

## No automatic audience backfill

Deployments must not rewrite legacy event documents or infer membership from display names. A background job must not turn legacy section events into a fixed snapshot: doing so could silently exclude later eligible section members or change an event's meaning.

Readers continue to resolve legacy audiences through the current section/member lifecycle rules. Parent visibility and consent continue to use the existing version-aware access path. No bulk refresh is required for a legacy event to remain usable.

## Explicit edit and refresh

Opening an event for editing is read-only. A save that changes event details but leaves the legacy audience unchanged preserves the original audience fields and does not create v3 membership rows. If the organiser deliberately changes the audience, the event document and the complete v3 membership set are committed together. A failed commit leaves the previous event and audience intact.

For a deliberate refresh of an existing audience, the organiser must review the effective recipients in the section-led builder and save the changed audience. The resulting v3 projection is deduplicated by member ID; attendance and consent history remain on the event record. Removals are confirmed, audited by count, and applied in the same batch.

This policy intentionally has no silent production backfill. Any future administrative migration must be a separately reviewed, dry-run-first operation with before/after recipient counts and explicit preservation of existing responses.

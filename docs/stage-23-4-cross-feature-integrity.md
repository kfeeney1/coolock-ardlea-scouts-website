# Stage 23.4 cross-feature integrity coverage

## Approach

This stage extends the existing read-only `firestore-operational-integrity` validator used by the live compatibility audit. It does not add a second audit, repair records or write to Firestore.

## Relationships covered

- Members must belong to a current youth section.
- Parent-account member links must resolve, and linked sections must include each linked child's current section.
- Weekly Meeting attendance entries and injury records must resolve to members; duplicate roster members and injury records outside the meeting roster are reported.
- Event attendance and consent member keys must resolve; consent entries must also be part of the event attendance roster.
- Event consent links must resolve to an event.
- Event consent responses must resolve to an event and link, agree with the link's event, and resolve any matched member. A response marked matched must contain a member link.
- Consent/medical applications with a populated member link must resolve to that member. Unlinked historical/public submissions remain valid because linking is an explicit workflow.

Adventure Skills keeps its dedicated catalogue-aware integrity validator, which already checks member, source, competency and award relationships. Equipment and finance relationships remain in the same operational validator. Receipt binaries are protected by Storage metadata/Rules and do not currently have an independent Firestore record to cross-link.

## Safety

Findings are deterministic report entries only. Production data is never changed, relabelled or automatically repaired by this audit.

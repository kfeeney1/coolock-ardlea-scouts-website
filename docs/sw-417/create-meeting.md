# SW-419 Create Meeting

The independent meeting workflow switch also controls Create Meeting. OFF keeps
legacy presentation and its navigation-save cancellation. ON shows section/date,
then theme, location and optional programme notes. Next-section-day defaults and
manual/calendar date overrides use the existing date component and service.

Create & plan commits the canonical meeting and parent projection first, then
opens `/leader/weekly?meeting=<id>&stage=plan`. The stage hint selects Plan even
for today's or historical meetings; it changes no permissions or lifecycle state.
Calendar-origin creation still preserves its date; explicit Cancel returns to
its validated calendar context. Successful Create & plan opens Plan as specified.

Meaningful drafts use the shared Save/Discard/Stay guard for Cancel, internal
links and browser/system Back. Discard writes nothing; Save creates once before
leaving; Stay preserves the form. Clear requires explicit confirmation for a
meaningful draft. A clean Cancel writes nothing. Browser reload retains the
standard before-unload warning; no separate draft storage is introduced.

The presentation is pinned during an active creation visit. A live rollout change
displays a notice and applies to the next editor visit. Inputs/actions are disabled
while creating. Repeated creation uses the same in-flight operation and remembers
the committed ID before audit follow-up. Audit failures cannot reset that ID and
cause duplicate creation. Offline attempts retain fields with an actionable error.
Read-only users see a denied state on the direct creation route; backend rules
remain authoritative. Empty rosters still prevent creation.

Validation is split from live TEST and PMT. The changed-area browser spec covers
clean/dirty cancellation, Stay/Discard/Save, Clear, system Back, creation/reload,
today's initial Plan, same-date distinct IDs, double activation, offline recovery,
live setting changes and denied direct routes. Existing record-integrity and
next-section-day suites verify the OFF experience and date defaults.

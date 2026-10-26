# SW-423 — Review badgework and notes

With Plan, Run and Review enabled, Review separates canonical Adventure Skills from meeting notes. The exact heading “Other badges completed — meeting notes only” explains that comma-separated per-present-member badge names do not update the canonical tracker. Additional notes keep the existing meeting field. Full member names and multiline badge notes wrap at narrow widths.

Adventure Skills uses the existing tracker, source type, meeting ID, present-member IDs, eligibility filtering and server protections. Clicking the action first awaits the existing complete meeting save, including leader attendance. A failed save stays on the meeting and retains edits; it cannot open the tracker. The source return link restores the same meeting in Review via the supported `stage=review` hint. `stage=plan` and `stage=run` are also supported in the redesigned experience. Unknown hints keep the existing date/status default. Stage hints grant no extra permission and OFF ignores them.

The empty-present state blocks handoff. Closed-meeting badgework stays locked, while authorised additional-note corrections retain existing permission checks. Read-only roles cannot edit either type of meeting note or enter the tracker from this action. OFF keeps its existing Completed Badgework presentation. No tracker data format, write service, roster scope, role or feature setting changes.

Review's explicit Save & close confirmation and wider lifecycle assurance belong to SW-424. The incident form's save integration belongs to SW-422; this handoff invokes the shared `saveForNavigation` boundary so that integration composes without a competing save path.

## Evidence gates

Full local quality:checks passed (919 unit tests, backend/worker tests, contracts and build). Real demo Firebase emulator testing passed 24 desktop/mobile cases with zero retries: all ten new Review journeys plus 14 shared shell/setting-matrix cases. After making full member names and multiline badge notes visible at 320px, four focused handoff/read-only cases passed again and screenshots were inspected. Local diagnostic Chromium153; pinned PR CI remains required.

Development/CI evidence is recorded separately from deployed TEST acceptance and owner Production Manual Testing. A green PR does not establish either acceptance gate. No Production deployment, feature enablement or Done transition is part of this change.

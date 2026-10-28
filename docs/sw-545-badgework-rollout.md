# SW-545: protected badgework configuration foundation

## Scope and delivery boundary

This PR adds the independent, default-off Superuser configuration document and
switch for the SW-428 delivery sequence. It does not contain a redesigned badge
renderer, leader/parent route branch or claim that enabling the setting currently
changes those views. The complete existing experience continues in either
configuration value at this foundation stage. SW-545 remains incomplete until
SW-546/SW-549 wire both complete experiences consistently. Artwork verification
under SW-544 remains outstanding. Do not enable this setting in Production as a
claim of completed rollout.

## Configuration contract

- Document: `siteSettings/badgeworkExperience`.
- `version`: `existing` or `redesigned`; absent/invalid defaults to `existing`.
- Exact write fields: `version`, `updatedBy`, server `updatedAt`.
- Signed-in readers may read this one presentation document. No collection list.
- Only an active Super Admin can create/update it, as enforced by Firestore Rules.
  Ordinary administrators, leaders, parents and inactive Super Admins cannot write.
- Only the Super Admin Settings page displays the concise `Badgework redesign`
  switch. It follows the established switch control and has no explanation blurb.
- The listener exposes server-confirmed values only. The switch remains disabled
  while loading or saving; failures show an error. A failed load offers Retry.
- Transactions compare the expected previous version and reject stale saves.
  No optimistic local flag is published to other views before server acknowledgement.

No navigation, meeting, schedule, attendance or other setting is read/written by
this configuration service. It never writes badge requirements, awards or any
parent projection. No duplicate progress store or migration is introduced.

## Integration requirements for subsequent PRs

Both leader and parent must consume this one configuration, via the same decoder.
Never grant capabilities based on presentation choice. Preserve canonical read and
write services, approved child/section boundaries and source protections.
Do not remount an active editor when a live rollout value changes. Retain its
selected members, skill/stage and draft through Save/Discard; apply the new
experience on a safe subsequent visit. Overview/parent should show saved data only.

The configuration control is testable independently of artwork. Routing must not
silently reinterpret an incomplete renderer or legacy Material icon as accepted
new artwork. SW-544 and the relevant leader/parent UI issues retain that work.

## Rollback once routing is integrated

As an active Super Admin, open Settings and switch `Badgework redesign` off.
Wait for `Badgework setting saved.` Reload the leader and parent badgework views
(or finish/discard the active editor before the next visit) and verify the existing
experience. All canonical competency records, awards and provenance remain in
place. No deploy, data copy or reverse migration is needed.

## Verification / manual checks

1. As Super Admin, use keyboard Space on the switch. Verify successful persistence
   and reload; switch off and reload again. Test both themes at 320px.
2. Confirm navigation/schedule/meeting/attendance settings do not change.
3. As ordinary administrator or leader, confirm the switch is absent. Verify direct
   backend writes from these roles, parents and inactive Super Admins are denied.
4. Reject unknown values, forged attribution/timestamps and additional fields.
5. Preserve the full existing badgework functionality at both values until the
   routing implementation is delivered. This PR is configuration assurance, not
   visual acceptance, deployed Firebase TEST acceptance or Production Manual Test.

## Development evidence

- Full `npm run quality`: production dependency audit (zero vulnerabilities),
  930 unit tests, worker/backend tests, repository contracts, complexity guard
  and TypeScript/Vite build passed against main without depending on PR #942.
- All 14 `public-admin-permissions.rules.test.mjs` cases passed on the real
  Firestore emulator, including the new configuration permission/malformed-write case.
- Ten focused Chromium/mobile Chromium cases passed with zero retries: default
  off, keyboard/reload/rollback, independent settings, both themes at 320px,
  ordinary administrator/leader visibility, backend revocation denial without
  optimistic change or success message, then successful retry after restoring access.
- The first browser run found an incorrect new-test assumption: Programme Scouters
  are redirected from Settings to the dashboard by the existing route guard.
  The test now asserts that redirect explicitly; no application permission was changed.
- 320px screenshots were inspected. No deployed Firebase TEST or Production
  acceptance was performed. Routing, canonical badge artwork and the redesigned
  experiences remain separate unfinished work.

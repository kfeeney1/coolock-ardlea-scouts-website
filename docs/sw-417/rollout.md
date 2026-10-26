# SW-418 meeting workflow shell

SW-417 owns individual meeting editing. SW-177 owns schedule browsing and Events;
SW-179 owns navigation. All three remain independent and retain Group branding.
The agreed 17 October design is specified in the live epic. Jira contains no
attachment entries; the existing meeting-menu-colours.html reference informs the
compact header, subtle theme-aware active stage and More actions menu.

## Rollout and rollback

The central `siteSettings/meetingExperience` document uses `version: existing`
(OFF, including a missing document) or `redesigned` (ON), `updatedBy` and server
`updatedAt`. Signed-in clients may read this non-sensitive presentation choice;
only an active Superuser may write it. Listing settings, extra fields, forged
actors/timestamps and other versions remain denied by Firestore Rules. Settings
uses a transaction to reject concurrent stale changes.

After deploying all implementation children and passing TEST acceptance, an
explicitly authorised Superuser can use Settings → Plan, Run and Review meeting
workflow. No migration, duplicated records or deployment is needed to switch.
Do not enable Production under the development authorisation.

For immediate rollback, turn the same switch OFF. New editor visits use the
existing experience. An editor already open keeps its chosen presentation through
stage changes and saves, displays a setting-change notice, and adopts the latest
choice after leaving or reloading. Save before reload; normal unsaved navigation
protection still applies. This pinning also protects OFF→ON sessions. No saved
meeting, equipment reservation, badgework or attendance is removed by rollback.

| Schedule setting | Meeting setting | List | Individual editor |
| --- | --- | --- | --- |
| OFF | OFF | Existing | Existing |
| ON | OFF | Redesigned | Existing |
| OFF | ON | Existing | Plan / Run / Review |
| ON | ON | Redesigned | Plan / Run / Review |

Future open meetings start in Plan, today's open meetings in Run, past or closed
meetings in Review using the group's Ireland date. Stage visits never change the
meeting lifecycle. Existing routes, record IDs, services, permissions, past-meeting
corrections, locked programme/badgework, copy/reopen/history and equipment remain.

## Delivery boundaries

SW-418 delivers the shell and rollout controls with existing panels grouped into
three stages. SW-419–424 separately deliver the redesigned creation, compact
programme, save-before-share, Run/Review refinements and lifecycle confirmation.
Do not treat the shell switch as authorisation for rollout of an incomplete epic.
SW-425 closes integration/accessibility gaps; SW-426 records deployed TEST evidence;
SW-427 is the owner's separate PMT gate. No gate is inferred from another.

## SW-418 verification

- Unit test: initial stage follows lifecycle and Ireland date.
- Real Firestore Rules: authenticated reads, active Superuser writes, denied other
  roles/inactive/anonymous writes, malformed metadata/version/extra fields/listing.
- Desktop and mobile browser: all four independent settings combinations,
  persistence across reload, direct routes, closed locks, no record mutation on
  stage visits, keyboard menu focus, 320px wrapping, dirty-stage retention and
  configuration changes while editing.
- Existing weekly workflow regressions continue to exercise OFF.

Record exact-head CI, live TEST SHA/roles and PMT separately in Jira. Shell
implementation is not deployed acceptance or a Production pass.

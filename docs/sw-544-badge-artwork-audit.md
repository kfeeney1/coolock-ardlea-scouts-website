# SW-544: badge artwork audit and progress foundation

Audit: 27 October 2026. Baseline main: 8a81201b (merged SW-425 / #941).

## Delivery state

SW-544 is **partial and blocked on verified stage artwork**. This PR adds a
presentation contract and executable semantic checks; it does not enable or
claim delivery of the redesigned UI. SW-545 through SW-550 remain outstanding.
The existing experience and records are unchanged.

No AGENTS.md was found in the checkout or its parent task directory. GitHub
reported no open PRs at reconciliation. SW-428 had no implementation children;
SW-544 through SW-550 were created under it. SW-410 and SW-397 remain completed
foundations. SW-417's merged SW-420 Plan and SW-423 Review integrations must
remain the owners of meeting workflow and tracker handoff; this redesign must
preserve their source parameters, attending-member scope, locks and return stage.

## Canonical catalogue and artwork inventory

Source: `src/data/adventureSkills/index.ts` and each definition, not the mockups.

| Skill ID | Supported stages | Verified original stage images in repository |
| --- | --- | --- |
| camping | 1-9 | None |
| backwoods | 1-9 | None |
| pioneering | 1-9 | None |
| emergencies | 1-9 | None |
| hillwalking | 1-9 | None |
| air-activities | 1-9 | None |
| paddling | 1-9 | None |
| rowing | 1-9 | None |
| sailing | 1-9 | None |
| swimming | 1-6 | None |

All 87 skill/stage mappings need verified artwork. Current
`AdventureSkillBadgeIcon.tsx` uses Material UI icons on coloured squares. These
are legacy illustrations, not original badge assets. Public/source asset
inventory contains no canonical badge images. Do not reuse these icons as the
redesign artwork or infer original colours from `ADVENTURE_SKILL_COLOURS`.

## Reference reconciliation

107398.png was materialized from the supplied reference and visually inspected.
It is a perspective/cropped nine-skill poster, showing Camping, Sailing,
Pioneering, Emergencies and Paddling rows plus an incomplete next row. It does
not supply all ten skills or the Swimming stage artwork. It shows original
symbols and numerals, not the Material icons currently used by the app.
The visible outlines agree in order with the epic: skill colour, red, grey,
lime, cyan, brown, purple, silver/light grey, gold. Pixel sampling of this
screenshot is not an authoritative brand palette. It cannot supply a complete
production asset set through cropping or recolouring.

Official source discovery:

- https://scouting360.ie/adventure-skills/
- https://scouting360.ie/wp-content/uploads/2025/09/adventureskills_handbook.pdf
- https://scouting360.ie/wp-content/uploads/2026/06/Swimming-Adventure-Skills-1-to-6-20mar2026.pdf

The programme page confirms nine original skills with nine stages, plus
Swimming stages 1-6. Both PDFs were downloaded; the original handbook sample
and Swimming cover/stage page were rendered and inspected. The Swimming
booklet supplies a skill emblem and page stage numbers, not a verified set of
six numbered, coloured-outline stage badges matching the reference. Combining
that emblem with invented numerals/outlines would be a new approximation.
The old handbook may provide recoverable original graphics, but no complete
87-image set with verified extraction bounds, stage identity and outline masks
has been established. These sources are candidates, not accepted asset mappings.

Unblock with an authoritative original export or approved source covering every
supported skill/stage, especially Swimming 1-6. Record source URL/file, revision,
checksums, skill/stage identity and visual verification per mapping. Preserve
proportions and original border pixels; derive an interior mask from verified
geometry rather than drawing approximate borders. Do not add Swimming 7-9.

## Shared semantics

`adventureSkillBadgeProgress` consumes canonical `AdventureStageOverview`
summaries already produced by `adventureSkillOverview`. Parent summaries reuse
that calculation and expand equivalent requirements through
`isStageRequirementComplete`. The helper checks stage and denominator, returns
visible counts/status and a fill fraction, and has no persistence or award path.
A historical awarded stage stays full colour while its competency count remains
truthful; completion alone is labelled Ready to award. Callers must pass either
persisted summaries or explicitly labelled unsaved drafts, never merge drafts
into the persisted overview/parent state. No new progress store is introduced.

## Delivery dependencies

1. SW-544: finish authoritative artwork mapping, border-preserving shared renderer
   and browser rendering checks. This foundation is not complete yet.
2. SW-545: independent default-off Superuser switch and complete old/new routing.
3. SW-546: leader Progress, filters, matrix/export.
4. SW-547: draft-aware Record workflow and source preservation.
5. SW-548: Awards queue/history.
6. SW-549: read-only parent overview/detail parity.
7. SW-550: regression, deployed TEST evidence and separate PMT plan.

## Android acceptance checklist for the completed rollout

- At 320px, open Progress with toggle off and on; test each supported theme.
  Verify header/emblem, filters, scrolling, readable badges and touch targets.
- Compare leader and linked-parent saved zero/partial/ready/awarded/next-stage
  data. Inspect counts, original border and bottom-up fill. Swimming stops at 6.
- Record for mixed members; Change members/stage, make individual/equivalent
  edits, verify Unsaved, Discard, Save/reload and failed save/retry. Parent and
  overview remain unchanged until successful persistence.
- Confirm selective/bulk awards explicitly, view provenance/history and confirm
  removal. Complete requirements alone must not award.
- Return from meeting/event recording to the same source; reject absent members,
  closed-meeting edits and unauthorised sections/children. Parents have no writes
  or leader export controls; verify direct links and multiple linked children.
- Use keyboard/focus and reduced motion; verify accessible names/status independent
  of colour. Test badge experience with navigation/schedule/meeting switches in
  both states. Roll back via the independent badge switch, retaining the records.

This is a future acceptance checklist, not executed TEST or Production evidence.

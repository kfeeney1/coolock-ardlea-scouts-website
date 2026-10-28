# SW-544: original badge artwork and shared progress renderer

Baseline: main 8a81201b. PR #942 remains an unfinished SW-544 delivery; it does
not enable the redesign or claim deployed TEST/Production visual acceptance.

## Verified original artwork

A deeper audit recovered the complete original numbered images for the nine
handbook skills. All 81 embedded images were extracted directly, without drawing
symbols, numerals or stage outlines. Original image canvases/proportions remain
unchanged, including the wider Backwoods/Sailing stage 2/3 sources.

Source: https://scouting360.ie/wp-content/uploads/2025/09/adventureskills_handbook.pdf

The source PDF checksum, original page and image-object reference, output image
size and checksum for each stage are recorded in
`public/badges/adventure-skills/catalogue.json`. The reproducible extraction
script is `scripts/extract-adventure-badge-artwork.py`; it rejects a different
PDF hash or missing page/object before extraction. Extraction used PyMuPDF 1.26.6. The PDF renderer converts the
original colour space to RGB for PNG display, without cropping, rotating,
resizing, replacing numerals or painting outlines. Original artwork © Scouting
Ireland / Scout Foundation; the source is linked above.

| Canonical skill | Supported stages | Verified images |
| --- | --- | --- |
| camping | 1-9 | All 9 |
| backwoods | 1-9 | All 9 |
| pioneering | 1-9 | All 9 |
| emergencies | 1-9 | All 9 |
| hillwalking | 1-9 | All 9 |
| air-activities | 1-9 | All 9 |
| paddling | 1-9 | All 9 |
| rowing | 1-9 | All 9 |
| sailing | 1-9 | All 9 |
| swimming | 1-6 | Missing all 6 |

Every original skill/stage numeral and symbol was visually checked in a contact
sheet, against the corresponding handbook stage pages. All 81 paths and hashes
are unique and their dimensions/checksums are verified by executable unit tests.
The shared mapping follows canonical catalogue validation; invalid stages throw
and missing Swimming originals return null. No skill/stage is inferred from
another badge.

## Reconciliation with 107398.png

The supplied reference is a cropped/perspective poster of the original nine
skills. Its Camping, Sailing, Pioneering, Emergencies and Paddling imagery agrees
with the recovered source images. It does not contain the complete catalogue
or Swimming. It confirms the outline sequence, but its sampled pixel colours
are not used as brand values. The renderer retains the original image's frame:

- Stage 1: original skill-coloured edge/background.
- Stages 2-9: original red, grey, lime, cyan, brown, purple, silver/light grey and
  gold outlines, including the source's actual hues and internal details.

No screenshot-based colour approximation or CSS-painted replacement outline is
used. Current `AdventureSkillBadgeIcon.tsx` remains a legacy Material-icon
component; it is not the new artwork source.

## Shared renderer and completion semantics

`AdventureSkillBadge.tsx` is a read-only presentation component for both leader
and parent use. It uses the single `adventureSkillBadgeArtwork` mapping and
`adventureSkillBadgeProgress` semantics. It has no Save, Record, award, management
or export controls and introduces no progress store.

The original image is the base. A slightly muted interior is clipped safely
inside the original frame, and an original-colour layer is revealed bottom to
top through that same interior. The conservative clipping regions leave the
source frame pixels intact; no border colour is selected or painted. At full
completion, the image is the original in full colour. Short update transitions
are disabled for reduced motion. Missing/failed originals have an explicit text
state; no generic icon, generated badge or borrowed skill is substituted.

Counts come from the existing canonical `AdventureStageOverview` calculation,
including shared/equivalent requirements. Completion divided by canonical total
controls fill. Completion alone is Ready to award, never an award write. A
historical award retains a full-colour badge while its competency count remains
truthful. Skill, stage, completed/total and status are visible; draft callers
must explicitly pass `unsaved`, producing Unsaved preview. Consumers must keep
persisted and draft inputs separate. Overview/parent integration is still owed
by SW-546/SW-549, and draft editor integration by SW-547.

## Remaining artwork blocker and delivery boundaries

The 2026 Swimming booklet is authoritative for six supported stages:
https://scouting360.ie/wp-content/uploads/2026/06/Swimming-Adventure-Skills-1-to-6-20mar2026.pdf

It supplies a skill emblem and page stage numbers, but a verified set of six
numbered stage badges matching the required outline treatment has not been
established. Do not compose those from a new numeral/border or add stages 7-9.
Obtain the six authoritative original stage assets/source before full-catalogue
visual acceptance. The new component remains unconnected to the live views;
SW-545's separate configuration foundation remains default off.

SW-410 and SW-397 remain completed foundations. SW-417's merged SW-420 Plan and
SW-423 Review integrations retain ownership of source handoff/return. Preserve
attending-member restrictions, closed-meeting locks and existing backend
permissions. SW-24 server-authoritative award enforcement remains out of scope.
No AGENTS.md was present in the checkout or parent task directory at reconciliation.

## Android acceptance checklist for the integrated rollout

- At 320px, test off/on and supported themes; retain Group header/emblem, filters,
  readable original badges, scrolling and touch targets.
- Compare leader/linked-parent saved zero/partial/ready/awarded/next-stage data.
  Check original outlines and count parity. Swimming must stop at 6.
- Record for mixed members; change members/stage and individual/equivalent edits.
  Verify Unsaved, Save/reload, Discard and failed save/retry. Persisted overview
  and parent data must not reflect an unsaved preview.
- Explicitly confirm selective/bulk awards; inspect provenance/history and confirm
  removal. Completing competencies alone must not award.
- Return to the same meeting/event; reject absent members, closed-meeting edits,
  unauthorised children/sections and parent writes. Check multiple linked children.
- Check keyboard/focus, reduced motion and status without colour. Exercise badge
  rollout with navigation/schedule/meeting settings in both states; switch off to
  roll back presentation while retaining canonical records.

This integrated checklist is not executed TEST or Production evidence. The
standalone renderer has separate unit and real-browser rendering regressions;
those do not establish leader/parent workflow acceptance.

## Development evidence for this renderer increment

- Full `npm run quality` passed: zero production dependency vulnerabilities,
  934 unit tests, 51 worker tests, 2 maintenance and 8 event backend tests,
  repository contracts, unchanged complexity guard and TypeScript/Vite build.
- Six focused Chromium/mobile Chromium cases passed with zero retries using the
  real bundled React component and the original PNGs. Pixel comparisons verify
  identical frame pixels at zero/half/full completion, unchanged muted upper
  interior and fully coloured lower interior at half completion. Historical
  awards retain the same full original image with truthful counts.
- Browser cases cover explicit Unsaved preview, Ready to award versus Awarded,
  missing Swimming artwork, real 404 image failure and successful Retry,
  read-only controls, 320px light/dark themes, status-label contrast of at least
  4.5:1 and reduced-motion transitions.
  Screenshots were inspected.
- All 81 asset paths, dimensions, checksums and catalogue mappings pass unit
  validation. No original image, stage boundary, retry policy or source ceiling
  was approximated or relaxed to obtain these passes.

This evidence is standalone development assurance. Full leader/parent routing,
recording/awards workflows, deployed Firebase TEST acceptance and PMT remain
outstanding. The six original Swimming stage images are still required.

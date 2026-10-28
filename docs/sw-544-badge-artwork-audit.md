# SW-544: original badge artwork and shared progress renderer

The handbook artwork foundation shipped in PR #942. This follow-up uses main
da6a7bce after merged #945 and resolves the authoritative Swimming source. It does not enable
rollout or claim deployed TEST/Production visual acceptance.

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
| swimming | 1-6 | All 6, original supplier photograph viewports |

Every original skill/stage numeral and symbol was visually checked in a contact
sheet, against the corresponding handbook stage pages. All 81 paths and hashes
are unique and their dimensions/checksums are verified by executable unit tests.
The shared mapping follows canonical catalogue validation; invalid stages throw
and all six Swimming stages resolve to distinct regions of the original
supplier photograph. No skill/stage is inferred from another badge.

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

## Verified Swimming originals and delivery boundaries

On 28 October 2026, the official supplier page lists separate Swimming level
1–6 variants and supplies a photograph of the original numbered badges:
https://thescoutshop.ie/products/swimming-skills

The exact original JPEG is retained byte-for-byte at
`public/badges/adventure-skills/swimming/original-stages.jpg`; source URL,
SHA-256, dimensions, byte length and observation date are recorded in the adjacent
`source.json`. No numerals, symbols, colours, frames or proportions were redrawn.
The source is a photograph of embroidered badges, unlike the other nine skills'
handbook illustrations; this difference is explicit rather than substituting art.

The single shared mapping selects source-pixel viewports. A viewport silhouette
excludes adjacent badges in the supplier's sheet, selecting only original pixels.
It does not paint an outline or change image bytes. Interior clipping is mapped
back into the full source photograph, preserving the original frame colours at
zero/partial/full completion. The source contains later badges too, but only the
six stages in the canonical programme are mapped. Stages 7–9 still throw and
cannot appear as supported badgework.

The 2026 programme booklet confirms those six supported stages:
https://scouting360.ie/wp-content/uploads/2026/06/Swimming-Adventure-Skills-1-to-6-20mar2026.pdf

The runtime component still handles missing/failed image requests explicitly.
Full leader/parent visual acceptance remains a deployed TEST/manual gate; source
recovery and unit/browser passes alone are not that gate. Normal rollout stays
off until workflow/parent integration and acceptance are complete.

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
outstanding. The Swimming source follow-up below supersedes the earlier missing-artwork
observation; deployed role/workflow acceptance is still required.

## Swimming source follow-up verification (28 October 2026)

- Full local `npm run quality` passed: 937 units, 51 worker tests, two maintenance
  and eight event-backend tests, audit, all repository contracts, unchanged
  complexity and browser-budget guards, and production build.
- All 18 pinned desktop/mobile Chromium cases passed with zero retries: the six
  existing renderer cases plus twelve Swimming cases (each supported stage in
  both projects). Checks include unchanged visible frame pixels, bottom-up colour
  reveal, canonical counts, unsaved labels, historical award appearance, no write
  controls, 320px, reduced motion, 404/retry and the six-stage boundary.
- All 87 supported mappings now have a verified original source. All 81 handbook
  PNG checksums stay unchanged; the supplier JPEG checksum is recorded separately.
  Stage images/screenshots were inspected against the supplier original.
- PR #945 is merged; this branch targets that main and replaces its original
  missing-Swimming expectation with positive original-photo loading and canonical
  count checks. The pending parent branch needs the same asset reconciliation
  when rebased. No tests, retries, timeouts or ceilings are weakened.
- Source recovery is development assurance, not deployed Firebase TEST acceptance
  or Production Manual Testing. Normal rollout is not enabled by this change.

After rebasing onto merged #945/main da6a7bce, fresh full Quality passed
937 units plus worker/backend/contracts/build. The combined original-artwork
and actual Progress run passed all 34 desktop/mobile cases with zero retries.
Progress now asserts real Swimming source loading and canonical counts, replacing
its original unavailable-artwork expectation. Existing failure/retry coverage is
retained with a real 404 interception, not deleted or weakened.

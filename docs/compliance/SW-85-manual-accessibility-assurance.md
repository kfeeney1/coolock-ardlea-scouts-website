# SW-85 — Manual accessibility assurance

## Evidence boundary

This record captures the manual-assurance work that must supplement the repository's automated accessibility regression coverage. It must not be interpreted as a declaration of full WCAG 2.2 AA conformance.

Baseline inspected for this work: `main` at `d681de4eb1f9cc940b261d43182437e142f9d998`.

Existing remediation was reviewed before this record was added. In particular, SW-74 expanded the baseline accessibility journeys, SW-81 added WCAG-oriented automated regression scanning, and SW-82 documented the report/generated-document accessibility boundary. Those controls are supporting evidence, not a substitute for the manual checks below.

## Core journeys in scope

Manual assurance should sample distinct interaction patterns rather than mechanically repeat screens that share the same implementation.

### Public
- Home and shared public navigation
- About / Meet the Leaders disclosures
- Activities and activity consent entry
- Contact Us
- Join Us
- Privacy information
- mobile navigation

### Authentication
- leader/scouter sign-in and sign-out
- parent sign-in and registration/request flow
- authentication validation and error states

### Parent
- approved Parent Portal
- linked children and things-to-do content
- consent/forms and events
- Adventure Skills
- pending, rejected and revoked access states

Parent onboarding must be rechecked against the SW-87 architecture if SW-87 merges before execution of a manual session.

### Leader / Scouter
Representative journeys should include dashboard/navigation plus distinct patterns from member management, weekly attendance, Badgework / Adventure Skills, consent, activities/events, reports, equipment and Parent Access management. Administration should be sampled only where available to the role used for testing.

## Manual session matrix

Record each actual session here. Do not mark an item passed unless it was manually exercised with the stated browser/assistive technology.

| Surface / journey | Browser / viewport | Keyboard | Screen reader / semantic review | Zoom / reflow | Mobile / touch | Result / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Public navigation and core public pages | Pending | Pending | Pending | Pending: 200% and 400% | Pending | Not yet manually evidenced |
| Leader authentication | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Parent authentication / registration | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Approved Parent Portal | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Parent pending/rejected/revoked states | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Leader dashboard/navigation | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Weekly tracker / attendance | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Badgework / Adventure Skills | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Consent / forms | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Activities / events | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Reports | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Equipment | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |
| Parent Access management | Pending | Pending | Pending | Pending | Pending | Not yet manually evidenced |

## What to record during each session

For keyboard-only use, exercise Tab, Shift+Tab, Enter, Space, Escape and arrow keys where the widget pattern requires them. Record focus order, visible focus, focus entry/return for transient UI, hidden/disabled focus behaviour, validation recovery and whether all required actions are reachable without pointer input.

For semantic/screen-reader review, record page title and heading/landmark structure, control names, form labels/required state, validation announcements, dialogs, menus/selects, tables, loading/success/error status changes and meaningful image alternative text. Icon-only controls must have useful names; merely having an `alt` or ARIA attribute is not sufficient evidence that the name is meaningful.

For dropdowns/selects/autocomplete, explicitly record keyboard opening, arrow navigation, selection, Escape, focus return, selected state, accessible name, anchoring, page-scroll stability and absence of invisible interaction-blocking overlays. This is a regression-sensitive area and must preserve browser/system Back behaviour.

For dialogs/drawers/menus, record focus entry, intentional focus containment, background inertness where appropriate, Escape/close behaviour, accessible close names, focus restoration and browser/system Back behaviour.

For zoom/reflow, test representative journeys at 200% and 400% desktop browser zoom and a narrow/reflowed layout. Record clipping, ordinary-content horizontal scrolling, overlap, disappearing controls, unusable tables/dialogs/dropdowns and sticky content obscuration.

For mobile, use the project's Pixel/mobile baseline where practical and record navigation, forms, Parent Portal and leader operational patterns, touch-target usability, dropdown/dialog behaviour and Back handling.

For colour/contrast, verify that section/status meaning is also present in text/icons/labels. Calculate contrast where a combination is questionable; do not rely on visual judgement alone.

For motion, check meaningful transitions and reduced-motion behaviour where applicable. For links/buttons, verify the accessible name describes purpose without requiring implementation knowledge.

## Defect classification

For each discovered barrier record: journey, reproduction steps, user impact, evidence, likely WCAG success criterion where reasonably established, and classification.

- **Fix now** — clear low/medium-risk defect, especially a shared-component issue that can be safely regression-tested.
- **Follow-up Jira** — substantial redesign, architecture/product implication, specialist assessment, or remediation that cannot safely fit this work block.
- **Requires review** — applicability or WCAG mapping is uncertain; do not invent a conformance failure.

Straightforward defects should not be deferred merely to close SW-85.

## Automated supporting evidence

The repository already contains `e2e/accessibility-baseline.spec.ts`, which checks representative public routes, personal-data privacy links, keyboard operation of the public consent section chooser, parent/leader sign-in structure and authenticated parent/leader structure. Existing WCAG-oriented regression work from SW-81 remains supporting evidence.

For any defect fixed under SW-85, add focused unit/component or Playwright regression coverage where practical. Do not weaken existing assertions, add arbitrary sleeps, skip coverage, or change Back/dropdown behaviour to make an accessibility test pass.

## Quality gate / closeout

Before SW-85 can be closed, run the repository's current lint, unit, email-worker, accessibility, repository/config/security, TypeScript/build and Playwright gates. Preserve SW-76 reliability hardening if it has merged by then.

The Jira closeout must record the exact tested browsers/devices/viewports, assistive technology, keyboard journeys, semantic/screen-reader work, 200%/400% zoom/reflow, mobile sessions, forms, dropdown/dialog checks, contrast findings, defects/fixes, WCAG mappings, regression coverage, follow-up issues, PR, merged SHA and final CI result.

**Current conclusion:** automated accessibility controls and previous remediation exist, but the manual evidence required by SW-85 has not yet been executed in this connector-only development environment. SW-85 must remain open until representative real manual keyboard, screen-reader and 200%/400% zoom/reflow sessions are performed and their results are recorded. This record deliberately does not claim full accessibility or WCAG 2.2 AA conformance.

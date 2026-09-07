# Section colour usage guide

This guide closes the SW-20 cross-site audit and defines where the shared Scout section visual tokens should be used. The canonical token implementation remains `src/theme/sectionColours.ts`; UI code must consume those tokens through the shared section-aware components rather than introduce raw section colour values.

## Use section colour for orientation

Use a restrained section accent when the user is looking at, choosing, or comparing a clearly identified Scout section. Appropriate examples are section selectors, section-labelled member/child/leader cards, meeting-history cards, section identity chips and other compact surfaces where section is part of the record identity. Keep the written section name visible so colour is never the only cue.

Cross-section and group-wide states remain neutral. In particular, `All sections`, Group, Other, unknown and unassigned contexts must not borrow the colour of an arbitrary youth section. A selected section may colour the selector itself, but selecting `All sections` returns it to the neutral token set.

## Do not use section colour for status or severity

Do not apply section colours to errors, warnings, success states, medical or injury information, safeguarding information, attendance states, consent status, badge-award status, destructive actions or other operational severity/status signals. Existing semantic colours for those meanings take priority. Section-aware cards may carry a small identity accent while their status chips continue to use the existing semantic palette.

Adventure Skill colours are also a separate visual language. Skill, level and award controls keep their Adventure Skill/status colours; only a section filter or member section identity should use Scout section tokens.

## Cross-site audit findings

The shared controls and card work from SW-17 through SW-19 already covers Leader Access and the principal member/child/leader card surfaces. SW-20 closed two remaining high-value gaps: Badgework Overview now uses the shared section-aware selector, and Weekly Meeting History uses the shared selector plus restrained section identity on each single-section meeting card.

The audit deliberately leaves group-wide report summary tiles, finance and equipment surfaces, generic navigation, date/search controls, attendance controls, incident/medical UI, consent/safeguarding UI, Badgework progress/award states, alerts and destructive actions neutral or semantically coloured. Those surfaces either span sections or already communicate a more important operational meaning.

## Accessibility and responsive rules

Section identity must always include text. Decorative swatches are hidden from assistive technology, while the labelled control/card remains the authoritative accessible cue. Focus rings come from the shared section tokens and must remain visible in both supported themes. Do not lower text contrast to match a section colour. Section accents must stay compact enough that mobile layouts retain the same hierarchy and usable tap targets as desktop.

When introducing a new section-context surface, prefer `SectionSelect`, `SectionOptionLabel`, `SectionIdentityChip`, `SectionToggleButton` or `sectionCardSx`. If none fits, extend the shared abstraction rather than adding a one-off colour implementation.

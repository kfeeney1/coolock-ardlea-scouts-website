# Scout section colour style guide

## Source and section identities

The application uses the current Scouting Ireland ONE Programme section identities: Beavers, Cubs, Scouts, Ventures and Rovers. The approved visual direction follows the supplied ONE Programme reference: Beavers red, Cubs green, Scouts orange, Ventures purple and Rovers lime.

Current ONE Programme programme resources can be found at https://scouting360.ie/. Scouting Ireland's current programme material also uses the five-colour ONE Programme visual language. The application token values in this repository are accessibility-adjusted product colours; they are not presented as unpublished official Scouting Ireland brand hex specifications.

## Single source of truth

All section-associated UI must resolve visual styling through `src/theme/sectionColours.ts` and `sectionVisualTokens(section)`. Components should not copy or hard-code section hex values.

The token set provides a section accent, subtle background, border, foreground, hover background, selected background, focus ring and disabled-state colours. Unknown, group-wide and unassigned section values resolve to a neutral fallback.

## Usage rules

- Keep the section name, icon or other textual context visible where section identity matters. Colour must never be the only signal.
- Prefer restrained identity cues such as a border, dot, chip, avatar ring, header accent or subtle selected background. Do not turn entire screens or dense lists into saturated section-colour blocks.
- Use the provided foreground token on the provided subtle, hover and selected backgrounds. Unit tests protect WCAG AA text contrast and visible focus contrast for those combinations.
- Use the focus token for a clearly visible keyboard-focus treatment when a section-coloured component needs one. Preserve the site's existing focus semantics rather than replacing them with colour alone.
- Use the neutral fallback for group-wide, multi-section or unassigned contexts unless a component explicitly represents several labelled sections individually.
- Error, warning, medical, safeguarding, attendance and other status/severity colours take semantic priority. Section colour must not make those states ambiguous.
- Disabled controls must remain visibly disabled and must not imply an actionable section selection.
- The default and Modern Scout themes share the same semantic section identity tokens. Components should remain theme-agnostic and consume semantic tokens rather than branching on theme name.

## Mapping

| Section | Identity hue | Application treatment |
| --- | --- | --- |
| Beavers | Red | Accessible dark red foreground/accent with pale red surfaces |
| Cubs | Green | Accessible dark green foreground/accent with pale green surfaces |
| Scouts | Orange | Accessible burnt-orange foreground/accent with pale orange surfaces |
| Ventures | Purple | Accessible dark purple foreground/accent with pale purple surfaces |
| Rovers | Lime | Accessible dark lime/olive foreground/accent with pale lime surfaces |
| Unknown / group-wide | Neutral | Slate neutral fallback |

Future section-aware controls and cards should extend these semantic patterns rather than introducing new one-off shades.

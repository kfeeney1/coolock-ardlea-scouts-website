# Leader navigation accessibility (SW-185)

Baseline: SW-184 merged as `f092ba51e7243a9e3202476d0dd2f567bb1ebefa`.

The existing and redesigned menus retain mounted control targets while closed, using hidden layout and `inert` to prevent interaction. Redesigned category panels follow the same rule: their `aria-controls` targets exist, only one is visible, and collapsed destinations are excluded from keyboard navigation and the accessibility tree. Unauthorized destinations are still omitted by the canonical permission filter.

Navigation links request focus on the destination's Leader Menu trigger after route arrival. This gives keyboard users a visible control whose accessible name identifies the current page. Escape returns focus to the same trigger. The focus request is internal router state; it grants no page or data access. Route guards, Back handling, persistent navigation selection and branding remain unchanged.

Theme-option captions use full-opacity text. The redesigned active destination uses the theme’s primary text colour while retaining its coloured border and selected background. Initial axe checks detected 3.74:1 caption contrast and 4.49:1 Modern Scout active-link contrast; these checks remain enabled without exclusions.

## Automated development checks

`e2e/leader-navigation-accessibility.spec.ts` exercises the actual UI on desktop Chromium and an Android-sized Chromium viewport:

- Tab/Enter/Space category and destination navigation in both modes;
- expanded state, exactly one visible panel, collapsed links skipped and route-derived active identity;
- visible redesigned category focus outline and destination arrival/Escape focus;
- mounted control relationships and absent restricted Super Admin controls;
- axe-core WCAG A/AA, WCAG 2.1 AA and best-practice checks on the Leader navigation header;
- contrast checks in Current, Modern Scout, Irish Adventure, Bold Campaign and Programme Explorer themes;
- 44px minimum targets and horizontal reflow at 393px and 320px.

Existing version/permission, active-state and Back suites verify functional parity. The viewport meta setting must continue to allow user zoom; narrow reflow checks do not substitute for physical pinch-zoom verification.

## Manual acceptance still required

Development automation is not a screen-reader or Production pass. Record the environment, deployed SHA, device/browser/assistive-technology version and result for each check below during SW-189 TEST acceptance and later PMT:

1. Use only a keyboard to open the menu, expand/collapse categories, select a destination and close with Escape. Confirm the focus ring is visible and unclipped throughout.
2. With Android TalkBack, confirm the menu and categories announce names and expanded/collapsed state; collapsed and unauthorized destinations are absent. Confirm reading order remains logical after destination selection.
3. Use physical Android Back with the menu open, then from a destination, detail page and guarded editor. Confirm expected dismissal/return behavior.
4. Pinch zoom and enlarge text on mobile; check wrapping, target usability, no horizontal menu overflow and retained Group emblem/header.
5. Repeat representative single-appointment, multi-appointment and Superuser journeys, recording permission visibility and active state.

Manual keyboard, screen-reader/TalkBack, physical zoom/Back, live Firebase TEST acceptance and PMT remain pending. No Jira is marked Done by the automated checks.

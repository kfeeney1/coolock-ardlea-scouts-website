# Stage 20.2 navigation and information-architecture review

## Scope

This review covers the leader navigation shell after the operational/security hardening work in Stages 18 and 19. It is deliberately presentation-only: routes, authorization, Firestore Rules and domain capabilities remain unchanged.

## Findings

The existing grouped navigation is a good baseline. Programme is correctly first, with Weekly Meetings followed by Events & Activities and Badgework. People/parent work, group operations, reporting and administration are separated into understandable groups, and mobile already uses one expandable group at a time.

Two information-architecture gaps remained:

1. The dashboard itself was not represented as a navigation destination. Once a leader entered a feature, the only route back to the overview was browser navigation or another indirect journey.
2. On the `/leader` overview the menu labelled the current context as Programme even though no Programme page was active. This made the collapsed mobile menu imply a location the user had not selected.

## Stage 20.2 changes

- Add Dashboard as an explicit first-class navigation destination.
- Use exact matching for `/leader` so every nested leader route is not incorrectly treated as the dashboard.
- Provide a visible Dashboard shortcut beside the collapsed menu while inside a feature.
- Keep Dashboard inside the expanded menu as well so keyboard/mobile users have the same destination.
- Do not default the active mobile group to Programme when the current route belongs to no group.
- Preserve the current grouped order and role filtering.
- Expand the desktop grid to five columns at extra-large widths so the five primary groups form a stable single-row information architecture when space permits.

## Security and functional invariants

This work must not:

- add a route a user was not already permitted to visit;
- change `adminOnly` or Activity Log visibility rules;
- alter Firestore reads, writes, Rules or authentication;
- change theme-driven functionality;
- expose parent/member data in navigation labels;
- remove the 44/48px mobile touch-target baseline;
- remove active-page `aria-current` semantics or Escape/focus handling.

## Follow-up

Stage 20.3 reviews loading, empty and error states across representative public, parent and leader workflows. Later Stage 20.6 performs the broader mobile operational pass; this PR only fixes the navigation architecture issues found here.

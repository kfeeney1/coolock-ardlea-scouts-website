# Accessibility regression testing

The Scout website uses layered accessibility regression checks in Playwright. These checks are engineering guardrails; they are not a certification of WCAG 2.2 AA conformance and do not replace manual assistive-technology testing.

## Existing baseline

`e2e/accessibility-baseline.spec.ts` verifies representative routes for document language, a single main landmark, a single H1, image alt attributes, accessible names on visible controls and basic keyboard focus. Mobile accessibility/reflow suites cover representative small-screen behaviour.

## WCAG-oriented scanner

`e2e/wcag-regression.spec.ts` extends the same Playwright architecture without depending on an external scanning service. It checks representative existing public, parent and leader surfaces for recurring machine-detectable problems including:

- duplicate IDs;
- broken `aria-labelledby` and `aria-describedby` references;
- visible interactive controls without accessible names;
- visible form controls without programmatic names/labels;
- positive `tabindex` values that override natural focus order;
- unnamed dialogs; and
- visible data tables without header cells.

The existing accessibility baseline remains the authoritative automated guardrail for page-level landmark and H1 structure. The WCAG-oriented scanner intentionally does not treat skipped heading levels as an automatic failure because heading hierarchy requires page-context judgement and visual typography components can otherwise create false positives.

The suite also scans the consent flow after keyboard activation, an approved parent workflow when canonical E2E credentials are available, and the leader reports surface when leader E2E credentials are available.

Only routes that currently exist in the application are scanned. Planned routes, including future privacy-information work, must be added to the representative route set when they are implemented rather than causing false failures before the route exists.

## Intentional limitations

No accessibility finding is suppressed at the time this document was added. If a future suppression is necessary, it must be narrow, documented in the test with the affected route/component and rationale, and must not be used merely to make CI green.

Automated checks cannot reliably determine all WCAG requirements. Manual review remains necessary for screen-reader quality, meaningful alternative text, instructions and errors, focus management, heading hierarchy, zoom/reflow, non-colour cues, complex widgets, generated documents and subjective content quality.

# Stage 21.1 — Field-use backlog and friction baseline

## Scope

This review starts from `main` after PR #333. It uses the current application, Stage 20 findings, recent pull-request evidence and existing deterministic Playwright coverage to identify concrete field-use friction before implementation begins.

It does not treat the parked production TEST-data cleanup, branch-protection configuration, unavailable production Storage capability or the future managed non-production restore exercise as product work. It does not change application behaviour, data, Rules, RBAC, fixtures or CI.

## Evidence reviewed

- `src/pages/WeeklySectionTracker.tsx` and the weekly meeting Playwright flows for creation, attendance, programme planning, copying, closing, history, WhatsApp sharing and Adventure Skills hand-off.
- `src/pages/EventRecordPage.tsx`, `src/pages/MemberRecordPage.tsx` and their record-navigation coverage.
- `src/components/parent/ParentThingsToDo.tsx` and `e2e/parent-approved-journey.spec.ts` for parent action discovery and direct consent paths.
- `src/pages/LeaderCommunications.tsx` and `e2e/leader-communications.spec.ts` for compose-first email and WhatsApp workflows.
- Stage 20 navigation, state, search/filter, action-feedback, mobile and product-maturity reviews.
- PR #333, which removed a duplicate Dashboard action reported after Stage 20 closeout.

## Findings that should not become backlog

Several important paths already have evidence-backed shortcuts and should be preserved rather than rebuilt:

- Parent **Things to do** identifies the next consent action and scrolls directly to event or medical/consent work.
- Event tiles open a full record containing attendance, consent, badgework, gallery, equipment, report, export and edit actions.
- Member tiles open a consolidated member record with details, consent/medical indicators and history.
- Weekly Meetings hands present children into Adventure Skills and supplies a return path to the source meeting.
- Parent Communications composes the message before recipient selection and keeps WhatsApp sharing on the compose step.
- Stage 20.4 already standardised search/filter/reset behaviour on Attendance Insights, Equipment and Reports; those completed surfaces are not reopened without new field evidence.

## Prioritised backlog

### 1. Protect unsaved Weekly Meeting edits — high priority, Stage 21.2

- **User task:** A leader edits attendance, programme, badgework notes, incidents or meeting notes and then returns to the meeting list or starts the copy workflow.
- **Evidence:** `WeeklySectionTracker` holds edits in local `selected` state until **Save Meeting** is used. The **Meetings** action clears that state and **Copy Meeting** changes workflow without a dirty-state check. By contrast, Badgework explicitly tracks drafts, warns before unload and confirms context changes; its Playwright coverage protects that behaviour.
- **Current friction/risk:** A leader can lose a set of operational edits without a warning. This is more consequential on a long mobile meeting form where the sticky save action may be reached after several task tabs.
- **Expected improvement:** Track whether the meeting differs from its last persisted snapshot and use the existing accessible in-app confirmation pattern before abandoning or replacing an edited meeting. Successful save should reset the dirty state.
- **Regression boundary:** Preserve closed-meeting edit permissions, audit writes, copy reset semantics, zero native dialogs and mobile-safe dialog actions. Add one focused Weekly Meeting regression; do not duplicate the full lifecycle suite.

### 2. Make Meeting History findable as it grows — high priority, Stage 21.2

- **User task:** A leader finds a previous meeting to review, correct or copy.
- **Evidence:** `WeeklySectionTracker` renders every closed meeting in one unfiltered **Meeting History** list. Existing Playwright coverage locates history by exact date/section text, while Stage 20.4 established a shared search/filter/reset contract for other high-use operational datasets.
- **Current friction/risk:** The list becomes progressively slower to scan and requires manual scrolling across sections and dates. This directly affects the established review/copy workflow rather than adding a new capability.
- **Expected improvement:** Add client-side search plus section/date filtering over the already-authorized meeting snapshot, a result count, a clear no-match state and one **Reset filters** action consistent with Stage 20.4.
- **Regression boundary:** Do not broaden Firestore scope or add repeated reads. Preserve the open/history split, role-based view/edit labels, copy semantics and deterministic seed contract. Extend the existing weekly history test rather than creating a separate end-to-end journey.

### 3. Lock the single-Dashboard navigation contract — medium priority, Stage 21.2

- **User task:** A leader uses the menu on a feature page to return to the Dashboard.
- **Evidence:** PR #333 removed a second Dashboard action that remained after the Stage 20.2 navigation work. The fix changed only `LeaderDashboardHeader.tsx`; current navigation tests cover discoverability and mobile expansion but do not explicitly assert that exactly one Dashboard destination exists when the menu is open.
- **Current friction/risk:** The visible duplication is fixed, but the intended single-entry contract is not directly protected and could regress during later navigation refinement.
- **Expected improvement:** Add a narrow desktop/mobile assertion that an expanded leader menu exposes exactly one Dashboard link and that it returns to `/leader`.
- **Regression boundary:** No new navigation element, route or Playwright journey. Preserve exact `/leader` active matching, grouped RBAC visibility, keyboard focus/Escape handling and the Pixel 7 viewport contract.

### 4. Validate the parent task summary after mutations — medium priority, Stage 21.3 discovery

- **User task:** A parent completes event consent or updates a linked consent/medical form and returns to the portal summary.
- **Evidence:** `ParentThingsToDo` loads its own task summary on mount, while consent and medical editors manage their own save/reload state. Existing parent journey coverage proves discovery and opening paths, but does not demonstrate that completed work is reflected in **Things to do** without a page reload.
- **Current friction/risk:** Repository evidence identifies a possible stale-summary hand-off, but not yet a confirmed defect because the current deterministic journey deliberately avoids persistent mutation.
- **Expected improvement:** First reproduce safely with emulator-backed transient data. If confirmed, refresh or reconcile the summary after successful child-workflow completion without reloading unrelated parent data.
- **Regression boundary:** This remains a discovery item until reproduced. Do not mutate canonical fixtures, expose additional parent data, weaken link/approval checks or add speculative reads.

### 5. Review communication recipient discovery at real section scale — lower priority, Stage 21.5 discovery

- **User task:** A leader selects the intended parent recipients for a message.
- **Evidence:** Parent Communications supports section filtering and select/clear visible, but the recipient step has no name search. Current deterministic coverage validates a section-scoped ordinary-leader flow, not a large administrator recipient set.
- **Current friction/risk:** This may create avoidable scanning for administrators or multi-section leaders, but the repository does not establish actual list size or frequency.
- **Expected improvement:** Gather field evidence first. If confirmed, add client-side name search and the established result/reset semantics over the existing authorized snapshot.
- **Regression boundary:** Do not change recipient eligibility, section scope, per-recipient worker authorization, audit privacy or WhatsApp behaviour. Do not add Playwright coverage until the friction is confirmed and implemented.

## Recommended implementation order

1. Stage 21.2: protect unsaved Weekly Meeting edits.
2. Stage 21.2: add Meeting History discovery controls.
3. Stage 21.2: add the narrow single-Dashboard regression, preferably with the first navigation-related slice rather than as a standalone broad test PR.
4. Stage 21.3: reproduce the parent summary refresh hand-off using transient emulator data before choosing a fix.
5. Stage 21.5: collect real recipient-list evidence before changing communications.

Each implementation should remain a focused PR. The two discovery items do not authorize a product change until their friction is reproduced or supported by field-use evidence.

## Preserved boundaries

All Stage 18–20 controls remain mandatory: security and RBAC, provenance, deterministic fixtures, recovery safeguards, Firestore read budgets, CSV/export protections, mobile operational coverage, mobile-safe dialogs and medication details, and zero browser-native `alert`, `confirm` or `prompt` calls under `src`.

Production TEST-data cleanup remains parked and must eventually use the guarded dry-run/manifest/backup process. Production data must never become Playwright fixtures, and Storage-backed production behaviour remains capability-gated while Storage is unavailable.

## Stage 21.1 conclusion

The baseline identifies two confirmed high-priority Weekly Meeting refinements, one small regression gap from a newly fixed field issue, and two evidence-gathering candidates. No broad feature expansion or application change is justified in Stage 21.1 itself.

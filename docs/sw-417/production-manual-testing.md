# SW-427 — Owner Production Manual Testing plan

**Status: NOT EXECUTED. No Production pass is recorded.**

This is a plan for the owner to execute against a separately authorised Production release. It does not authorise or perform deployment, enable the redesign, or establish acceptance. SW-425 development/CI, SW-426 deployed Firebase TEST acceptance and this Production Manual Testing gate require separate evidence. Keep SW-427 pending until the owner reports results; do not infer a pass from merges or green CI.

## Execution record

Complete these fields before execution. Use DD-MM-YYYY for full numeric dates.

| Field | Owner records |
| --- | --- |
| Execution date/time and tester | Not executed |
| Production URL and confirmed environment | Not recorded |
| Exact deployed commit SHA / visible build version | Not recorded |
| Separately authorised release / rollout decision | Not recorded |
| SW-425 CI evidence at that version | Pending |
| SW-426 TEST URL, exact SHA, role evidence and result | Pending |
| Device, browser, viewport and assistive technology | Not recorded |
| Theme and both original feature-setting states | Not recorded |
| Synthetic meeting/member/leader IDs used | Not recorded |
| Result, evidence links and linked defects | Pending owner execution |

Use synthetic, clearly labelled meetings and appropriately consented test identities within permitted sections. Include one dual-section member, a guest programme leader, a helping registered leader, one present and one absent member. Avoid changing a real meeting or a real competency record for this exercise. Record IDs so test records and deliberate copies can be reconciled afterward. Do not send a programme to real parents as a test; inspect the prepared WhatsApp payload, and use an owner-controlled test destination only if deliberately approved by the owner.

Representative accounts: Programme Scouter for one section; Section Leader; Group Leader or Deputy Group Leader; Group Secretary (read-only); active Superuser; an account without access to the target section. Use separate browser profiles where role/session isolation matters. Never put passwords, medical details or personal data into Jira evidence.

## Setting baseline and controlled rollout matrix

The meeting switch is **Superuser Settings → Plan, Run and Review meeting workflow**. It is independent of the schedule redesign. Missing meeting settings default to OFF. Record the existing Production states first. Only the owner, under the separate rollout decision, may enable ON for this manual exercise; this plan has not enabled it.

| Schedule setting | Meeting setting | Expected schedule | Expected Create/editor | Owner result/evidence |
| --- | --- | --- | --- | --- |
| OFF | OFF | Existing | Existing | Not executed |
| ON | OFF | Redesigned | Existing | Not executed |
| OFF | ON | Existing | Create & plan; Plan / Run / Review | Not executed |
| ON | ON | Redesigned | Create & plan; Plan / Run / Review | Not executed |

For every supported combination, open the meeting through the schedule and its canonical direct link, reload, then revisit in a new signed-in session. Verify the persisted selection, same record ID and no duplicated meeting. An ordinary leader must not be able to change the protected switch or gain access through its direct Settings route. Retain the backend Rules evidence for rejected unauthorised writes as a separate CI/TEST check.

While an ON editor contains an unsaved incident and programme edit, change the setting to OFF in the Superuser profile. The editor must display the setting-change notice and keep its current presentation, focus/data and stages through saves. Save deliberately, leave, then revisit: the existing editor must load the same saved data. Repeat OFF → ON with a draft. Do not reload an unsaved editor just to adopt a new setting. The current visit is pinned, including after a save.

## One coherent meeting scenario

Execute the main path on desktop with keyboard and on Android/browser Back. Record actual observations; all entries below start **Not executed**. Use a future meeting to begin in Plan, and separately spot-check today's Run and a past/closed meeting's Review defaults.

| Step | Action and expected result | Evidence to record |
| --- | --- | --- |
| 1. Create defaults | Open Create Meeting. Section/date lead the form; date defaults to the next section meeting day. Override section/date, enter a long theme/title, location and optional programme notes. Full numeric displayed dates use DD-MM-YYYY. | Default/overridden date, section, viewport |
| 2. Cancel and Clear | Clean Cancel creates nothing. With entered data, exercise Stay, Discard and Save where offered, plus browser/Android Back. Clear requires deliberate confirmation. Discard/Cancel must not silently create a record. | Each choice and meeting count/IDs |
| 3. Create & plan | Enter the synthetic details again. Activate Create & plan once, including a deliberate rapid double activation. Plan opens only after a successful save. Reload and confirm one canonical record with the entered details. | Record ID before/after reload; saved state |
| 4. Compact Plan | Expand existing activities and badgework; add a new row. Check all/selected/guest leaders, equipment text, duration and instructions. Collapse/reopen and change stages without losing values. Use long content. | Retained fields and stable record ID |
| 5. Programme library | Insert an activity and badgework from the library. They retain instructions/durations/equipment and remain independently editable with distinct rows. Remove a planned row and save/reload; it must remain removed. | Inserted/removed rows after reload |
| 6. Equipment and totals | Open equipment planning/reservations. Verify existing stock/loan constraints and section/date context. Save a permitted synthetic reservation. Totals include activities plus badgework; exceeding the standard duration shows the existing warning. | Totals/warning, reservation outcome |
| 7. Save and Share programme | Edit programme and leader attendance, then use the visible Plan Share programme action. It must complete saving before showing a share link. Inspect the existing WhatsApp programme payload: correct theme/items/durations/equipment/badges; no member names, attendance, incident details, private notes or leader instructions. No automatic popup or message send occurs. Run/Review retain sharing under More actions. | Saved fields, prepared payload with sensitive content redacted |
| 8. Failed share | With the synthetic editor offline, try Share programme. No stale link or WhatsApp action appears; the draft remains. Reconnect and retry successfully. If a recoverable backend failure is safely available for the test account, verify the same blocked-share behaviour. | Failure/error state, retained text, successful retry |
| 9. Run attendance | Mark one member in uniform: attendance becomes present. Clear attendance: uniform clears. Mark all present; correct one member to absent. Verify the dual-section member appears exactly once in each eligible section, with no out-of-scope member disclosure. | Member scope, count and checkbox outcomes |
| 10. Leader attendance/reference | Mark appointed leader attendance and add a permitted helping leader. Open View programme and inspect instructions/equipment. Dismiss with its button and Android Back; attendance edits and position remain. | Leader save/reload, reference/Back outcome |
| 11. Incident form | Select a member, concern, severity, action taken and parent-informed. Switch Plan/Review/Run: entered fields remain. Attempt an incomplete save; it stays on the meeting with useful feedback. Add a valid incident to the draft: draft feedback is distinct from saved confirmation. Save and reload; fields and recorded time are retained once. | Synthetic incident, draft versus saved state, recorded date/time |
| 12. Incident abandonment | With an unfinished incident, use an internal link, browser/Android Back and sign-out as applicable. Exercise Stay, failed/valid Save and deliberate Discard. Check Save/share/close/copy/create-another do not silently omit pending form fields. After an in-place save, Back must not get trapped on a duplicate editor entry. | Each navigation choice; retained/saved/discarded outcome |
| 13. Review badgework | Mark only the intended children present. Use canonical Adventure Skills: the meeting saves first, the tracker receives only eligible present members and meeting source context, and its return link restores the same meeting in Review. Only make synthetic competency changes if separately approved for these test identities. | Source ID, present scope, same meeting/Review return |
| 14. Meeting-only badges/notes | Under exactly “Other badges completed — meeting notes only”, enter comma-separated badge names for a present member. Confirm the explanation that these do not update the canonical tracker. Enter additional notes; change stages, save and reload. Verify these meeting notes survive and canonical competency progress is unchanged by badge-name notes. | Meeting notes and unchanged tracker evidence |
| 15. Save & close | Plan/Run's Review & close leads to Review without discarding edits. In Review, open Save & close. Keep open and Android Back both retain the open meeting and edits. Deliberately confirm Save & close: all meeting/leader writes acknowledge before it returns to the weekly list/history. No duplicate closure from rapid activation. | Confirmation choices, closed status, history entry |
| 16. Close failure | If a controlled failure is separately available for the synthetic test account, confirm Save & close fails visibly, stays on the meeting, retains edits and retries successfully. Never manufacture a failure by deleting/changing real Production data. If not safely exercisable, mark this case Not executed and reference TEST failure evidence without treating it as a Production pass. | Actual failure/recovery, or explicit Not executed |
| 17. Closed corrections | As Section Leader/Group leadership, correct permitted attendance, medical details and additional notes without reopening. Programme and completed badgework remain locked. As Programme Scouter/read-only Group Secretary, verify closed operational restrictions remain as before. Direct links must not bypass permissions. | Role-by-role permitted/denied fields and reload |
| 18. Copy | From More actions or history, copy to another authorised section/date. Check roster preview including the dual-section member. Cancel/back preserves the source. Deliberately create the copy: new distinct ID, preserved programme/planned equipment, reset attendance/completed badges/incidents/post-meeting notes. Source record remains unchanged. | Source/copy IDs, destination date/section and reset fields |
| 19. Reopen/history | History remains searchable/filterable with correct dates. Reopen is deliberate: Cancel retains closed status; confirming reopens that exact ID with saved programme, attendance, badgework, incidents and notes retained. Back returns meaningfully to the weekly list. Exercise with both schedule settings. | Same reopened ID, retained data, Back outcome |
| 20. Existing data/OFF | Open an older existing meeting and a mixed historical record if approved for read-only inspection. Verify programme content, totals and history remain intelligible. With meeting redesign OFF, existing Create, attendance/editor, share, close, copy/reopen and permissions remain available. Both experiences read the same saved synthetic record. | OFF parity and historical compatibility observations |

## Theme, mobile and accessibility pass

Repeat visual and navigation checks across all five supported themes. Do not change a shared theme preference without recording/restoring its prior value.

| Theme | Create/Plan/Run/Review and menu/header consistency | Focus, contrast, 320px/Android and desktop | Owner result |
| --- | --- | --- | --- |
| Current | Not executed | Not executed | Pending |
| Modern Scout | Not executed | Not executed | Pending |
| Irish Adventure | Not executed | Not executed | Pending |
| Bold Campaign | Not executed | Not executed | Pending |
| Programme Explorer | Not executed | Not executed | Pending |

Check Group header, emblem and Leader Menu remain; semantic theme colours/spacing match menu and schedule. Verify compact cards, long names/programme text and headings wrap without horizontal clipping at 320px. All actionable targets are at least 44px; keyboard focus is visible, logical and restored after overlays. Tab/Shift+Tab and Enter/Space operate stages, disclosures, fields, menus and dialogs. Escape/Back dismisses the top surface without losing the editor. Screen-reader labels distinguish attendance from uniform, required incident fields and badge-note members; saved/saving/error feedback is understandable. Explicitly observe loading, empty roster/programme/present states, denied access and recoverable errors. Link the automated contrast/accessibility report for the exact release separately; do not substitute it for unexecuted manual observations.

## Immediate rollback and completion

For an owner-authorised immediate UI rollback, the Superuser turns **Plan, Run and Review meeting workflow OFF**. No deployment, migration, record copy or data deletion is needed. New visits use the existing experience. Active editors stay pinned and show the change notice; save before leaving/reloading. Revisit the same synthetic IDs and verify saved programme, attendance, incidents, badge notes and equipment still exist. The schedule setting is independent and retains its chosen state. Restore any other test preferences to the recorded baseline. The assistant has performed none of these Production changes.

For each failure, record exact release/environment, role, device/theme/settings, synthetic record ID, reproducible steps, expected versus actual result and redacted evidence in a linked defect. Retest the fixed release and retain the original failure. Mark individual rows Pass/Fail/Not executed only from owner-observed execution. Missing evidence remains pending. The owner reports PMT results in SW-427; no automatic Done transition for this issue, the implementation children or the epic.

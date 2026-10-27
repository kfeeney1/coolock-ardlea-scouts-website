# SW-422 — Run attendance and incidents

With Plan, Run and Review enabled, Run keeps the canonical member attendance checklist, mark-all and leader attendance. Uniform still implies present; clearing attendance clears uniform. Roster reconciliation, including dual-section membership, and backend permissions are unchanged. An empty permitted roster has an explicit message.

View programme opens a read-only reference to the current meeting draft. It includes activity and badgework durations, leaders/guests, instructions, equipment and programme notes. Closing the modal returns to the mounted attendance checklist and its scroll position; switching stages retains incident input.

Incidents use the existing meeting injuries array and server-authorised meeting write services. Only members in the current meeting can be selected. A member and nonblank concern are required. Severity, action taken, parent-informed and ISO recorded time are retained; full numeric display dates use DD-MM-YYYY. Add incident to draft clears the form after validation and explicitly reports a draft addition. The meeting's save state remains the authority for persistence.

Save, save-before-share, close, copy, create-another and the explicit meeting-list action include a valid pending incident in the saved canonical snapshot. Incomplete incident input blocks the operation, identifies the required fields and returns to Run. Failed writes retain input for retry. Sharing still excludes incident data. Controls are disabled during the save so the acknowledged incident snapshot cannot clear newly typed input.

Internal links, sign-out and browser/system Back with an unfinished incident use the existing Save / Discard / Stay guard. Save includes the incident and waits for all meeting/leader writes. An invalid or failed save stays in the editor. Discard deliberately abandons unsaved changes. The guard is keyed to the meeting visit, and reserves its history entry only after the first dropdown's history has been consumed. Browser reload uses the existing native unsaved warning. Background saving is suspended while an incident form is pending, preventing a partial save from suggesting that its omitted fields are saved.

The OFF experience retains its original incident form and save behaviour. Operational read-only roles cannot enter incidents or change attendance. Authorised closed-meeting operational corrections retain the existing policy; planning and completed badgework locks are unchanged. No Firestore Rules, record formats, role scopes or feature settings change.

## Assurance gates

Full local quality:checks passed with 920 unit tests, backend/worker tests, contracts and build. A real demo-emulator run passed 50 desktop/mobile journeys with zero retries: 14 new Run cases, 14 shell/setting-matrix cases, 12 Create, eight share and two legacy attendance regressions. After the 320px table adjustment, six focused Run/attendance cases passed again. Screenshots were inspected. Local diagnostic used Chromium 153; pinned PR CI remains required. Emulator and CI evidence do not constitute deployed Firebase TEST acceptance. SW-426 requires an identified deployed TEST SHA and permitted access; SW-427 is an owner-executed Production Manual Testing plan. No Production deployment, enablement, acceptance or Done transition follows from this implementation.

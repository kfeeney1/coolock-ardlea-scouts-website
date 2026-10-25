# SW-343 — Training renewal calendar

Reminders are derived from `adminUsers/{leaderUid}/training/{category}`. The optional
`showOnCalendar` boolean defaults false for older records. Saving dates and opt-in
is one revision-protected transaction. There is no second reminder collection,
background job, paid API, date arithmetic or inferred renewal period. Month-bounded
queries use the existing single-field expiry-date index, one channel per permitted
leader. Canonical category identity prevents stale or duplicate reminders.

Training's independent Superuser switch remains off by default. While disabled,
training controls, entries and type filter disappear, records and opt-in are retained,
and Rules deny direct training reads/writes. Calendar's separate switch still applies.

Only active existing training readers receive data: administrators and canonical
Group/Deputy Group Leaders can query permitted leader records; ordinary leaders
query their own categories only. Parents/public/inactive/other identities get no
training source. Firestore Rules enforce these boundaries on every query. Entries
contain category, leader name and lapse date only; no completion date or evidence.
No generic labels are exposed to identities without a training read grant. Errors
clear training entries and offer Retry, preserving other calendar sources.

The matching category receives keyboard focus on entry. Managers open existing
Leader Access; ordinary leaders open their read-only Profile. The validated calendar
return context preserves month, type and section. The shared editor provides Save,
Cancel, validation, failed-save recovery and unsaved-change protection for the switch.

## Development assurance

Unit coverage checks all category identities, dates, opt-in, renewal identity and
permitted destinations. Real Rules tests cover reader/writer roles, direct queries,
invalid switches, missing lapse dates, date changes and feature retention. Browser
coverage uses real controls and Firebase emulators on desktop/mobile: opt-in all
categories, partial-date validation, meetings alongside reminders, renewal movement,
reload/uniqueness, removal retaining dates, own read-only navigation, return context,
feature off/on retention and parent omission. Existing training editor failure/leave
journeys and calendar date-action workflows are regression coverage. CI remains
required at the exact pushed head; green implementation checks are not TEST or PMT
acceptance.

## Firebase TEST manual plan by Jira

- SW-341: Enable Training & vetting in Superuser Settings. Save all three categories
  with completion/issue and explicit lapse dates. Check DD-MM-YYYY and partial-date
  status. Reject reversed dates. Renew and reload; one category record persists.
  Ordinary leaders cannot edit or directly read another leader's training.
- SW-342: On desktop and mobile, check three compact cards, visible keyboard focus,
  shared date controls and 44px actions. Exercise Add/Edit/Renew, Save/Cancel and
  Save/Discard/Stay. Disconnect before Save, confirm the draft survives, reconnect
  and save. Own Profile stays read-only. Confirm leader-list return filters.
- SW-343: For each category, enable Show renewal on group calendar and Save. Confirm
  one reminder on the explicit lapse day alongside existing meetings/events and
  maintenance. Open it, verify the correct leader/category focus, return with the
  same calendar filters. Renew to another date/month: old entry disappears and only
  one new entry exists after reload. Disable the category reminder: dates remain.
  Disable the feature: entries/type filter vanish; re-enable: records/reminders
  return. Ordinary leaders see only own reminders; parents see no training names or
  categories. Verify role revocation clears entries and direct reads are denied.

## Production Manual Testing

Run the same Jira-grouped scenarios after an explicitly authorised Production
release, with appropriate test records. Record PMT outcomes separately from local
checks, GitHub CI and Firebase TEST. Do not mark the epic/children Done from CI.

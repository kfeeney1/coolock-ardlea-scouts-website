# SW-342 — Leader record interface

Training & vetting is added to existing Leader Access records and as a read-only
section in My Profile. The existing Group header and emblem are retained.
The independent SW-341 switch gates mounting and loading the section, so off
preserves the old interface and stored records. No new backend or paid service.

Three compact cards stack on mobile and sit side by side at medium widths.
Dates use the shared picker and DD-MM-YYYY formatter. Text statuses use the
Group's Europe/Dublin date, including the SW-341 inclusive expiry boundary.
Missing expiry is Incomplete, both dates missing is Not recorded; no policy
interval is inferred. Authorised editors can Add dates, Edit record or Record
renewal with explicit Save and Cancel. Renewal edits the existing category.

The interface uses the SW-341 Firestore access boundaries without widening
permissions. Own-profile viewers receive no edit controls. Group maintenance
uses existing delegation checks and server rules remain authoritative.

Entered values survive failed saves; errors support retry. Shared
Save/Discard/Stay protection covers route links and browser Back, with a
separate discard confirmation for explicit Cancel. Existing leader-list filter
query parameters and return links remain unchanged.

## Verification and manual TEST/PMT plan

- SW-341: create all categories on two leaders, reload, edit/renew and verify
  category uniqueness, leader association and revision conflict rejection.
  Try missing, partial, reversed, invalid/leap dates and expiry day boundaries.
  Exercise direct access with ordinary leader, parent, inactive, Group Leader,
  Administrator and Superuser accounts. Toggle off/on and verify retention.
- SW-342: verify three textual statuses plus Incomplete; compare mobile stacking
  and desktop layout. Use keyboard through inputs and Save/Cancel, open the
  standard date picker, test visible focus and 44px actions. Verify own-profile
  read-only view, dirty navigation Stay/Discard/Save, unchanged leader return
  filters, failed-save retention and retry. No editing while loading or saving.
- SW-343: pending this interface merge; reminders, calendar permissions and
  calendar return context are not implemented by this PR.

Automated coverage is in leader-training-records.spec.ts (desktop and mobile),
the SW-341 status unit tests and real Firestore Rules tests. Live Firebase TEST
and owner PMT remain separate, outstanding acceptance steps.

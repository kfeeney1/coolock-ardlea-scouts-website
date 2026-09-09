# SW-49 — Deputy Group Leader parity

Deputy Group Leader is a canonical Scouting appointment, not a system access role. The account remains an active `adminUsers` profile with `role: "leader"` and Group section scope.

The application uses one shared Group Leadership permission bundle for Group Leader and Deputy Group Leader. Compatibility normalization accepts guarded historical DGL spellings, while new application data must use `Deputy Group Leader`.

Parity covers the Group Leader operational domains already enforced in the application: group-wide member reads, weekly programme operations, programme-library management, badgework, finance/subs, equipment, event-gallery Storage, audit/activity-log access, role-appropriate Settings access, meeting-history reads, and urgent equipment-notification recipients.

Non-delegable security boundaries are unchanged. Deputy Group Leader does not gain Admin/Super Admin, account approval, Admin promotion/demotion, protected Super Admin mutation, Group Council/Group Leaders meeting creation, or automatic group-wide access to consent/medical or event records that remain section/workflow scoped.

The slice is protected by unit tests, Firestore direct allow/deny tests, Storage direct allow/deny tests, deterministic emulator fixtures, and desktop/mobile Playwright coverage. No production data migration is performed by SW-49.

# Scout subs ledger

SW-47 uses three private Firestore collections: immutable `subsRatePolicies`, immutable member/period `subsAssignments`, and append-only `subsPayments`.

Amounts are integer euro cents. A policy is explicitly effective from a date and versioned. An assignment snapshots the amount due, category, policy ID/version, member name and section so later policy changes or membership transfers cannot rewrite history. Payments retain their member/section/period context and server timestamp. Corrections are exact, deterministic negative reversals linked to the original payment; originals are never edited or deleted.

## Policy boundary

The current repository and SW-47 do not define the real subs period, rates, discount stacking/precedence, proration, or refund policy. The implementation therefore does not infer them. A Group Treasurer or Group Leader enters an approved period and three rates, then explicitly assigns one rate category per member and period. Sibling and leader-child evidence is confirmed by an authorized officer because current member records have no authoritative household or leader-to-child relation. Surnames are never used.

Overpayment is displayed as credit; it is not automatically applied to another period or refunded. Inactive, departed and transferred members keep assignments and payments because the financial collections are independent of mutable member status/section.

## Access matrix

- Section leader: view assignments/payments and record/correct payments only for assigned sections.
- Group Treasurer and Group Leader: group-wide access, immutable policy creation, member classification and reports.
- Parent/member/public: no subs access.
- Platform admin/super-admin: no implicit policy authority; existing administrative read behaviour is retained only where the finance Rules already establish it.

All access is enforced by Firestore Rules. The UI is not the security boundary. Group and individual CSV exports are produced from currently authorized ledger queries and use deterministic member ordering.

The historical `weeklyMeetings.entries[].subsPaid/subsAmount` fields remain a meeting snapshot and are not included in authoritative balances.

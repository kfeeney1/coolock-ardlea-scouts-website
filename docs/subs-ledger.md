# Scout subs ledger

SW-47 uses three private Firestore collections: immutable `subsRatePolicies`, immutable member/Scout-year `subsAssignments`, and append-only `subsPayments`.

Amounts are integer euro cents. A policy is explicitly effective from a date and versioned. An assignment snapshots the amount due, family classification, family position, policy ID/version, member name and section so later policy changes or membership transfers cannot rewrite history. Payments retain their member/section/Scout-year context and server timestamp. Corrections are exact, deterministic negative reversals linked to the original payment; originals are never edited or deleted.

## 2026/27 policy

The approved Scout subs year is September through June. For 2026/27 the period is 1 September 2026 to 30 June 2027.

Standard-family totals are:

- 1 child: €264
- 2 children: €419
- 3 children: €524
- 4 children: €629

Leader-family totals are:

- 1 child: €205
- 2 children: €343
- 3 children: €465

Because the ledger remains member-based while the approved rates are family totals, each family total is allocated deterministically across the children in that family. Child 1 receives the one-child amount; each later child receives only the increase from the previous family-size total. This produces standard allocations of €264, €155, €105 and €105 and leader-family allocations of €205, €138 and €122. The sum of the individual assignments therefore always equals the approved family total.

The rates and family classifications are managed under **Settings**, not on the payment-recording page. The 2026/27 values are prefilled there, while later Scout years remain explicitly versioned rather than silently changing historical assignments.

Classification is explicit because current member records do not provide a sufficiently reliable household/leader-child relationship to infer the correct family position. Surnames are never used as evidence. Once a member has a Scout-year classification it is not silently overwritten; a future correction workflow must preserve the original classification in the audit trail.

Overpayment is displayed as credit; it is not automatically applied to another Scout year or refunded. Inactive, departed and transferred members keep assignments and payments because the financial collections are independent of mutable member status/section.

## Access matrix

- Section leader: view assignments/payments and record/correct payments only for assigned sections.
- Group Treasurer and Group Leader: group-wide subs access, immutable policy creation, member classification and reports.
- Admin and super-admin: the same subs policy/classification authority as the Treasurer and Group Leader, in addition to their existing administration responsibilities.
- Parent/member/public: no subs access.

The Settings route is shared: Treasurer and Group Leader can access the subs settings panel, but unrelated platform/session settings remain admin-only.

All access must be enforced by Firestore Rules. The UI is not the security boundary. Group and individual CSV exports are produced from currently authorized ledger queries and use deterministic member ordering.

The historical `weeklyMeetings.entries[].subsPaid/subsAmount` fields remain a meeting snapshot and are not included in authoritative balances.

# SW-181 — Effective navigation permissions

Baseline: main `8aff4a90` (SW-179 / PR #854). The SW-179 Firebase TEST
deployment passed; manual TEST acceptance and PMT remain separate. The epic's
reconciliation comment requires gap-closing work against the existing navigation.
No overlapping open PR or applicable AGENTS.md was found.

Both navigation presentations already share one filter and remove empty
categories. This change adds an explicit ANY-of requirement for every existing
destination using canonical permission-registry IDs. Unknown destinations fail
closed, including inherited object keys. A Leader portal capability describes
the existing active-profile route boundary; an administrator capability describes
the existing override for contextual appointment shortcuts. Neither grants route
or data access. Contextual Secretary, Treasurer and Quartermaster shortcuts
still require the canonical active appointment or the existing admin override.

The permission resolver previously used the legacy scouting-role label when
no current appointment was active, even when an explicit inactive, future or
expired assignment existed. Normalization already handles genuinely legacy
profiles. The resolver now uses the normalized active appointments and evaluates
system-role grants with an empty appointment when none is active. It cannot
resurrect stale appointment grants. Ordinary Leader capabilities are preserved.

The present registry grants shared operational capabilities to all ordinary
Leader profiles. Consequently a Bo’sun or Secretary account can legitimately
see Programme, People & Parents and other shared destinations as well as its
appointment shortcuts. Restricting those accounts to only two categories would
change the authorization policy; this navigation change preserves those grants.
Route guards, Firestore rules, persistence and the SW-179 mode switch are unchanged.

Verification:

- Full Quality gate: 828 unit tests, 51 worker tests, 8 backend tests, lint,
  static contracts, source-complexity guard and build passed.
- All 15 focused navigation/permission unit tests passed, including invalid
  identities, unmapped destinations, expired/inactive/future appointments,
  legacy compatibility and active multi-appointment unions.
- The expiry regression fails against unmodified main on the stale audit grant.
- A comparison against main retained identical menu destinations across 39
  active/legacy Leader, Admin and Superuser profiles.
- All six browser cases passed on desktop and Android-sized Chromium with
  zero retries and the existing case budgets (1.5 minutes total). Runs used
  real UI and canonical Firebase emulator data, with Chromium headless-shell
  because standard Chromium cannot start Unix sockets in this sandbox.
- Browser assertions inspect all rendered categories before checking explicit
  visible/hidden destination expectations for Bo’sun, Secretary, Programme,
  multi-appointment Group Leader and Chairperson accounts in both modes. The
  existing URL, page identity, refresh, Back and direct-route checks are retained.

Live Firebase TEST acceptance and PMT have not been performed for this change.
Neither SW-181 nor the SW-179 epic is declared Done from development checks.

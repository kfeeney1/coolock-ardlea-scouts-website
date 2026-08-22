# Organisation chart recovery

The organisational chart depends on two production conditions:

1. Firestore rules must allow active leaders to list `organisationLeadership` while keeping the collection private from non-leaders.
2. Every active `adminUsers` record must have a corresponding `organisationLeadership` projection.

The Firestore rules workflow tests collection-list access before deploying rules to production. The organisation backfill workflow is idempotent and verifies that all active leader accounts have an internal organisation record before it succeeds.

Real leaders are not opted into the public Who's Who by this recovery. Public publication remains explicit and opt-in.

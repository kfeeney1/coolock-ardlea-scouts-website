# Test data public leader opt-in

The current system data is test data. The organisation backfill workflow sets `OPT_IN_ALL_ACTIVE_LEADERS=true` so every active leader is explicitly opted into the public Who's Who during this migration. The migration updates `organisationLeadership`, reconciles `publicLeadership`, and verifies that every active leader was published.

Normal application behavior remains opt-in after the migration: administrators can still change the `Show on public Who's Who` switch in Leader Access & Organisation.

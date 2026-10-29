# SW-557 Hall Hire rollout

The independently controlled **Hall Hire** switch lives in existing Site Settings and is shown only to Superusers. It has no explanatory blurb. It defaults off. The canonical `siteSettings/hallHire` setting is readable/writable only by authoritative Superuser permission; rules verify boolean shape, actor and server timestamp. A transaction changes its safe public projection (`siteSettings/hallHirePublic`, enabled only) at the same time. Neither leaders/Council nor ordinary system Admins can change the setting.

Activation also requires server-owned `hall/group.ready` and its non-sensitive `siteSettings/hallHireReadiness` projection to be true. Clients cannot mark readiness. The UI disables activation until readiness is available, but always allows an already-enabled setting to be switched off after readiness is revoked. Readiness must remain false until SW-558/SW-559 workflows, SW-560 canonical source conflicts and SW-561 integrated verification are complete; this PR does not set it true outside isolated local test fixtures.

Public consumers use `watchHallHire`, which reads only safe boolean projections. Missing, malformed, cached-only or failed settings cannot enable it. A failed subscription stays closed until resubscription. Read-only settings do not expose private bookings or protected member/programme data. Authoritative Worker and availability rules independently check canonical setting and server readiness.

## Rollback

Switch Hall Hire off in Superuser Settings. No hall records, private indexes, audit/history or calendar/other rollout settings are modified. Do not delete booking/index documents or remove conflict controls from canonical source writers. If readiness is revoked, disabling remains allowed. Re-enable only after readiness/integrated acceptance is established again.

## Verification

Unit policy coverage: only explicit enabled=true plus ready=true activates the feature; unrelated redesign flags do not. Rules coverage: Superuser-only configuration, canonical/public consistency, no extra/private public fields, protected readiness, direct access denial, rollback after readiness revocation and preserved bookings/other settings. Browser regression adds desktop and 320px Android Chromium keyboard toggling, reload persistence, status messages and rollback; the ordinary Admin settings check asserts the Hall Hire switch is absent.

Development/CI, deployed Firebase TEST and Production PMT remain separate. This change does not enable Hall Hire on any deployed environment or deploy the Worker. Android PMT after integration: verify 320px focus/toggle/reload; Council users cannot see configuration; disable/re-enable preserves reservations, availability privacy and conflict protection. See SW-164 delivery contract for the full booking PMT plan.

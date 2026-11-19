# SW-595 event visibility release

The canonical event's strict boolean hidden flag controls access. Records without that field stay visible. Hide and restore use a Firestore transaction with a new immutable visibilityHistory record under the event. Existing audiences, consent, attendance, photos, projections and financial references remain stored.

Event discovery uses operation read on the existing event-audience-save endpoint. The backend scans only the allowed event collections with validated filters, checks canonical source visibility and checks each returned path with the caller's Firebase token against Firestore document Rules. Parent consent discovery also checks approved parent status, current active children and selected-member membership. The response contains authorized paths only. The client fetches the paths through the Firebase SDK, rechecking permission after a concurrent hide. Broad client queries are denied where they cannot safely include hidden and legacy records together.

Calendar discovery keeps direct document listeners and refreshes discovery every 30 seconds and on focus for newly created/restored records. A permission denial clears the displayed item. The event record page clears when its source listener loses permission.

## Deployment

The owner handles merging and production deployment.

1. Deploy the updated existing Cloudflare Worker before releasing Hosting or Rules. The Worker needs its existing Firebase service credentials and current configuration. There are no new secrets or services.
2. Deploy the updated existing TEST eventAudienceSave function before TEST Hosting. PR previews use this function. Its build includes eventDiscovery.js.
3. Deploy the corresponding Firestore and Storage rules and Hosting from the same reviewed commit.
4. Run acceptance in TEST before production release. The existing production Worker is the production backend. The Firebase function remains TEST-only.

No migration or backfill is required. Legacy consent discovery reads the consent records directly through authorized backend discovery, including records without a public schedule projection.

Discovery performs additional Firestore reads to authorize candidates and SDK reads. Requests use section/member/date filters where the calling view has them. Source authorization results are reused within a request. Calendar discovery refreshes only while the view is mounted. No subscription or plan change is introduced.

## TEST acceptance

On Android and desktop, create a synthetic event with audience, consent and a gallery. Record its ID and existing responses. As canonical Super Admin, hide it and reload. Confirm the hidden indicator, confirmation action and retained Super Admin access. In separate ordinary leader and parent sessions, check event lists, calendar, upcoming events, consent and direct record/photo links. Keep one ordinary event record open while hiding and confirm the page clears. Check reports/exports through the ordinary event list. Restore as Super Admin, reload the other sessions and verify the same roster, responses and photos return. Verify two immutable visibilityHistory entries, each with the correct actor, time and before/after state.

Keep SW-595 open pending owner acceptance. CI results must correspond to the PR head.

## Rollback

Restore hidden events through the Super Admin action before rolling application and Rules back to a version without visibility enforcement. Reverting only the UI or Rules can expose retained hidden projections. The visibilityHistory records and event evidence remain stored during rollback. No destructive data rollback is required.

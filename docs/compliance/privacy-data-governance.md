# Privacy and data governance

This is a technical and organisational review baseline, not legal advice or legal certification. Where Group policy has not been approved, the document says **Decision required** rather than inventing a rule.

## Lifecycle model

Keep these concepts separate:

- Operational lifecycle: active, inactive, left.
- Data lifecycle: retain, restrict, anonymise, delete.
- Authentication/access: enabled/approved, disabled/revoked.

Member inactivation does not automatically delete history. Parent Portal revocation does not automatically delete a shared authentication identity. Historical finance and audit records are not automatically destroyed when a member leaves.

## Data inventory and retention decisions

| Category | Confirmed application location/use | Retention decision |
| --- | --- | --- |
| Members/children | Firestore member records: identity, DOB, section, contact/emergency and lifecycle data | Decision required: retain/restrict/anonymise/delete after departure |
| Join applications | Firestore prospective child and parent/contact/emergency information | Decision required for closed and never-joined applications |
| Parents/guardians | Firebase Authentication plus Firestore Parent accounts and explicit child links | Decision required after last active child; revocation remains separate from Auth deletion |
| Leaders/Scouters | Firebase Authentication plus Firestore access/registration/leadership records | Decision required after departure; preserve dual-role accounts |
| Families | Canonical member family-group metadata | Any deletion/anonymisation must preserve relationship integrity |
| Consent/medical | Firestore consent/medical records protected by existing RBAC | Decision required after renewal/departure; never copy sensitive payloads into audit records |
| Attendance | Firestore programme/meeting records | Decision required for historical retention/anonymisation |
| Badgework | Firestore progress/award records | Decision required for historical retention/anonymisation |
| Events/activity consent | Firestore event/activity/consent records | Decision required for historical identity retention |
| Subs/payments | Firestore finance records | Decision required for financial retention and identity minimisation |
| Receipts/uploads | Firebase Storage plus Firestore references | Decision required; SW-78 owns attachment lifecycle hardening |
| Images/galleries | Firebase Storage plus metadata | Decision required when consent changes or a member leaves; remain compatible with SW-78 |
| Audit/member history | Firestore audit/history | Decision required for duration and post-anonymisation identifiers |
| Email/notifications | Existing Cloudflare Worker and Resend delivery path, with operational records where present | Decision required for delivery/log metadata retention |
| Browser/client state | Firebase Authentication session/browser persistence and normal app state | Current review found no application-managed advertising/behavioural analytics storage |
| Backups | Existing production Firebase/Cloud Storage backup workflow | Decision required for how approved deletion interacts with backup retention/recovery |
| Firebase Authentication | Google/Firebase identity | Final Auth deletion requires an approved policy; do not infer it from child/member/role lifecycle |

## Inactive and left processing

Reuse authoritative lifecycle selectors/services. Inactive or left members should not be treated as active attendance participants, routine communication recipients or routine reminder candidates unless an approved workflow explicitly requires it. Revoked/disabled Parent accounts should not be normal recipients. Keep this compatible with SW-44, SW-45 and SW-91 instead of adding privacy-specific duplicate filtering.

## Controlled deletion/anonymisation architecture

Current Firestore rules generally keep broad client deletion closed. Preserve that boundary. A future approved destructive workflow should use authoritative server-side orchestration and must require appropriate administrative authority, enumerate related records before mutation, distinguish restrict/anonymise/permanently-delete actions, provide confirmation, preserve required finance/audit/history, handle Storage objects, preserve independent dual-role access, maintain canonical family relationships, treat Firebase Auth separately, and emit a privacy-significant audit event without copying deleted sensitive content.

**Decision required before production destructive actions are enabled:** Group approval of category-by-category outcomes and the roles permitted to request/approve them. Until then, do not relax global Firestore or Storage delete permissions.

## Block C reconciliation

Reviewed after PRs #497 and #498 merged. Production communications continue to use the existing Cloudflare Worker and Resend system. The new production paths resolve recipients from authoritative Parent/member relationships, exclude non-active members and revoked/disabled Parent accounts, and use the authenticated HTTPS member-lifecycle route rather than treating possession of a URL as authority. The lifecycle operation preserves independent Leader access for dual-role accounts. Email destinations remain responsive HTTPS web routes; this repository does not introduce a Scout Android native data flow. No second email, inactivation or privacy-specific delivery system is introduced.

## September 2026 implementation reconciliation

The approval baseline has been reconciled with the subsequently merged application work. This does **not** approve the policy choices below.

- Consent currency/reminders use the existing member/parent relationships and must not turn expired medical/consent details into email payloads or audit content.
- Secure communication links revalidate authenticated authority before lifecycle actions; possession of an email link is not sufficient authority.
- Controlled policy documents and attachment lifecycle work continue to use Firebase Storage plus Firestore metadata/RBAC rather than a second document store.
- Event audience management persists explicit audience/resolution data; retention of historical event participation remains a Group decision.
- Equipment incident and Section Float reporting add operational/audit records; finance retention and identity minimisation remain Group decisions.
- Operational monitoring now documents Firebase, Google Cloud backup/export, Resend, Cloudflare, GitHub Actions and Hosting Ireland/domain administration. Provider quota data is not treated as authoritative unless obtained from an approved source.
- Production backup freshness monitoring is pinned to the production Firebase project/bucket and requires protected Google Cloud credentials/IAM. Backup/deletion interaction remains a retention-policy decision.
- Android/web deep-link handling does not remove the requirement for normal authentication/authorisation and does not create a separate data store.

## Approval record

Complete this section only when the responsible Group body has actually reviewed the decisions.

| Decision | Required owner | Decision / evidence |
| --- | --- | --- |
| Public privacy wording (SW-79) | Group-designated data/privacy owner | Pending |
| Retention outcome and duration by data category (SW-80) | Group-designated data/privacy owner | Pending |
| Processor/DPA/transfer review (SW-86) | Group-designated data/privacy owner | Pending |
| Backup treatment after approved deletion | Same governance owner, with technical operator input | Pending |
| Review cadence and named owner | Group | Pending |

Approval date: **Pending**  
Approved by / meeting reference: **Pending**  
Next review date: **Pending**

## Processor inventory

| Service | Repository-evidenced purpose | Organisational review |
| --- | --- | --- |
| Google/Firebase | Authentication, Firestore application data, Firebase Storage, Hosting and production backup infrastructure | Group review required: processor/data-processing terms, account owner, location/transfer information, retention/backups, periodic review owner |
| Cloudflare Workers | Server-side production email API/orchestration and the data needed to authorise/deliver those requests | Group review required: processor terms, account owner, location/transfer information and log/retention settings |
| Resend | Outbound email delivery using recipient address and message content/metadata needed for delivery | Group review required: processor terms/DPA, account owner, location/transfer information and delivery/log retention |
| GitHub | Source code and CI/deployment automation | Do not use as a production Scout-record store. Continue to prevent production personal data appearing in fixtures, logs, screenshots, PRs or docs |
| Hosting Ireland / domain administration | Domain/DNS administration is used for the production domain. This fact alone does not prove Scout-record storage there. | Confirm account owner, renewal/DNS responsibilities and whether any personal-data processing beyond DNS/domain administration occurs |

### Group confirmation checklist

- [ ] Google/Firebase terms and transfer/location information reviewed
- [ ] Cloudflare terms and transfer/location information reviewed
- [ ] Resend terms and transfer/location information reviewed
- [ ] Relevant account, configuration and log-retention settings reviewed
- [ ] Group owner assigned for periodic processor review
- [ ] Retention decisions approved by data category
- [ ] Public Privacy Notice wording approved by the responsible Group owner

SW-86 must remain open/in review until these confirmations actually occur.

## Privacy Notice ownership and production rules

The public `/privacy` page is the operational transparency page and must be updated when material data categories, processors, browser-storage behaviour, communication infrastructure or approved retention policy changes. Do not present Group-dependent wording as approved before review.

Use synthetic emulator data only in automated tests. Do not copy production member, Parent, Leader, medical, consent or financial records into fixtures, screenshots, CI logs, PR descriptions or documentation. Keep destructive Firestore/Storage access fail-closed until an approved workflow exists. Production deployment remains manual and TEST/CI must not send real production email.
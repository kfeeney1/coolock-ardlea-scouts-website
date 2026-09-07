# Stage 23.5 operator data health

The existing super-admin Operational Health panel now separates deployment/capability health from operational data health.

The cross-feature relationship check is deliberately user-triggered. It reads the collections covered by the existing operational-integrity validator only when a super admin selects **Run data check**, avoiding a broad audit on every dashboard visit. Results contain a total and affected collection names, never record contents or identifiers. A healthy result confirms no findings; a warning links to the relevant member, parent, meeting, event, consent, equipment or finance screens.

This is a read-only diagnostic. It does not repair, delete, relabel or otherwise write production data. The downloadable scheduled Firestore audit remains the detailed operator evidence and the dedicated Adventure Skills catalogue audit remains authoritative for Badgework integrity.

The panel remains restricted to the existing `super-admin` dashboard boundary. Section leaders and ordinary administrators do not receive broad cross-group integrity reads.

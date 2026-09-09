# SW-49 enforcement map

- Permission catalogue: `src/security/permissionRegistry.ts`
- Canonical appointment normalization: `src/security/scoutingAppointments.ts`
- Firestore authorization: `firestore.rules`
- Storage authorization: `storage.rules`
- Navigation/direct-route UX: leader header and protected pages
- Finance/subs/equipment/weekly helper authorization: domain service helpers using Group Leadership normalization
- Urgent equipment notification recipients: email worker appointment filter
- Test identities: deterministic comprehensive population seed
- Security verification: unit, Firestore emulator, Storage emulator and Playwright suites

# SW-49 review checklist

- [x] Deputy Group Leader is an appointment, never a system role.
- [x] Group Leader and Deputy Group Leader share one operational grant bundle.
- [x] Admin/Super Admin and account-approval boundaries are unchanged.
- [x] Firestore and Storage direct authorization tests cover DGL allows and ordinary-Leader denies.
- [x] Deterministic seed uses canonical `Deputy Group Leader`.
- [x] Legacy DGL aliases are compatibility-only.
- [x] Client navigation, finance/subs, equipment, meetings and audit checks use shared Group Leadership logic.
- [x] Equipment incident recipient selection includes DGL.
- [x] Roles page remains read-only and describes effective backend-enforced permissions.
- [x] Desktop/mobile Playwright coverage is updated.
- [ ] Required PR checks green.
- [ ] Merge verified on main.

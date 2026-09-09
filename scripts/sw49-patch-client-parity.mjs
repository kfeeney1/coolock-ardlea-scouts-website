import { readFile, writeFile } from "node:fs/promises";

async function patch(path, replacements) {
  let text = await readFile(path, "utf8");
  for (const [before, after] of replacements) {
    if (text.includes(after)) continue;
    const count = text.split(before).length - 1;
    if (count !== 1) throw new Error(`${path}: expected one occurrence, found ${count}: ${before.slice(0, 90)}`);
    text = text.replace(before, after);
  }
  await writeFile(path, text);
}

await patch("firestore.rules", [[
`      allow read: if isAdmin()\n        || (isActiveLeader()\n          && exists(/databases/$(database)/documents/organisationLeadership/$(request.auth.uid))\n          && get(/databases/$(database)/documents/organisationLeadership/$(request.auth.uid)).data.active == true\n          && get(/databases/$(database)/documents/organisationLeadership/$(request.auth.uid)).data.scoutingRole in ["Group Leader", "Group Secretary"])`,
`      allow read: if isAdmin()\n        || isGroupLeader()\n        || isGroupSecretary()`
]]);

await patch("src/services/weeklyTracker.ts", [
  [`import { auth, db } from "../firebase";`, `import { auth, db } from "../firebase";\nimport { isGroupLeadershipAppointment } from "../security/scoutingAppointments";`],
  [`return { scoutingRole:role, canViewAll:["Group Leader","Group Secretary"].includes(role), canEditAll:role==="Group Leader", readOnly:role==="Group Secretary" };`, `return { scoutingRole:role, canViewAll:isGroupLeadershipAppointment(role)||role==="Group Secretary", canEditAll:isGroupLeadershipAppointment(role), readOnly:role==="Group Secretary" };`]
]);

await patch("src/services/weeklyMeetingPermissions.ts", [
  [`import type { WeeklyMeetingStatus } from "./weeklyTracker";`, `import { isGroupLeadershipAppointment } from "../security/scoutingAppointments";\nimport type { WeeklyMeetingStatus } from "./weeklyTracker";`],
  [`const PAST_MEETING_EDITOR_ROLES = new Set(["Section Leader", "Group Leader"]);`, `const PAST_MEETING_EDITOR_ROLES = new Set(["Section Leader"]);`],
  [`return isAdmin || PAST_MEETING_EDITOR_ROLES.has(scoutingRole);`, `return isAdmin || PAST_MEETING_EDITOR_ROLES.has(scoutingRole) || isGroupLeadershipAppointment(scoutingRole);`]
]);

await patch("src/services/equipmentLoanLogic.ts", [
  [`export const EQUIPMENT_SECTIONS`, `import { isGroupLeadershipAppointment } from "../security/scoutingAppointments";\n\nexport const EQUIPMENT_SECTIONS`],
  [`|| profile.scoutingRole === "Group Leader"\n    || isQuartermasterRole`, `|| isGroupLeadershipAppointment(profile.scoutingRole)\n    || isQuartermasterRole`]
]);

await patch("src/components/admin/ProtectedSiteSettingsRoute.tsx", [
  [`import { useAdminAuth } from "./AdminAuthProvider";`, `import { isGroupLeadershipAppointment } from "../../security/scoutingAppointments";\nimport { useAdminAuth } from "./AdminAuthProvider";`],
  [`|| adminProfile?.scoutingRole === "Group Leader";`, `|| isGroupLeadershipAppointment(adminProfile?.scoutingRole);`]
]);

await patch("src/pages/SectionCashbook.tsx", [
  [`import { useAdminAuth } from "../components/admin/AdminAuthProvider";`, `import { useAdminAuth } from "../components/admin/AdminAuthProvider";\nimport { isGroupLeadershipAppointment } from "../security/scoutingAppointments";`],
  [`adminProfile?.role === "super-admin" || adminProfile?.scoutingRole === "Group Leader" || adminProfile?.scoutingRole === "Group Treasurer"`, `adminProfile?.role === "super-admin" || isGroupLeadershipAppointment(adminProfile?.scoutingRole) || adminProfile?.scoutingRole === "Group Treasurer"`]
]);

await patch("src/components/admin/FinanceReportsPanel.tsx", [
  [`import { useAdminAuth } from "./AdminAuthProvider";`, `import { isGroupLeadershipAppointment } from "../../security/scoutingAppointments";\nimport { useAdminAuth } from "./AdminAuthProvider";`],
  [`adminProfile?.role === "super-admin" || adminProfile?.scoutingRole === "Group Leader" || adminProfile?.scoutingRole === "Group Treasurer"`, `adminProfile?.role === "super-admin" || isGroupLeadershipAppointment(adminProfile?.scoutingRole) || adminProfile?.scoutingRole === "Group Treasurer"`]
]);

await patch("src/pages/SubsManagement.tsx", [
  [`import { useAdminAuth } from "../components/admin/AdminAuthProvider";`, `import { useAdminAuth } from "../components/admin/AdminAuthProvider";\nimport { isGroupLeadershipAppointment } from "../security/scoutingAppointments";`],
  [`adminProfile?.scoutingRole==="Group Treasurer"||adminProfile?.scoutingRole==="Group Leader"`, `adminProfile?.scoutingRole==="Group Treasurer"||isGroupLeadershipAppointment(adminProfile?.scoutingRole)`],
  [`the Treasurer, Group Leader and admins.`, `the Treasurer, Group Leader, Deputy Group Leader and admins.`]
]);

await patch("src/services/memberAdmin.ts", [
  [`import { auth, db } from "../firebase";`, `import { auth, db } from "../firebase";\nimport { isGroupLeadershipAppointment } from "../security/scoutingAppointments";`],
  [`&& (organisation.scoutingRole === "Group Leader" || organisation.scoutingRole === "Group Treasurer");`, `&& (isGroupLeadershipAppointment(organisation.scoutingRole) || organisation.scoutingRole === "Group Treasurer");`]
]);

await patch("src/pages/MeetingRecords.tsx", [
  [`import { useAdminAuth } from "../components/admin/AdminAuthProvider";`, `import { useAdminAuth } from "../components/admin/AdminAuthProvider";\nimport { isGroupLeadershipAppointment } from "../security/scoutingAppointments";`],
  [`const FULL_MEETING_HISTORY_ROLES = new Set(["Group Leader", "Group Secretary"]);`, `const FULL_MEETING_HISTORY_ROLES = new Set(["Group Secretary"]);`],
  [`const isGroupOfficer = Boolean(adminProfile?.scoutingRole && FULL_MEETING_HISTORY_ROLES.has(adminProfile.scoutingRole));`, `const isGroupOfficer = Boolean(isGroupLeadershipAppointment(adminProfile?.scoutingRole) || (adminProfile?.scoutingRole && FULL_MEETING_HISTORY_ROLES.has(adminProfile.scoutingRole)));`]
]);

await patch("scripts/verify-test-population.mjs", [[
  `const GROUP_ROLES = new Set(["Group Leader", "Group Chairperson", "Group Secretary", "Group Treasurer", "Group Quartermaster / Bo'sun", "Group Youth Champion"]);`,
  `const GROUP_ROLES = new Set(["Group Leader", "Deputy Group Leader", "Group Chairperson", "Group Secretary", "Group Treasurer", "Group Quartermaster / Bo'sun", "Group Youth Champion"]);`
]]);

await patch("tests/unit/publicWhosWho.test.ts", [
  [`      "Group Leader",\n      "Group Chairperson",`, `      "Group Leader",\n      "Deputy Group Leader",\n      "Group Chairperson",`],
  [`["Group Council Administrator", "Elected Member", "Deputy Group Leader", "Admin", "Super Admin"]`, `["Group Council Administrator", "Elected Member", "Admin", "Super Admin"]`]
]);

console.log("Applied guarded SW-49 client and Rules parity replacements.");

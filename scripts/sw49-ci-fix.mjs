import { readFile, writeFile } from "node:fs/promises";

async function patch(path, replacements) {
  let text = await readFile(path, "utf8");
  for (const [before, after] of replacements) {
    const count = text.split(before).length - 1;
    if (count !== 1) throw new Error(`${path}: expected exactly one occurrence, found ${count}: ${before}`);
    text = text.replace(before, after);
  }
  await writeFile(path, text);
}

await patch("src/security/permissionRegistry.ts", [[
  `from "./scoutingAppointments"`,
  `from "./scoutingAppointments.ts"`
]]);

for (const path of [
  "src/services/equipmentLogic.ts",
  "src/services/equipmentLoanLogic.ts",
  "src/services/weeklyMeetingPermissions.ts"
]) {
  await patch(path, [[
    `from "../security/scoutingAppointments"`,
    `from "../security/scoutingAppointments.ts"`
  ]]);
}

await patch("scripts/verify-test-population.mjs", [
  [`const GROUP_ROLE_KEYS = ["group_leader", "group_chairperson", "group_secretary", "group_treasurer", "group_quartermaster", "group_youth_champion"];`, `const GROUP_ROLE_KEYS = ["group_leader", "deputy_group_leader", "group_chairperson", "group_secretary", "group_treasurer", "group_quartermaster", "group_youth_champion"];`],
  [`if (adminUsers.length !== 30) fail(\`expected 30 leader/admin profiles, found \${adminUsers.length}\`);`, `if (adminUsers.length !== 31) fail(\`expected 31 leader/admin profiles, found \${adminUsers.length}\`);`],
  [`if (organisation.length !== 30) fail(\`expected 30 organisation records, found \${organisation.length}\`);`, `if (organisation.length !== 31) fail(\`expected 31 organisation records, found \${organisation.length}\`);`],
  [`if (publicLeadership.length !== 26) fail(\`expected 26 public leadership records, found \${publicLeadership.length}\`);`, `if (publicLeadership.length !== 27) fail(\`expected 27 public leadership records, found \${publicLeadership.length}\`);`],
  [`if (publicGroup.length !== 6) fail(\`expected 6 public Group executive records, found \${publicGroup.length}\`);`, `if (publicGroup.length !== 7) fail(\`expected 7 public Group executive records, found \${publicGroup.length}\`);`],
  [`if (expectedAuthUids.size !== 40) fail(\`internal verifier expected UID set is \${expectedAuthUids.size}, not 40\`);`, `if (expectedAuthUids.size !== 41) fail(\`internal verifier expected UID set is \${expectedAuthUids.size}, not 41\`);`],
  [`console.log("- Who's Who: exactly six Group roles + four approved section roles per youth section");`, `console.log("- Who's Who: exactly seven Group roles + four approved section roles per youth section");`],
  [`console.log("- Leader/admin profiles: 26 public leaders + 1 private multi-section leader + 3 private website admins");`, `console.log("- Leader/admin profiles: 27 public leaders + 1 private multi-section leader + 3 private website admins");`],
  [`console.log("- Firebase Auth: all 40 canonical identities present");`, `console.log("- Firebase Auth: all 41 canonical identities present");`]
]);

console.log("Applied guarded SW-49 CI fixes.");

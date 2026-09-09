import { readFile, writeFile } from "node:fs/promises";

async function patch(path, replacements) {
  let text = await readFile(path, "utf8");
  for (const [before, after] of replacements) {
    if (text.includes(after)) continue;
    const count = text.split(before).length - 1;
    if (count !== 1) throw new Error(`${path}: expected exactly one occurrence, found ${count}: ${before.slice(0, 100)}`);
    text = text.replace(before, after);
  }
  await writeFile(path, text);
}

await patch("email-worker/src/index.js", [
  [`const EQUIPMENT_NOTIFICATION_ROLES = new Set(["Group Leader", "Group Quartermaster", "Group Quartermaster/Bo'sun", "Group Quartermaster / Bo'sun", "Group Bo'sun"]);`, `const EQUIPMENT_NOTIFICATION_ROLES = new Set(["Group Leader", "Deputy Group Leader", "Deputy-Group-Leader", "Deputy GroupLead", "DGL", "Group Quartermaster", "Group Quartermaster/Bo'sun", "Group Quartermaster / Bo'sun", "Group Bo'sun"]);`],
  [`No active Quartermaster or Group Leader email recipients were found.`, `No active Quartermaster or Group Leadership email recipients were found.`],
  [`needs review by the Quartermaster / Bo'sun and Group Leader.`, `needs review by the Quartermaster / Bo'sun and Group Leadership.`]
]);

await patch("src/services/leaderRegistrations.ts", [[
  `export type RequestedLeaderRole = "Scouter" | "Section Leader" | "Group Leader" | "Other";`,
  `export type RequestedLeaderRole = "Scouter" | "Section Leader" | "Group Leader" | "Deputy Group Leader" | "Other";`
]]);

await patch("src/pages/LeaderRegister.tsx", [[
  `<MenuItem value="Group Leader">Group Leader</MenuItem><MenuItem value="Other">Other</MenuItem>`,
  `<MenuItem value="Group Leader">Group Leader</MenuItem><MenuItem value="Deputy Group Leader">Deputy Group Leader</MenuItem><MenuItem value="Other">Other</MenuItem>`
]]);

await patch("src/pages/EquipmentManagement.tsx", [[
  `Quartermaster / Bo'sun, Group Leader and administrator roles.`,
  `Quartermaster / Bo'sun, Group Leader, Deputy Group Leader and administrator roles.`
]]);

await patch("src/pages/SiteSettings.tsx", [[
  `Treasurer, Group Leader and admins; platform settings remain admin-only.`,
  `Treasurer, Group Leader, Deputy Group Leader and admins; platform settings remain admin-only.`
]]);

await patch("src/pages/WeeklySectionTracker.tsx", [[
  `Section Leaders and the Group Leader can update attendance, medical issues and additional notes.`,
  `Section Leaders, the Group Leader and Deputy Group Leader can update attendance, medical issues and additional notes.`
]]);

await patch("src/components/admin/EquipmentIncidentsPanel.tsx", [[
  `notify the Quartermaster / Bo'sun and Group Leader on their dashboard and by email.`,
  `notify the Quartermaster / Bo'sun and Group Leadership on their dashboard and by email.`
]]);

console.log("Applied guarded SW-49 final parity patch.");

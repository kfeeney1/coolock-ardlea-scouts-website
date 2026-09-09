import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/seed-population-data.mjs";
const source = await readFile(path, "utf8");
const before = `const groupRoles = [\n  { key: "group_leader", displayName: "Declan O'Connor", scoutingRole: "Group Leader", order: 1 },\n  { key: "group_chairperson", displayName: "Sarah Byrne", scoutingRole: "Group Chairperson", order: 2 },`;
const after = `const groupRoles = [\n  { key: "group_leader", displayName: "Declan O'Connor", scoutingRole: "Group Leader", order: 1 },\n  { key: "deputy_group_leader", displayName: "Niamh Brennan", scoutingRole: "Deputy Group Leader", order: 2 },\n  { key: "group_chairperson", displayName: "Sarah Byrne", scoutingRole: "Group Chairperson", order: 3 },`;

if (source.includes('key: "deputy_group_leader"')) {
  console.log("Deputy Group Leader seed already present.");
  process.exit(0);
}
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`Expected one canonical groupRoles prefix, found ${count}.`);
let next = source.replace(before, after);
next = next
  .replace('scoutingRole: "Group Secretary", order: 3', 'scoutingRole: "Group Secretary", order: 4')
  .replace('scoutingRole: "Group Treasurer", order: 4', 'scoutingRole: "Group Treasurer", order: 5')
  .replace('scoutingRole: "Group Quartermaster / Bo\'sun", order: 5', 'scoutingRole: "Group Quartermaster / Bo\'sun", order: 6')
  .replace('scoutingRole: "Group Youth Champion", order: 6', 'scoutingRole: "Group Youth Champion", order: 7');
await writeFile(path, next);
console.log("Added deterministic Deputy Group Leader seed identity.");

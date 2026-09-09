import { readFile, writeFile } from "node:fs/promises";

const path = "firestore.rules";
const source = await readFile(path, "utf8");
const before = `    function isGroupLeader() {\n      return isActiveLeader()\n        && exists(/databases/$(database)/documents/organisationLeadership/$(request.auth.uid))\n        && get(/databases/$(database)/documents/organisationLeadership/$(request.auth.uid)).data.active == true\n        && get(/databases/$(database)/documents/organisationLeadership/$(request.auth.uid)).data.scoutingRole == "Group Leader";\n    }`;
const after = `    function isGroupLeader() {\n      return isActiveLeader()\n        && exists(/databases/$(database)/documents/organisationLeadership/$(request.auth.uid))\n        && get(/databases/$(database)/documents/organisationLeadership/$(request.auth.uid)).data.active == true\n        && get(/databases/$(database)/documents/organisationLeadership/$(request.auth.uid)).data.scoutingRole in ["Group Leader", "Deputy Group Leader", "Deputy-Group-Leader", "Deputy GroupLead", "DGL"];\n    }`;

if (source.includes(after)) {
  console.log("SW-49 Firestore Group Leadership predicate already patched.");
  process.exit(0);
}
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`Expected exactly one canonical isGroupLeader predicate, found ${count}.`);
await writeFile(path, source.replace(before, after));
console.log("Patched Firestore Group Leadership predicate with Deputy aliases.");

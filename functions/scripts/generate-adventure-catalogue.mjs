import { mkdir, writeFile } from "node:fs/promises";

const { adventureSkills } = await import("../../src/data/adventureSkills/index.ts");
const output = new URL("../generated/adventure-skills.json", import.meta.url);
await mkdir(new URL("../generated/", import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(adventureSkills)}\n`, "utf8");
console.log(`Generated authoritative Adventure Skills catalogue with ${adventureSkills.length} skills.`);

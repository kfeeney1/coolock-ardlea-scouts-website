import fs from "node:fs";

const path = "e2e/role-permissions.spec.ts";
const source = fs.readFileSync(path, "utf8");
const oldText = '    await expect(page.getByText(/Only a Super Admin can grant or remove Admin access/i)).toBeVisible();';
const newText = '    await expect(page.getByText(/System access roles remain Super Admin-only/i)).toBeVisible();\n    await expect(page.getByText(/Group Leadership can delegate ordinary operational appointments and section scope only/i)).toBeVisible();';

if (!source.includes(oldText)) {
  throw new Error("Expected obsolete Super Admin assertion was not found; refusing to patch.");
}
if ((source.match(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length !== 1) {
  throw new Error("Expected exactly one obsolete Super Admin assertion; refusing to patch.");
}

fs.writeFileSync(path, source.replace(oldText, newText));
console.log("Updated Super Admin E2E assertion to the current SW-50 delegation boundary copy.");

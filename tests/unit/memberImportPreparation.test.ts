import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("SW-218 production member manifest preparation accepts every supported youth section", async () => {
  const source = await readFile("scripts/prepare-member-import.py", "utf8");

  assert.match(source, /SUPPORTED_SECTIONS = \("Beavers", "Cubs", "Scouts", "Ventures", "Rovers"\)/);
  assert.match(source, /if section not in SUPPORTED_SECTIONS:/);
  assert.match(source, /for section in SUPPORTED_SECTIONS/);
  assert.doesNotMatch(source, /section not in \{"Beavers", "Cubs", "Scouts"\}/);
});

test("SW-218 manifest preparation and downstream import support the same section set", async () => {
  const [preparation, importer] = await Promise.all([
    readFile("scripts/prepare-member-import.py", "utf8"),
    readFile("scripts/member-import-core.mjs", "utf8")
  ]);

  for (const section of ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers"]) {
    assert.match(preparation, new RegExp(`SUPPORTED_SECTIONS = .*"${section}"`));
    assert.match(importer, new RegExp(`SECTION_NAMES = .*"${section}"`));
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { adventureSkills } from "../../src/data/adventureSkills/index.ts";
import { adventureSkillBadgeArtwork, badgeInteriorClip } from "../../src/services/adventureSkillBadgeArtwork.ts";

const root = new URL("../../public/badges/adventure-skills/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("catalogue.json", root), "utf8")) as {
  entries: { skillId: string; stage: number; width: number; height: number; sha256: string }[];
};
test("each verified skill/stage resolves to its unique original image, source dimensions and checksum", () => {
  assert.equal(manifest.entries.length, 81);
  const paths = new Set<string>();
  const hashes = new Set<string>();
  for (const skill of adventureSkills.filter(item => item.id !== "swimming")) {
    for (const stage of skill.stages) {
      const artwork = adventureSkillBadgeArtwork(skill.id, stage.stage)!;
      const entry = manifest.entries.find(item => item.skillId === skill.id && item.stage === stage.stage)!;
      assert.ok(entry);
      const bytes = readFileSync(new URL(`${skill.id}/stage-${stage.stage}.png`, root));
      assert.equal(bytes.readUInt32BE(16), artwork.width);
      assert.equal(bytes.readUInt32BE(20), artwork.height);
      assert.equal(artwork.width, entry.width); assert.equal(artwork.height, entry.height);
      const hash = createHash("sha256").update(bytes).digest("hex");
      assert.equal(hash, entry.sha256);
      paths.add(artwork.src); hashes.add(hash);
      const [left,top,right,bottom] = artwork.interior;
      assert.ok(left > 0 && top > 0 && right > left && bottom > top && right < artwork.width && bottom < artwork.height);
    }
  }
  assert.equal(paths.size, 81); assert.equal(hashes.size, 81);
});
test("missing Swimming originals remain explicitly unavailable without borrowing another skill or stage", () => {
  for (let stage=1; stage<=6; stage++) assert.equal(adventureSkillBadgeArtwork("swimming", stage), null);
  for (const [skill,stage] of [["swimming",7],["camping",0],["unknown",1]] as const) {
    assert.throws(() => adventureSkillBadgeArtwork(skill,stage));
  }
});
test("colour reveal is bounded within the source frame, not a replacement border", () => {
  const artwork = adventureSkillBadgeArtwork("camping",2)!;
  const empty = badgeInteriorClip(artwork,0);
  assert.equal(badgeInteriorClip(artwork,-1),empty);
  assert.equal(badgeInteriorClip(artwork,2),badgeInteriorClip(artwork,1));
  assert.notEqual(empty,badgeInteriorClip(artwork,.5));
  assert.notEqual(badgeInteriorClip(artwork,.5),badgeInteriorClip(artwork,1));
});

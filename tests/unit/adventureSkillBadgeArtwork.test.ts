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
test("all six Swimming stages use distinct original PDF images with verified dimensions and checksums", () => {
  const source = JSON.parse(readFileSync(new URL("swimming/source.json", root),"utf8"));
  assert.equal(source.entries.length,6);
  assert.equal(source.sourceUrl,"https://scouting360.ie/wp-content/uploads/2026/06/Swimming-Adventure-Skills-1-to-6-20mar2026.pdf");
  const hashes = new Set<string>();
  for (let stage=1;stage<=6;stage++) {
    const art=adventureSkillBadgeArtwork("swimming",stage)!;
    const entry=source.entries.find((item: {stage:number})=>item.stage===stage);
    const bytes=readFileSync(new URL(`swimming/stage-${stage}.png`,root));
    assert.equal(art.src,`/badges/adventure-skills/swimming/stage-${stage}.png`);
    assert.equal(bytes.length,entry.bytes);
    assert.equal(bytes.readUInt32BE(16),art.width);assert.equal(bytes.readUInt32BE(20),art.height);
    assert.equal(art.width,entry.width);assert.equal(art.height,entry.height);assert.equal(entry.page,2);
    const hash=createHash("sha256").update(bytes).digest("hex");assert.equal(hash,entry.sha256);hashes.add(hash);
    assert.notEqual(badgeInteriorClip(art,0),badgeInteriorClip(art,1));
    assert.equal(badgeInteriorClip(art,-1),badgeInteriorClip(art,0));
  }
  assert.equal(hashes.size,6);
  assert.equal(adventureSkills.flatMap(skill=>skill.stages.map(stage=>adventureSkillBadgeArtwork(skill.id,stage.stage))).filter(Boolean).length,87);
});
test("Swimming stages beyond six remain unsupported by the programme", () => {
  for (const [skill,stage] of [["swimming",7],["swimming",8],["swimming",9],["camping",0],["unknown",1]] as const) {
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

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
test("all six Swimming stages select distinct original regions from the unchanged supplier photograph", () => {
  const source = JSON.parse(readFileSync(new URL("swimming/source.json", root),"utf8"));
  const bytes = readFileSync(new URL("swimming/original-stages.jpg", root));
  assert.equal(bytes.length,source.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),source.sha256);
  const regions=new Set<string>();
  for (let stage=1;stage<=6;stage++) {
    const art=adventureSkillBadgeArtwork("swimming",stage)!;
    assert.equal(art.src,"/badges/adventure-skills/swimming/original-stages.jpg");
    assert.equal(art.sourceRegion?.width,source.width);assert.equal(art.sourceRegion?.height,source.height);
    assert.ok(art.width>240&&art.width<260&&art.height>240&&art.height<260);
    assert.ok(art.sourceRegion!.left+art.width<=source.width&&art.sourceRegion!.top+art.height<=source.height);
    assert.ok(stage<=3?art.sourceRegion!.top<200:art.sourceRegion!.top>300);
    assert.ok(art.viewportPath?.startsWith("M"));
    regions.add(JSON.stringify(art.sourceRegion));
    assert.notEqual(badgeInteriorClip(art,0),badgeInteriorClip(art,1));
    assert.equal(badgeInteriorClip(art,-1),badgeInteriorClip(art,0));
  }
  assert.equal(regions.size,6);
  assert.equal(adventureSkills.flatMap(skill=>skill.stages.map(stage=>adventureSkillBadgeArtwork(skill.id,stage.stage))).filter(Boolean).length,87);
});
test("later Swimming stages pictured by the supplier remain unsupported by the programme", () => {
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

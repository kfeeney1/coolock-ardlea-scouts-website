import assert from "node:assert/strict";
import test from "node:test";

import { SCOUT_SECTION_ORDER } from "../../src/services/sectionOrder.ts";
import {
  NEUTRAL_SECTION_VISUAL_TOKENS,
  SECTION_VISUAL_TOKENS,
  resolveScoutSectionName,
  sectionVisualTokens
} from "../../src/theme/sectionColours.ts";

function relativeLuminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(left: string, right: string): number {
  const [lighter, darker] = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test("every canonical Scout section has a semantic visual token set", () => {
  assert.deepEqual(Object.keys(SECTION_VISUAL_TOKENS), [...SCOUT_SECTION_ORDER]);
  for (const section of SCOUT_SECTION_ORDER) {
    assert.equal(sectionVisualTokens(section).section, section);
  }
});

test("common section labels resolve to the canonical section identity", () => {
  assert.equal(resolveScoutSectionName("Beaver Scouts"), "Beavers");
  assert.equal(resolveScoutSectionName(" cub "), "Cubs");
  assert.equal(resolveScoutSectionName("SCOUTS"), "Scouts");
  assert.equal(resolveScoutSectionName("Venture Scout"), "Ventures");
  assert.equal(resolveScoutSectionName("Rover Scouts"), "Rovers");
});

test("unknown and unassigned sections use the safe neutral fallback", () => {
  assert.equal(resolveScoutSectionName(undefined), null);
  assert.equal(resolveScoutSectionName(""), null);
  assert.equal(resolveScoutSectionName("Group"), null);
  assert.equal(sectionVisualTokens(null), NEUTRAL_SECTION_VISUAL_TOKENS);
  assert.equal(sectionVisualTokens("Unknown"), NEUTRAL_SECTION_VISUAL_TOKENS);
});

test("section token values use six-digit hex colours and retain accessible text and focus contrast", () => {
  const tokenSets = [...Object.values(SECTION_VISUAL_TOKENS), NEUTRAL_SECTION_VISUAL_TOKENS];
  const hexPattern = /^#[0-9A-F]{6}$/;

  for (const tokens of tokenSets) {
    const colours = Object.entries(tokens).filter(([key]) => key !== "section").map(([, value]) => value as string);
    for (const colour of colours) assert.match(colour, hexPattern);

    for (const background of [tokens.subtleBackground, tokens.hoverBackground, tokens.selectedBackground]) {
      assert.ok(
        contrastRatio(tokens.foreground, background) >= 4.5,
        `${tokens.section ?? "Neutral"} foreground must meet WCAG AA contrast on ${background}`
      );
    }
    assert.ok(
      contrastRatio(tokens.focusRing, tokens.subtleBackground) >= 3,
      `${tokens.section ?? "Neutral"} focus ring must remain visible on its subtle background`
    );
  }
});

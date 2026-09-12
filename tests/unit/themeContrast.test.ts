import assert from "node:assert/strict";
import test from "node:test";

import { defaultTheme, modernTheme } from "../../src/theme/theme.ts";
import { SECTION_VISUAL_TOKENS } from "../../src/theme/sectionColours.ts";

function channel(value: number) {
  const normalised = value / 255;
  return normalised <= 0.04045
    ? normalised / 12.92
    : ((normalised + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const normalised = hex.replace("#", "");
  assert.equal(normalised.length, 6, `Expected six-digit hex colour, received ${hex}`);
  const red = channel(Number.parseInt(normalised.slice(0, 2), 16));
  const green = channel(Number.parseInt(normalised.slice(2, 4), 16));
  const blue = channel(Number.parseInt(normalised.slice(4, 6), 16));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function assertNormalTextContrast(label: string, foreground: string, background: string) {
  assert.ok(
    contrastRatio(foreground, background) >= 4.5,
    `${label} must meet the WCAG AA 4.5:1 contrast threshold for normal text`
  );
}

test("default and modern theme contained controls meet AA text contrast", () => {
  for (const [name, theme] of [["default", defaultTheme], ["modern", modernTheme]] as const) {
    assertNormalTextContrast(`${name} primary`, theme.palette.primary.contrastText, theme.palette.primary.main);
    assertNormalTextContrast(`${name} secondary`, theme.palette.secondary.contrastText, theme.palette.secondary.main);
    assertNormalTextContrast(`${name} success`, theme.palette.success.contrastText, theme.palette.success.main);
  }
});

test("section visual tokens provide AA text against their subtle and selected surfaces", () => {
  for (const [section, tokens] of Object.entries(SECTION_VISUAL_TOKENS)) {
    assertNormalTextContrast(`${section} subtle`, tokens.foreground, tokens.subtleBackground);
    assertNormalTextContrast(`${section} selected`, tokens.foreground, tokens.selectedBackground);
  }
});

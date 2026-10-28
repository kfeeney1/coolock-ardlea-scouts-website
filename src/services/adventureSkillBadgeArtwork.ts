import { adventureSkillsById } from "../data/adventureSkills/index.ts";

export type OriginalBadgeArtwork = {
  src: string;
  width: number;
  height: number;
  /** Pixel bounds safely inside the original frame: left, top, right, bottom. */
  interior: readonly [number, number, number, number];
};

// Original PDF image dimensions. Stages 2/3 of Backwoods and Sailing include
// wider source canvases; preserve those proportions rather than squashing them.
const sizes: Readonly<Record<string, readonly number[]>> = {
  camping: [378,378,378,378,378,378,378,378,378],
  backwoods: [380,401,401,380,379,379,380,380,380],
  pioneering: [378,378,378,378,378,378,378,378,378],
  hillwalking: [379,379,379,379,378,378,379,379,379],
  emergencies: [378,378,378,378,378,378,378,378,378],
  "air-activities": [379,379,379,379,378,378,379,379,379],
  paddling: [378,378,378,378,378,378,378,378,378],
  rowing: [379,378,378,378,378,378,378,378,378],
  sailing: [379,401,400,379,379,379,379,379,379]
};

/** Only verified original assets. Never manufacture Swimming stages from another symbol. */
export function adventureSkillBadgeArtwork(skillId: string, stage: number): OriginalBadgeArtwork | null {
  const definition = adventureSkillsById.get(skillId);
  if (!definition?.stages.some(item => item.stage === stage)) throw new Error(`Unknown Adventure Skill stage: ${skillId}/${stage}`);
  const width = sizes[skillId]?.[stage - 1];
  if (!width) return null;
  const widerCanvas = width >= 400;
  const height = widerCanvas ? skillId === "backwoods" && stage === 3 ? 387 : 386 : width;
  return {
    src: `/badges/adventure-skills/${skillId}/stage-${stage}.png`, width, height,
    // Conservative interior clipping leaves every original frame pixel intact.
    // No border colour is chosen, sampled from a screenshot or painted over.
    interior: widerCanvas ? [26,36,350,350] : [26,26,width-26,height-26]
  };
}

export function badgeInteriorClip(artwork: OriginalBadgeArtwork, fraction: number): string {
  const [left, top, right, bottom] = artwork.interior;
  const fill = Math.max(0, Math.min(1, fraction));
  const revealTop = bottom - (bottom - top) * fill;
  return `inset(${revealTop / artwork.height * 100}% ${(artwork.width - right) / artwork.width * 100}% ${(artwork.height - bottom) / artwork.height * 100}% ${left / artwork.width * 100}%)`;
}

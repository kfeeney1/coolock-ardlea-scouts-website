import { adventureSkillsById } from "../data/adventureSkills/index.ts";

export type OriginalBadgeArtwork = {
  src: string;
  width: number;
  height: number;
  /** Pixel bounds safely inside the original frame: left, top, right, bottom. */
  interior: readonly [number, number, number, number];
  /** Unmodified source photograph; viewport in original source pixels. */
  viewportPath?: string;
  sourceRegion?: { width: number; height: number; left: number; top: number };
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

// Exact viewports within the supplier’s unmodified original photograph. Only
// stages 1–6 are programme-supported; the source also photographs later badges.
const swimmingViewports = [[126,122,254,252],[378,116,251,252],[628,114,253,250],[132,371,256,250],[378,364,255,252],[631,362,251,250]] as const;
// Follow the photographed outer silhouettes to exclude adjacent badges. These
// select original pixels only; they neither draw nor recolour any stage frame.
const swimmingSilhouettes = [
  [[143,124],[367,128],[379,138],[377,359],[364,372],[143,371],[128,362],[131,139]],
  [[393,119],[615,117],[628,125],[626,347],[614,365],[393,366],[380,355],[379,134]],
  [[638,116],[868,116],[878,123],[878,347],[868,360],[644,361],[630,353],[630,128]],
  [[150,374],[375,377],[387,390],[379,603],[366,617],[146,618],[134,604],[140,389]],
  [[403,365],[624,368],[632,379],[629,600],[619,613],[389,607],[381,602],[392,375]],
  [[643,364],[870,364],[880,374],[880,596],[871,608],[641,604],[632,596],[632,377]]
] as const;

function sourceViewportPath(stage: number, left: number, top: number, width: number, height: number): string {
  const p=swimmingSilhouettes[stage-1].map(([x,y]) => [(x-left)/width,(y-top)/height]);
  const at=(i:number) => p[i].join(" ");
  // Rounded corners select the photographed edge rather than bevel it. Curves
  // are clipping geometry only; the displayed border remains original pixels.
  return `M${at(0)} L${at(1)} Q${p[2][0]} ${p[1][1]} ${at(2)} L${at(3)} Q${p[3][0]} ${p[4][1]} ${at(4)} L${at(5)} Q${p[6][0]} ${p[5][1]} ${at(6)} L${at(7)} Q${p[7][0]} ${p[0][1]} ${at(0)} Z`;
}

/** Only verified original assets. Never manufacture Swimming stages from another symbol. */
export function adventureSkillBadgeArtwork(skillId: string, stage: number): OriginalBadgeArtwork | null {
  const definition = adventureSkillsById.get(skillId);
  if (!definition?.stages.some(item => item.stage === stage)) throw new Error(`Unknown Adventure Skill stage: ${skillId}/${stage}`);
  if (skillId === "swimming") {
    const [left, top, width, height] = swimmingViewports[stage - 1];
    return { src: "/badges/adventure-skills/swimming/original-stages.jpg", width, height,
      interior: [26,26,width-26,height-26],
      viewportPath: sourceViewportPath(stage,left,top,width,height), sourceRegion: { width: 1000, height: 1000, left, top } };
  }
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
  const source = artwork.sourceRegion ?? { width: artwork.width, height: artwork.height, left: 0, top: 0 };
  return `inset(${(source.top + revealTop) / source.height * 100}% ${(source.width - source.left - right) / source.width * 100}% ${(source.height - source.top - bottom) / source.height * 100}% ${(source.left + left) / source.width * 100}%)`;
}

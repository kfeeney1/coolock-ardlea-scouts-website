import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useState } from "react";
import type { AdventureStageOverview } from "../../services/adventureSkillOverviewLogic.ts";
import { adventureSkillBadgeProgress } from "../../services/adventureSkillBadgeProgress.ts";
import { adventureSkillBadgeArtwork, badgeInteriorClip } from "../../services/adventureSkillBadgeArtwork.ts";

type Props = { skillId: string; progress: AdventureStageOverview; unsaved?: boolean; size?: number };

/** Read-only presentation shared by leader and parent views; no write/award capabilities. */
export default function AdventureSkillBadge({ skillId, progress, unsaved = false, size = 144 }: Props) {
  const badge = adventureSkillBadgeProgress(skillId, progress);
  const artwork = adventureSkillBadgeArtwork(skillId, progress.stage);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const unavailable = !artwork || failedSource === artwork.src;
  const imageStyle = { display: "block", width: "100%", height: "100%", objectFit: "contain" as const, gridArea: "1 / 1" };
  return <Stack component="figure" aria-label={`${badge.skillName} stage ${badge.stage}`} spacing={.75} sx={{ m: 0, minWidth: 0, width: size, maxWidth: "100%" }} data-testid={`adventure-badge-${skillId}-${badge.stage}`}>
    <Box data-testid="original-badge-artwork" sx={{ width: "100%", aspectRatio: artwork ? `${artwork.width} / ${artwork.height}` : "1", display: "grid", position: "relative", alignItems: "center" }}>
      {unavailable ? <Stack spacing={1} sx={{ p: 1, alignItems: "center" }}>
        <Typography role="status" variant="caption" sx={{ textAlign: "center" }}>Original badge artwork unavailable</Typography>
        {artwork && <Button variant="outlined" size="small" aria-label={`Retry ${badge.skillName} stage ${badge.stage} artwork`} onClick={() => { setFailedSource(null); setLoadedSource(null); }} sx={{ minHeight: 44 }}>Retry artwork</Button>}
      </Stack> : <>
        <Box component="img" src={artwork.src} alt="" aria-hidden="true" onLoad={() => setLoadedSource(artwork.src)} onError={() => setFailedSource(artwork.src)} sx={imageStyle} />
        <Box component="img" src={artwork.src} alt="" aria-hidden="true" sx={{ ...imageStyle, filter: "grayscale(.7)", clipPath: badgeInteriorClip(artwork, 1) }} />
        <Box component="img" src={artwork.src} alt="" aria-hidden="true" sx={{ ...imageStyle, clipPath: badgeInteriorClip(artwork, badge.fillFraction), transition: "clip-path 160ms ease-out", "@media (prefers-reduced-motion: reduce)": { transition: "none" } }} />
        {loadedSource !== artwork.src && <Typography role="status" variant="caption" sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "background.paper" }}>Loading original badge artwork…</Typography>}
      </>}
    </Box>
    <Stack component="figcaption" spacing={.5}>
      <Typography variant="body2" sx={{ fontWeight: 800 }}>{badge.skillName} · Stage {badge.stage}</Typography>
      <Typography variant="caption">{badge.completed}/{badge.total} competencies</Typography>
      <Chip size="small" variant="outlined" color={badge.status === "awarded" ? "success" : badge.status === "requirements-complete" ? "warning" : "default"} label={badge.statusLabel} sx={{ alignSelf: "flex-start", maxWidth: "100%", color: "text.primary" }} />
      {unsaved && <Typography variant="caption" sx={{ fontWeight: 700 }}>Unsaved preview</Typography>}
    </Stack>
  </Stack>;
}

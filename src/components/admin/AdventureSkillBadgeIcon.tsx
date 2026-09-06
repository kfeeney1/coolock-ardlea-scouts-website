import FlightIcon from "@mui/icons-material/Flight";
import ForestIcon from "@mui/icons-material/Forest";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import HikingIcon from "@mui/icons-material/Hiking";
import KayakingIcon from "@mui/icons-material/Kayaking";
import ParkIcon from "@mui/icons-material/Park";
import PoolIcon from "@mui/icons-material/Pool";
import RowingIcon from "@mui/icons-material/Rowing";
import SailingIcon from "@mui/icons-material/Sailing";
import TerrainIcon from "@mui/icons-material/Terrain";
import { Box } from "@mui/material";

import { adventureSkillColour } from "../../services/adventureSkillPresentation.ts";

type Props = {
  skillId: string;
  size?: number;
};

function iconForSkill(skillId: string) {
  if (skillId === "camping") return <ForestIcon />;
  if (skillId === "backwoods") return <HikingIcon />;
  if (skillId === "pioneering") return <ParkIcon />;
  if (skillId === "emergencies") return <HealthAndSafetyIcon />;
  if (skillId === "hillwalking") return <TerrainIcon />;
  if (skillId === "air-activities") return <FlightIcon />;
  if (skillId === "paddling") return <KayakingIcon />;
  if (skillId === "rowing") return <RowingIcon />;
  if (skillId === "sailing") return <SailingIcon />;
  if (skillId === "swimming") return <PoolIcon />;
  return null;
}

export default function AdventureSkillBadgeIcon({ skillId, size = 54 }: Props) {
  return <Box
    aria-hidden="true"
    sx={{
      width: size,
      height: size,
      borderRadius: 1.25,
      display: "grid",
      placeItems: "center",
      flex: "0 0 auto",
      backgroundColor: adventureSkillColour(skillId),
      color: "common.white",
      "& svg": { fontSize: Math.round(size * .62) }
    }}
  >
    {iconForSkill(skillId)}
  </Box>;
}

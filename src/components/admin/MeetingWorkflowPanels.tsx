import MeetingRunProgrammeReference from "./MeetingRunProgrammeReference";
import { Box, Stack } from "@mui/material";
import type { ComponentProps } from "react";
import WeeklyMeetingAttendancePanel from "./WeeklyMeetingAttendancePanel";
import WeeklyProgrammePlanner from "./WeeklyProgrammePlanner";
import WeeklyMeetingDetailsPanels from "./WeeklyMeetingDetailsPanels";
import { meetingStage, type MeetingStep } from "../../services/meetingWorkflow";

type Props = {
  redesigned: boolean; step: MeetingStep;
  attendance: ComponentProps<typeof WeeklyMeetingAttendancePanel>;
  programme: ComponentProps<typeof WeeklyProgrammePlanner>;
  details: ComponentProps<typeof WeeklyMeetingDetailsPanels>;
};
export default function MeetingWorkflowPanels({ redesigned, step, attendance, programme, details }: Props) {
  if (!redesigned) return <>
    {step === "attendance" && <WeeklyMeetingAttendancePanel {...attendance} />}
    {step === "programme" && <WeeklyProgrammePlanner {...programme} />}
    <WeeklyMeetingDetailsPanels {...details} />
  </>;
  const stage = meetingStage(step);
  // Keep the mounted panels and their local UI state when moving between stages.
  return <>
    <Box hidden={stage !== "plan"}><WeeklyProgrammePlanner {...programme} compact /></Box>
    <Stack hidden={stage !== "run"} spacing={2} sx={stage !== "run" ? { display: "none" } : undefined}>
      <MeetingRunProgrammeReference selected={details.selected} />
      <WeeklyMeetingAttendancePanel {...attendance} />
      <WeeklyMeetingDetailsPanels {...details} redesigned step="injuries" />
    </Stack>
    <Stack hidden={stage !== "review"} spacing={2} sx={stage !== "review" ? { display: "none" } : undefined}>
      <WeeklyMeetingDetailsPanels {...details} step="badgework" />
      <WeeklyMeetingDetailsPanels {...details} step="notes" />
    </Stack>
  </>;
}

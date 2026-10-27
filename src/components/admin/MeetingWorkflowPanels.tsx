import MeetingReviewBadgework from "./MeetingReviewBadgework";
import MeetingRunProgrammeReference from "./MeetingRunProgrammeReference";
import { Box, Stack } from "@mui/material";
import type { ComponentProps } from "react";
import WeeklyMeetingAttendancePanel from "./WeeklyMeetingAttendancePanel";
import WeeklyProgrammePlanner from "./WeeklyProgrammePlanner";
import WeeklyMeetingDetailsPanels from "./WeeklyMeetingDetailsPanels";
import { meetingStage, type MeetingStep } from "../../services/meetingWorkflow";

type Props = {
  redesigned: boolean; step: MeetingStep; busy?: boolean; onOpenBadgework?: () => void;
  attendance: ComponentProps<typeof WeeklyMeetingAttendancePanel>;
  programme: ComponentProps<typeof WeeklyProgrammePlanner>;
  details: ComponentProps<typeof WeeklyMeetingDetailsPanels>;
};
export default function MeetingWorkflowPanels({ redesigned, step, attendance, programme, details, busy = false, onOpenBadgework }: Props) {
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
      <MeetingReviewBadgework selected={details.selected} readOnly={details.planningReadOnly} busy={busy} onOpen={onOpenBadgework} patch={details.patch} />
      <WeeklyMeetingDetailsPanels {...details} step="notes" />
    </Stack>
  </>;
}

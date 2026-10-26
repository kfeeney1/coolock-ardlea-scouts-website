import { groupLocalDate } from "./groupLocalDate.ts";
export type MeetingStage = "plan" | "run" | "review";
export type MeetingStep = "attendance" | "programme" | "badgework" | "injuries" | "notes";
export function meetingStage(step: MeetingStep): MeetingStage {
  return step === "programme" ? "plan" : step === "attendance" || step === "injuries" ? "run" : "review";
}
export function initialMeetingStage(status: string, date: string, today = groupLocalDate()): MeetingStep {
  return status === "closed" || date < today ? "badgework" : date === today ? "attendance" : "programme";
}

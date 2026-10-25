import type { CalendarEntry } from "./groupCalendar.ts";
import { trainingCategories, trainingLabels, trainingDatesError, type LeaderTrainingRecord, type TrainingCategory } from "./leaderTrainingLogic.ts";
export function trainingCalendarEntry(uid: string, name: string, category: string, record: LeaderTrainingRecord, own: boolean): CalendarEntry | null {
  if (!trainingCategories.includes(category as TrainingCategory) || record.showOnCalendar !== true || !record.expiryDate || trainingDatesError(record)) return null;
  return { id: `training:${uid}:${category}`, type: "training", title: `${trainingLabels[category as TrainingCategory]} renewal · ${name}`, date: record.expiryDate, time: "", section: "Group", path: `${own ? "/leader/profile" : `/leader/access/${encodeURIComponent(uid)}`}#training-${category}` };
}

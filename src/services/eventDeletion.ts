import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import app, { appEnvironment } from "../firebase";
import type { EventRecord } from "./eventAdmin";

export type EventDeletionPreflight = { event: EventRecord; photoCount: number; revision: number; blockers: string[] };

type InspectionResponse = {
  eventId: string;
  title: string;
  section: string;
  startDate: string;
  endDate: string;
  photoCount: number;
  revision: number;
  blockers: string[];
};

const functions = getFunctions(app, "europe-west1");
const emulatorHost = import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST?.trim();
if (appEnvironment !== "local" && emulatorHost) {
  throw new Error("Non-local builds must not reference a Functions emulator.");
}
if (appEnvironment === "local" && emulatorHost) {
    const [host, rawPort] = emulatorHost.split(":");
    const port = Number(rawPort);
    if (!host || !Number.isInteger(port) || port <= 0) throw new Error("Invalid Functions emulator address.");
    connectFunctionsEmulator(functions, host, port);
}

export async function inspectEventDeletion(event: EventRecord): Promise<EventDeletionPreflight> {
  // The trusted callable performs canonical Super Admin checks and independently
  // reads the event. Client-provided details are never used for authorisation.
  const callable = httpsCallable<{ action: "inspect"; eventId: string }, InspectionResponse>(
    functions, "eventDeletion"
  );
  const result = (await callable({ action: "inspect", eventId: event.id })).data;
  if (result.eventId !== event.id || result.title !== event.title
    || result.section !== event.section || result.startDate !== event.startDate || result.endDate !== event.endDate) {
    throw new Error("Event details changed. Refresh before reviewing deletion.");
  }
  if (!Number.isSafeInteger(result.revision) || result.revision <= 0) {
    throw new Error("Deletion review did not include a trusted event revision.");
  }
  return { event, photoCount: result.photoCount, revision: result.revision, blockers: result.blockers };
}

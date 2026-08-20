import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

export type PublicActivity = {
  id: string;
  title: string;
  description: string;
  eventType: string;
  section: string;
  location: string;
  startDate: string;
  endDate: string;
  status: "draft" | "open" | "closed" | "completed";
};

function stringValue(data: Record<string, unknown>, key: string): string {
  return typeof data[key] === "string" ? String(data[key]).trim() : "";
}

export async function loadUpcomingPublicActivities(): Promise<PublicActivity[]> {
  const snapshot = await getDocs(
    query(collection(db, "publicActivities"), orderBy("startDate", "asc"))
  );
  const today = new Date().toISOString().slice(0, 10);

  return snapshot.docs
    .map((item) => {
      const data = item.data();
      const status =
        data.status === "open" || data.status === "closed" || data.status === "completed"
          ? data.status
          : "draft";
      return {
        id: item.id,
        title: stringValue(data, "title") || "Upcoming activity",
        description: stringValue(data, "description"),
        eventType: stringValue(data, "eventType") || "Activity",
        section: stringValue(data, "section") || "All Sections",
        location: stringValue(data, "location"),
        startDate: stringValue(data, "startDate"),
        endDate: stringValue(data, "endDate"),
        status
      } as PublicActivity;
    })
    .filter((activity) => activity.status === "open" && activity.startDate >= today);
}

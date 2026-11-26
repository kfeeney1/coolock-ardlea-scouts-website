import { expect } from "@playwright/test";

export async function persistedAudienceMemberIds(eventId: string): Promise<string[]> {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "demo-coolock-ardlea-scouts";
  const url = new URL(`http://127.0.0.1:8080/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/events/${encodeURIComponent(eventId)}/audienceMembers`);
  // Event audiences allow up to 450 members. Ask for more than that in the
  // emulator REST read so the assertion compares against the complete snapshot.
  url.searchParams.set("pageSize", "1000");
  const response = await fetch(url, { headers: { Authorization: "Bearer owner" } });
  expect(response.ok, "Firestore emulator should return persisted audience rows").toBe(true);
  const data = await response.json() as { documents?: Array<{ name: string }> };
  return (data.documents ?? []).map((document) => document.name.split("/").pop() ?? "").filter(Boolean).sort();
}

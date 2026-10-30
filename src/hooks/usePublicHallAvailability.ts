import { useEffect, useState } from "react";
import { collection, documentId, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { publicHallDay, type HallDayTimes } from "../services/publicHallAvailability.ts";
export function usePublicHallAvailability(month: string) {
  const [state, setState] = useState<{month: string; loading: boolean; error: string; days: Record<string, HallDayTimes>}>({month, loading: true, error: "", days: {}});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setState({month, loading: true, error: "", days: {}});
    return onSnapshot(query(collection(db, "hallAvailability"), where(documentId(), ">=", `${month}-01`), where(documentId(), "<=", `${month}-31`), limit(31)), {includeMetadataChanges: true}, snapshot => {
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      try {
        const days: Record<string, HallDayTimes> = {};
        for (const document of snapshot.docs) days[document.id] = publicHallDay(document.id, document.data());
        setState({month, loading: false, error: "", days});
      } catch {setState({month, loading: false, error: "Availability could not be verified. Contact the group before choosing a time.", days: {}});}
    }, () => setState({month, loading: false, error: "Unable to load live hall availability. Contact the group or try again.", days: {}}));
  }, [month, attempt]);
  return {...state, ...(state.month !== month ? {loading: true, error: "", days: {}} : {}), retry: () => setAttempt(value => value + 1)};
}

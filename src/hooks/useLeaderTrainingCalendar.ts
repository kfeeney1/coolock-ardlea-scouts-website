import { useEffect, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { watchLeaderTrainingExperience } from "../services/leaderTrainingExperienceSettings";
import { watchLeaderTrainingCalendar } from "../services/leaderTrainingCalendar";
import type { CalendarEntry } from "../services/groupCalendar";
export function useLeaderTrainingCalendar(allowed: boolean, month: string, revision: number) {
  const {user, adminProfile} = useAdminAuth();
  const [enabled, setEnabled] = useState(false), [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({key: "", entries: [] as CalendarEntry[], loading: false, error: ""});
  useEffect(() => {
    setEnabled(false);
    if (!allowed) return;
    return watchLeaderTrainingExperience(version => setEnabled(version === "redesigned"), () => setEnabled(false));
  }, [allowed, user?.uid, attempt]);
  const available = enabled && allowed && Boolean(adminProfile);
  const key = JSON.stringify([available, user?.uid, month, revision, adminProfile?.role, attempt]);
  useEffect(() => {
    let active = true, stop = () => {};
    setState({key, entries: [], loading: available, error: ""});
    if (!available) return;
    const failed = () => {if (active) {active = false; stop(); clearTimeout(deadline); setState({key, entries: [], loading: false, error: "Unable to load training renewals. Retry to reconnect."});}};
    const deadline = setTimeout(failed, 15000);
    void watchLeaderTrainingCalendar(adminProfile, month, entries => {if (active) {clearTimeout(deadline); setState({key, entries, loading: false, error: ""});}}, failed).then(unsubscribe => {if (active) stop = unsubscribe; else unsubscribe();}).catch(failed);
    return () => {active = false; clearTimeout(deadline); stop();};
  }, [key]);
  return {enabled: available, ...(available && state.key === key ? state : {entries: [] as CalendarEntry[], loading: available, error: ""}), retry: () => setAttempt(value => value + 1)};
}

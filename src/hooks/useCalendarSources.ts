import { useEffect, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { calendarSources, watchCalendarSources } from "../services/calendarSources";
import type { CalendarEntry } from "../services/groupCalendar";
export function useCalendarSources(enabled: boolean, month: string, revision: number) {
  const {user, adminProfile} = useAdminAuth();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({key: "", loading: true, entries: [] as CalendarEntry[], sections: [] as string[], error: ""});
  const identity = JSON.stringify([user?.uid, adminProfile?.role, adminProfile?.sections, adminProfile?.appointments]);
  const key = JSON.stringify([enabled, identity, month, revision, attempt]);
  useEffect(() => {
    let active = true; let stop = () => {};
    setState({key, loading: enabled, entries: [], sections: [], error: ""});
    if (!enabled) return;
    const failed = () => { if (active) {active = false; clearTimeout(deadline); stop(); setState({key, loading: false, entries: [], sections: [], error: "Unable to load Calendar records. Retry to reconnect; your month and filters are retained."});} };
    const deadline = setTimeout(failed, 15000);
    void calendarSources(adminProfile).then(sources => {
      if (!active) return;
      const sections = [...new Set(sources.flatMap(source => source.sections).map(section => section === "All Sections" ? "Group" : section))].sort();
      stop = watchCalendarSources(sources, month, entries => {if (active) {clearTimeout(deadline); setState({key, loading: false, entries, sections: [...new Set([...sections, ...entries.map(entry => entry.section)])].sort(), error: ""});}}, failed);
    }).catch(failed);
    return () => {active = false; clearTimeout(deadline); stop();};
    // The signature covers all identity/scope fields; theme changes need no source reload.
  }, [key]);
  const current = state.key === key && enabled;
  return {...(current ? state : {loading: enabled, entries: [] as CalendarEntry[], sections: [] as string[], error: ""}), retry: () => setAttempt(value => value + 1)};
}

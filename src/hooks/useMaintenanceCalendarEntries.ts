import { useEffect, useState } from "react";
import { watchMaintenanceAppointments } from "../services/maintenanceAppointmentStore";
import type { CalendarEntry } from "../services/groupCalendar";
export function useMaintenanceCalendarEntries(allowed: boolean, accessKey: string, month: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({key: "", entries: [] as CalendarEntry[], loading: false, error: ""});
  const key = JSON.stringify([allowed, accessKey, month, attempt]);
  useEffect(() => {
    let active = true; setState({key, entries: [], loading: allowed, error: ""});
    if (!allowed) return;
    const failed = () => {if (active) {clearTimeout(deadline); stop(); setState({key, entries: [], loading: false, error: "Unable to load Maintenance appointments. Retry to reconnect; your month and filters are retained."});}};
    const deadline = setTimeout(failed, 15000);
    const stop = watchMaintenanceAppointments(month, entries => {if (active) {clearTimeout(deadline); setState({key, entries, loading: false, error: ""});}}, failed);
    return () => {active = false; clearTimeout(deadline); stop();};
  }, [key]);
  return {...(allowed && state.key === key ? state : {entries: [] as CalendarEntry[], loading: allowed, error: ""}), retry: () => setAttempt(value => value + 1)};
}

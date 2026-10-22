import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { watchCalendarExperience } from "../services/calendarExperienceSettings";
import { registerGroupMembership } from "../services/maintenanceMembership";
type Access = { loading: boolean; enabled: boolean; allowed: boolean; error: string; retry: () => void };
const CalendarAccess = createContext<Access>({loading: true, enabled: false, allowed: false, error: "", retry: () => {}});
export function CalendarAccessProvider({children}: {children: ReactNode}) {
  const { user, loading } = useAdminAuth();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({uid: "", checked: false, enabled: false, allowed: false, error: ""});
  useEffect(() => {
    const uid = user?.uid || "";
    let generation = 0; let active = true; let stopMember = () => {};
    setState({uid, checked: false, enabled: false, allowed: false, error: ""});
    if (!uid) return;
    const stop = watchCalendarExperience(version => {
      const current = ++generation;
      stopMember();
      const enabled = version === "redesigned";
      setState({uid, checked: !enabled, enabled, allowed: false, error: ""});
      if (!enabled) return;
      void registerGroupMembership("calendar").then(member => {
        if (!active || generation !== current) return;
        if (!member) { setState({uid, checked: true, enabled, allowed: false, error: ""}); return; }
        stopMember = onSnapshot(doc(db, "calendar/group/access", uid), {includeMetadataChanges: true}, snapshot => {
          if (active && generation === current && !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) setState({uid, checked: true, enabled, allowed: snapshot.exists(), error: ""});
        }, () => { if (active && generation === current) setState({uid, checked: true, enabled, allowed: false, error: "Calendar access changed. Retry to verify group membership."}); });
      }).catch(() => { if (active && generation === current) setState({uid, checked: true, enabled, allowed: false, error: "Unable to verify Calendar membership. Retry to reconnect."}); });
    }, () => { if (active) { ++generation; stopMember(); setState({uid, checked: true, enabled: false, allowed: false, error: "Unable to check Calendar availability. Retry to reconnect."}); } });
    return () => { active = false; ++generation; stop(); stopMember(); };
  }, [user?.uid, attempt]);
  const valid = Boolean(user && state.uid === user.uid);
  const value = {loading: loading || Boolean(user && (!valid || !state.checked)), enabled: valid && state.enabled, allowed: !loading && valid && state.allowed && !state.error, error: valid ? state.error : "", retry: () => setAttempt(n => n + 1)};
  return <CalendarAccess.Provider value={value}>{children}</CalendarAccess.Provider>;
}
export function useCalendarAccess() { return useContext(CalendarAccess); }

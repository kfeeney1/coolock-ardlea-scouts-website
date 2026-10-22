import { useEffect, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { watchMaintenanceExperience } from "../services/maintenanceExperienceSettings";
import { checkMaintenanceMembership } from "../services/maintenanceMembership";
import { watchCalendarMembership } from "../services/watchCalendarMembership";
export function useMaintenanceAccess() {
  const {user, loading} = useAdminAuth();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({uid: "", enabled: null as boolean | null, member: false, checked: false, error: ""});
  useEffect(() => {
    const uid = user?.uid || ""; let active = true, generation = 0; let stopMember = () => {};
    setState({uid, enabled: null, member: false, checked: false, error: ""});
    if (!uid) return;
    const stop = watchMaintenanceExperience(version => {
      const current = ++generation; stopMember(); const enabled = version === "redesigned";
      setState({uid, enabled, member: false, checked: !enabled, error: ""});
      if (!enabled) return;
      void checkMaintenanceMembership().then(member => {
        if (!active || current !== generation) return;
        if (!member) {setState({uid, enabled, member: false, checked: true, error: ""}); return;}
        stopMember = watchCalendarMembership(uid,
          () => {if (active && current === generation) setState({uid, enabled, member: true, checked: true, error: ""});},
          () => {if (active && current === generation) setState({uid, enabled, member: false, checked: false, error: ""});},
          () => {if (active && current === generation) {++generation; stopMember(); setState({uid, enabled, member: false, checked: false, error: ""}); setAttempt(value => value + 1);}},
          () => {if (active && current === generation) setState({uid, enabled, member: false, checked: true, error: "Unable to verify group membership. Reload to retry."});}, "maintenance");
      }).catch(() => {if (active && current === generation) setState({uid, enabled, member: false, checked: true, error: "Unable to verify group membership. Reload to retry."});});
    }, () => {if (active) {++generation; stopMember(); setState({uid, enabled: false, member: false, checked: true, error: "Unable to check Maintenance availability. Reload to retry."});}});
    return () => {active = false; ++generation; stop(); stopMember();};
  }, [user?.uid, attempt]);
  const valid = Boolean(user && state.uid === user.uid);
  return {loading: loading || Boolean(user && (!valid || state.enabled === null || (state.enabled && !state.checked)) && !state.error), enabled: state.enabled, member: valid && state.member, allowed: !loading && valid && state.enabled === true && state.member && !state.error, error: state.error};
}

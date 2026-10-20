import { useEffect, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { watchMaintenanceExperience } from "../services/maintenanceExperienceSettings";
import { checkMaintenanceMembership } from "../services/maintenanceApi";

export function useMaintenanceAccess() {
  const { user, loading } = useAdminAuth();
  const [state, setState] = useState({uid: "", enabled: null as boolean | null, member: false, checked: false, error: ""});
  useEffect(() => {
    let current = true;
    const uid = user?.uid || "";
    setState({uid, enabled: null, member: false, checked: false, error: ""});
    if (!uid) return;
    const stop = watchMaintenanceExperience(version => {
      if (!current) return;
      setState(s => ({...s, enabled: version === "redesigned"}));
      if (version !== "redesigned") return;
      void checkMaintenanceMembership().then(member => {
        if (current) setState(s => ({...s, member, checked: true, error: ""}));
      }).catch(() => { if (current) setState(s => ({...s, checked: true, member: false, error: "Unable to verify group membership. Reload to retry."})); });
    }, () => { if (current) setState(s => ({...s, error: "Unable to check Maintenance availability. Reload to retry."})); });
    return () => { current = false; stop(); };
  }, [user?.uid]);
  const valid = Boolean(user && state.uid === user.uid);
  return {loading: loading || Boolean(user && (!valid || state.enabled === null || (state.enabled && !state.checked)) && !state.error), enabled: state.enabled, member: valid && state.member, allowed: !loading && valid && state.enabled === true && state.member && !state.error, error: state.error};
}

import { useEffect, useState } from "react";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { useCalendarAccess } from "./useCalendarAccess";
import { watchMaintenanceExperience } from "../services/maintenanceExperienceSettings";
import { registerGroupMembership } from "../services/maintenanceMembership";
/** Calendar's canonical proof watcher also supplies immediate membership/role-union changes. */
export function useCalendarMaintenance() {
  const calendar = useCalendarAccess(), {user} = useAdminAuth();
  const [attempt, setAttempt] = useState(0);
  const [policy, setPolicy] = useState({uid: "", ready: false, enabled: false, error: ""});
  const [membership, setMembership] = useState({key: "", allowed: false, error: ""});
  useEffect(() => {
    const uid = user?.uid || ""; let active = true;
    setPolicy({uid, ready: false, enabled: false, error: ""});
    if (!uid) return;
    const stop = watchMaintenanceExperience(version => {if (active) setPolicy({uid, ready: true, enabled: version === "redesigned", error: ""});}, () => {if (active) setPolicy({uid, ready: true, enabled: false, error: "Unable to check Maintenance availability. Retry to reconnect."});});
    return () => {active = false; stop();};
  }, [user?.uid, attempt]);
  const enabled = policy.uid === user?.uid && policy.enabled;
  const key = JSON.stringify([user?.uid, calendar.allowed, calendar.revision, enabled, attempt]);
  useEffect(() => {
    let active = true; setMembership({key: "", allowed: false, error: ""});
    if (!calendar.allowed || !enabled) return;
    void registerGroupMembership("maintenance").then(allowed => {if (active) setMembership({key, allowed, error: ""});}).catch(() => {if (active) setMembership({key, allowed: false, error: "Unable to verify Maintenance membership. Retry to reconnect."});});
    return () => {active = false;};
  }, [key]);
  return {key, allowed: calendar.allowed && enabled && membership.key === key && membership.allowed, loading: calendar.loading || (calendar.allowed && ((!policy.ready || policy.uid !== user?.uid) || (enabled && membership.key !== key))), error: policy.error || (membership.key === key ? membership.error : ""), retry: () => setAttempt(value => value + 1)};
}

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { watchMaintenanceExperience } from "../services/maintenanceExperienceSettings";

/** Group membership comes from this project's canonical private accounts, never login alone. */
export function useMaintenanceAccess() {
  const { user, loading, authorised } = useAdminAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [parent, setParent] = useState<{ uid: string; approved: boolean } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setEnabled(null); setParent(null); setError("");
    if (!user) return;
    const stopSetting = watchMaintenanceExperience(v => setEnabled(v === "redesigned"), () => setError("Unable to check Maintenance availability. Reload to retry."));
    const stopParent = authorised ? () => {} : onSnapshot(doc(db, "parentAccounts", user.uid), snapshot => {
      setParent({ uid: user.uid, approved: snapshot.data()?.status === "approved" });
    }, () => setError("Unable to verify group membership. Reload to retry."));
    return () => { stopSetting(); stopParent(); };
  }, [user?.uid, authorised]);
  const member = Boolean(user && (authorised || (parent?.uid === user.uid && parent.approved)));
  return { loading: loading || Boolean(user && (enabled === null || (!authorised && parent?.uid !== user.uid)) && !error), enabled, member, allowed: enabled === true && member, error };
}

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { canManageHallBookings } from "../security/hallBookingAccess.ts";
import { watchHallHire } from "../services/hallHireSettings";
export function useHallHireAccess() {
  const {user, authorised} = useAdminAuth();
  const identity = `${user?.uid ?? ""}:${authorised}`;
  const [state, setState] = useState({identity, loading: true, allowed: false, enabled: false, error: ""});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true, enabled = false, seen = false, profile: Record<string, unknown> | null | undefined, organisation: Record<string, unknown> | null | undefined, healthy = true;
    setState({identity, loading: true, allowed: false, enabled: false, error: ""});
    const emit = () => {if (active && healthy) setState({identity, loading: !seen || (Boolean(user && authorised) && (profile === undefined || organisation === undefined)), enabled, allowed: enabled && canManageHallBookings(profile ?? null, organisation ?? null), error: ""});};
    const fail = () => {if (active) {healthy = false; setState({identity, loading: false, allowed: false, enabled: false, error: "Unable to verify Hall Hire access."});}};
    const stop = watchHallHire(value => {enabled = value; seen = true; emit();}, fail);
    const stops = user && authorised ? [onSnapshot(doc(db, "adminUsers", user.uid), {includeMetadataChanges: true}, snapshot => {if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {profile = snapshot.data() ?? null; emit();}}, fail), onSnapshot(doc(db, "organisationLeadership", user.uid), {includeMetadataChanges: true}, snapshot => {if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {organisation = snapshot.data() ?? null; emit();}}, fail)] : [];
    const timer = window.setInterval(emit, 60_000);
    return () => {active = false; window.clearInterval(timer); stop(); stops.forEach(unsubscribe => unsubscribe());};
  }, [user, authorised, identity, attempt]);
  return {...state, ...(state.identity !== identity ? {loading: true, allowed: false, enabled: false, error: ""} : {}), retry: () => setAttempt(value => value + 1)};
}

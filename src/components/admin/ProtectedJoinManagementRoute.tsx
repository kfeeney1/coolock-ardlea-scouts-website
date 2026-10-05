import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { activeScoutingAppointments, isGroupLeadershipAppointment } from "../../security/scoutingAppointments";
import { useAdminAuth } from "./AdminAuthProvider";

type Props = { children: ReactNode };

export default function ProtectedJoinManagementRoute({ children }: Props) {
  const { adminProfile } = useAdminAuth();
  if (!adminProfile) return <Navigate to="/leader" replace />;

  const isAdmin = adminProfile.role === "admin" || adminProfile.role === "super-admin";
  const permittedAppointment = activeScoutingAppointments(adminProfile.appointments)
    .some((item) => item.appointment === "Section Leader" || isGroupLeadershipAppointment(item.appointment));

  if (!isAdmin && !permittedAppointment) {
    return <Navigate to="/leader" replace />;
  }

  return <>{children}</>;
}

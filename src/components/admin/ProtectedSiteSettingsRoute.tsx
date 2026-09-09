import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { isGroupLeadershipAppointment } from "../../security/scoutingAppointments";
import { useAdminAuth } from "./AdminAuthProvider";

type Props = { children: ReactNode };

export default function ProtectedSiteSettingsRoute({ children }: Props) {
    const { adminProfile } = useAdminAuth();
    const canManageSettings = adminProfile?.role === "admin"
        || adminProfile?.role === "super-admin"
        || adminProfile?.scoutingRole === "Group Treasurer"
        || isGroupLeadershipAppointment(adminProfile?.scoutingRole);

    if (!canManageSettings) return <Navigate to="/leader" replace />;
    return <>{children}</>;
}

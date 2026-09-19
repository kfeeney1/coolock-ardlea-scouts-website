import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { hasGroupFinanceAppointment } from "../../security/scoutingAppointments";
import { useAdminAuth } from "./AdminAuthProvider";

type Props = { children: ReactNode };

export default function ProtectedSiteSettingsRoute({ children }: Props) {
    const { adminProfile } = useAdminAuth();
    const canManageSettings = adminProfile?.role === "admin"
        || adminProfile?.role === "super-admin"
        || hasGroupFinanceAppointment(adminProfile?.appointments, adminProfile?.scoutingRole);

    if (!canManageSettings) return <Navigate to="/leader" replace />;
    return <>{children}</>;
}

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { hasGroupFinanceAppointment, hasGroupQuartermasterAppointment } from "../../security/scoutingAppointments";
import { useAdminAuth } from "./AdminAuthProvider";

type Props = { children: ReactNode };

export default function ProtectedSiteSettingsRoute({ children }: Props) {
    const { adminProfile } = useAdminAuth();
    const location = useLocation();
    const isQuartermasterSettings = new URLSearchParams(location.search).get("view") === "quartermaster";
    const canManageSettings = adminProfile?.role === "admin"
        || adminProfile?.role === "super-admin"
        || hasGroupFinanceAppointment(adminProfile?.appointments, adminProfile?.scoutingRole)
        || (isQuartermasterSettings && hasGroupQuartermasterAppointment(adminProfile?.appointments, adminProfile?.scoutingRole));

    if (!canManageSettings) return <Navigate to="/leader" replace />;
    return <>{children}</>;
}

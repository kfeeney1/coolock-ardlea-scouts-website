import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAdminAuth } from "./AdminAuthProvider";

type Props = { children: ReactNode };

export default function ProtectedSiteSettingsRoute({ children }: Props) {
    const { adminProfile } = useAdminAuth();
    const canManageSettings = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";

    if (!canManageSettings) return <Navigate to="/leader" replace />;
    return <>{children}</>;
}

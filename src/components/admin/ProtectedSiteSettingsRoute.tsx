import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { settingsRouteAllowed } from "../../security/settingsNavigationPolicy";
import { useAdminAuth } from "./AdminAuthProvider";

type Props = { children: ReactNode };

export default function ProtectedSiteSettingsRoute({ children }: Props) {
    const { adminProfile } = useAdminAuth();
    const location = useLocation();
    if (!settingsRouteAllowed(adminProfile, location.search)) return <Navigate to="/leader" replace />;
    return <>{children}</>;
}

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAdminAuth } from "./AdminAuthProvider";
import { canViewJoinManagement } from "../../security/joinManagementAccess";

type Props = { children: ReactNode };

export default function ProtectedJoinManagementRoute({ children }: Props) {
  const { adminProfile } = useAdminAuth();
  if (!canViewJoinManagement(adminProfile)) return <Navigate to="/leader" replace />;

  return <>{children}</>;
}

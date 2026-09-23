import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthProvider";

export default function ProtectedSuperAdminRoute({ children }: { children: ReactNode }) {
  const { adminProfile } = useAdminAuth();
  if (adminProfile?.role !== "super-admin") return <Navigate to="/leader" replace />;
  return <>{children}</>;
}

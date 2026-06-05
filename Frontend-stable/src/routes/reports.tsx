import { createFileRoute, Navigate } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Laporan — DeltaJalan" }] }),
});

function ReportsPage() {
  const user = getCurrentUser();
  if (user?.role === "supervisor") {
    return <Navigate to="/supervisor" replace />;
  }
  return <Navigate to="/my-reports" replace />;
}

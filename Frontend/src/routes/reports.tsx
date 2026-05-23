import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Laporan — JalanKita" }] }),
});

function ReportsPage() {
  return <Navigate to="/my-reports" replace />;
}

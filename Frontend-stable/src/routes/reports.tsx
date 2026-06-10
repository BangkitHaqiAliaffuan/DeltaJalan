import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Laporan — DeltaJalan" }] }),
});

function ReportsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = getCurrentUser();
    if (user?.role === "supervisor") {
      navigate({ to: "/supervisor", replace: true });
    } else {
      navigate({ to: "/my-reports", replace: true });
    }
  }, [navigate]);

  return null;
}

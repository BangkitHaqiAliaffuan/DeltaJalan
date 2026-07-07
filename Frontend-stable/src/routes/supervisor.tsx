import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/supervisor")({
  component: SupervisorLayout,
});

function SupervisorLayout() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== "supervisor") {
      navigate({ to: "/masuk" });
    }
  }, [user, navigate]);

  return <Outlet />;
}

import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/warga")({
  component: WargaLayout,
});

function WargaLayout() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== "warga") {
      navigate({ to: "/masuk" });
    }
  }, [user, navigate]);

  return <Outlet />;
}

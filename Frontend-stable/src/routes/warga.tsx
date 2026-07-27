import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/warga")({
  component: WargaLayout,
});

function WargaLayout() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.role !== "warga") {
      navigate({ to: "/masuk" });
    }
  }, [user, navigate]);

  return <Outlet />;
}

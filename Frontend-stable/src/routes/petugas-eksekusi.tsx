import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/petugas-eksekusi")({
  component: () => {
    const navigate = useNavigate();
    useEffect(() => { navigate({ to: "/tugas-saya", replace: true }); }, []);
    return null;
  },
});

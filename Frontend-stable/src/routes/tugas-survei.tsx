import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/tugas-survei")({
  component: () => {
    const navigate = useNavigate();
    useEffect(() => {
      navigate({ to: "/tugas-saya", replace: true });
    }, []);
    return null;
  },
});

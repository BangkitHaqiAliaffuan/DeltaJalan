import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/detail-survei")({
  component: DetailSurveiRedirect,
  validateSearch: (search: Record<string, unknown>) => {
    const taskId = search.taskId as string | undefined;
    return { ...(taskId ? { taskId } : {}) };
  },
  head: () => ({ meta: [{ title: "Detail Patroli — DeltaJalan" }] }),
});

function DetailSurveiRedirect() {
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    navigate({
      to: "/detail-patroli",
      search: taskId ? { taskId } : {},
      replace: true,
    });
  }, [navigate, taskId]);

  return null;
}

export default DetailSurveiRedirect;

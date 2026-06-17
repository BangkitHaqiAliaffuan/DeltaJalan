import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/review")({
  validateSearch: (search: Record<string, unknown>) => {
    const reportId = search.reportId as string | undefined;
    return { ...(reportId ? { reportId } : {}) };
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/detail-report", search });
  },
});

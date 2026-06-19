import type { Router } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

let _router: Router<any, any, any> | null = null;

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
  });

  _router = router as any;
  return router;
};

export function navigate(to: string, search?: Record<string, unknown>) {
  _router?.navigate({ to, search } as any);
}

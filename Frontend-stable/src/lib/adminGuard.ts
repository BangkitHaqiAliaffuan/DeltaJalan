import { redirect } from "@tanstack/react-router";
import { isLoggedIn, getCurrentUser, clearAuth } from "./auth";

export function requireAdmin() {
  if (!isLoggedIn()) {
    throw redirect({ to: "/admin/login" });
  }
  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    clearAuth();
    throw redirect({ to: "/admin/login" });
  }
}

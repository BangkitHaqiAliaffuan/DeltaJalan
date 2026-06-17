import { redirect } from "@tanstack/react-router";
import { isLoggedIn, getCurrentUser, clearAuth } from "./auth";

const ADMIN_ROLES = ["admin", "supervisor"];

export function requireAdmin() {
  if (typeof window === "undefined") return;
  if (!isLoggedIn()) {
    throw redirect({ to: "/admin/login" });
  }
  const user = getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    clearAuth();
    throw redirect({ to: "/admin/login" });
  }
}

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

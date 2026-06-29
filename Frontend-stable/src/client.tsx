import { setupNativeFetch } from "@/lib/api";
setupNativeFetch();

import "./styles.css";

import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { useFcmRegistration } from "@/hooks/useFcmRegistration";
import { useWorkerTracking } from "@/hooks/useWorkerTracking";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#F1F5F9",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <h1
              style={{ fontSize: "20px", fontWeight: 600, color: "#1E293B", marginBottom: "8px" }}
            >
              Aplikasi gagal dimuat
            </h1>
            <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "16px" }}>
              Terjadi kesalahan saat memuat aplikasi. Silakan restart aplikasi.
            </p>
            <pre
              style={{
                fontSize: "11px",
                color: "#DC2626",
                background: "#FEF2F2",
                padding: "12px",
                borderRadius: "8px",
                textAlign: "left",
                maxHeight: "200px",
                overflow: "auto",
                wordBreak: "break-all",
              }}
            >
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInit() {
  useFcmRegistration();
  useWorkerTracking();
  return null;
}

const router = getRouter();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element not found. App cannot mount.");

createRoot(rootEl).render(
  <ErrorBoundary>
    <AppInit />
    <RouterProvider router={router} />
  </ErrorBoundary>,
);

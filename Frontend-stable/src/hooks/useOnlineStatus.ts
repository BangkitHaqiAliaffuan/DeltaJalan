import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";

const PING_INTERVAL_MS = 60_000;

async function pingServer(): Promise<boolean> {
  try {
    const res = await apiFetch("/api/ping", { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    const on = () => {
      setOnline(true);
      pingServer().then((ok) => {
        if (mounted) setOnline(ok);
      });
    };
    const off = () => setOnline(false);

    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    pingRef.current = setInterval(() => {
      if (document.hidden) return;
      pingServer().then((ok) => {
        if (mounted) setOnline(ok);
      });
    }, PING_INTERVAL_MS);

    return () => {
      mounted = false;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  return online;
}

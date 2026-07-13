import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";

function base64UrlToUint8Array(base64Url: string): BufferSource {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function ensureSw(): Promise<ServiceWorkerRegistration | null> {
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw.js", { type: "module" });
  } catch {
    return null;
  }
}

async function doSubscribe(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/push/vapid-key`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      return false;
    }
    const json = await res.json();
    const publicKey = base64UrlToUint8Array(json.data.public_key);

    const reg = await ensureSw();
    if (!reg) return false;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    });

    const subJson = sub.toJSON();
    const saveRes = await fetch(`${API_BASE_URL}/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        p256dh_key: subJson.keys!.p256dh,
        auth_key: subJson.keys!.auth,
      }),
    });
    return saveRes.ok;
  } catch {
    return false;
  }
}

async function doUnsubscribe(): Promise<boolean> {
  try {
    const reg = await ensureSw();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const res = await fetch(`${API_BASE_URL}/push/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ endpoint }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function PushSubscriptionManager() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!("Notification" in window && "serviceWorker" in navigator && "PushManager" in window)) {
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);

    ensureSw()
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, []);

  // Auto-request permission & subscribe on mount if not yet decided
  useEffect(() => {
    if (!supported) return;
    if (!getToken()) return;

    const trySubscribe = async () => {
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") return;
      } else if (Notification.permission !== "granted") {
        return;
      }
      const ok = await doSubscribe();
      if (ok) setSubscribed(true);
    };

    trySubscribe();
  }, [supported]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubscribe() {
    setLoading(true);
    setError("");
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") {
      setLoading(false);
      return;
    }
    const ok = await doSubscribe();
    if (ok) {
      setSubscribed(true);
    } else {
      setError("Gagal mengaktifkan — silakan coba lagi");
    }
    setLoading(false);
  }

  async function handleUnsubscribe() {
    setLoading(true);
    setError("");
    const ok = await doUnsubscribe();
    if (ok) {
      setSubscribed(false);
    } else {
      setError("Gagal menonaktifkan — silakan coba lagi");
    }
    setLoading(false);
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {permission === "denied" ? (
          <span className="text-[11px] text-on-surface-variant">Notifikasi diblokir</span>
        ) : subscribed ? (
          <button
            type="button"
            onClick={handleUnsubscribe}
            disabled={loading}
            className="text-[11px] text-primary font-medium hover:underline disabled:opacity-50"
          >
            {loading ? "Proses..." : "Nonaktifkan notifikasi push"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={loading}
            className="text-[11px] text-primary font-medium hover:underline disabled:opacity-50"
          >
            {loading ? "Proses..." : "Aktifkan notifikasi push"}
          </button>
        )}
      </div>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

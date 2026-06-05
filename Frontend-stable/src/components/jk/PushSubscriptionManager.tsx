import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";

function base64UrlToUint8Array(base64Url: string): BufferSource {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function doSubscribe(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/push/vapid-key`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const json = await res.json();
    const publicKey = base64UrlToUint8Array(json.data.public_key);

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    });

    const subJson = sub.toJSON();
    await fetch(`${API_BASE_URL}/push/subscribe`, {
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

    return true;
  } catch {
    return false;
  }
}

async function doUnsubscribe(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch(`${API_BASE_URL}/push/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // silent
  }
}

export function PushSubscriptionManager() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window && "serviceWorker" in navigator && "PushManager" in window)) {
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, []);

  // Auto-request permission & subscribe on mount if not yet decided
  useEffect(() => {
    if (!supported) return;
    if (Notification.permission !== "default") return;
    if (!getToken()) return;

    Notification.requestPermission().then((perm) => {
      setPermission(perm);
      if (perm === "granted") {
        doSubscribe().then((ok) => {
          if (ok) setSubscribed(true);
        });
      }
    });
  }, [supported]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubscribe() {
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return;
    const ok = await doSubscribe();
    if (ok) setSubscribed(true);
  }

  async function handleUnsubscribe() {
    await doUnsubscribe();
    setSubscribed(false);
  }

  if (!supported) return null;

  return (
    <div className="flex items-center gap-2">
      {permission === "denied" ? (
        <span className="text-[11px] text-on-surface-variant">
          Notifikasi diblokir — atur ulang di pengaturan browser
        </span>
      ) : subscribed ? (
        <button
          type="button"
          onClick={handleUnsubscribe}
          className="text-[11px] text-primary font-medium hover:underline"
        >
          Nonaktifkan notifikasi push
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubscribe}
          className="text-[11px] text-primary font-medium hover:underline"
        >
          Aktifkan notifikasi push
        </button>
      )}
    </div>
  );
}

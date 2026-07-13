import { useEffect, useRef } from "react";
import { getToken } from "@/lib/auth";
import { navigate } from "@/router";

const isNative =
  typeof window !== "undefined" &&
  (window as any).Capacitor !== undefined &&
  (window as any).Capacitor.isNativePlatform?.() === true;

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "http://10.0.2.2:8080/api").replace(
  /\/+$/,
  "",
);

async function sendTokenToBackend(fcmToken: string): Promise<boolean> {
  const authToken = getToken();
  if (!authToken) {
    return false;
  }

  try {
    const res = await fetch(`${apiBase}/push/fcm-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ fcm_token: fcmToken, device_info: { platform: "android" } }),
    });
    if (!res.ok) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function removeTokenFromBackend(fcmToken: string) {
  const authToken = getToken();
  if (!authToken) return;

  try {
    await fetch(`${apiBase}/push/fcm-token`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ fcm_token: fcmToken }),
    });
  } catch {}
}

export function useFcmRegistration() {
  const fcmTokenRef = useRef<string | null>(null);
  const tokenStoredRef = useRef(false);

  useEffect(() => {
    if (!isNative) return;

    let removeListeners: (() => void) | null = null;

    async function init() {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        await PushNotifications.createChannel({
          id: "delta_jalan_general",
          name: "DeltaJalan",
          description: "Notifikasi laporan dan tugas DeltaJalan",
          importance: 4,
          visibility: 1,
          sound: "default",
          vibration: true,
          lights: true,
        }).catch(() => {});

        await PushNotifications.addListener("registration", async (token) => {
          fcmTokenRef.current = token.value;
          const ok = await sendTokenToBackend(token.value);
          if (ok) tokenStoredRef.current = true;
        });

        await PushNotifications.addListener("registrationError", (err) => {});

        await PushNotifications.addListener("pushNotificationReceived", (notification) => {});

        await PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
          const reportId = notification.notification.data?.report_id as string | undefined;
          if (reportId) {
            navigate("/detail-report", { reportId });
          }
        });

        removeListeners = () => {
          PushNotifications.removeAllListeners();
        };

        const permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          const result = await PushNotifications.requestPermissions();
          if (result.receive !== "granted") return;
        } else if (permStatus.receive !== "granted") {
          return;
        }

        await PushNotifications.register();
      } catch (err) {}
    }

    init();

    return () => {
      removeListeners?.();
    };
  }, []);

  useEffect(() => {
    if (!isNative) return;

    const handleLogin = () => {
      const token = fcmTokenRef.current;
      if (token && !tokenStoredRef.current) {
        sendTokenToBackend(token).then((ok) => {
          if (ok) tokenStoredRef.current = true;
        });
      }
    };

    const handleLogout = () => {
      tokenStoredRef.current = false;
      const token = fcmTokenRef.current;
      if (token) {
        removeTokenFromBackend(token);
      }
    };

    window.addEventListener("auth:login", handleLogin);
    window.addEventListener("auth:logout", handleLogout);
    return () => {
      window.removeEventListener("auth:login", handleLogin);
      window.removeEventListener("auth:logout", handleLogout);
    };
  }, []);
}

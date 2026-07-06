/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST ?? []);

const OLD_CACHE_PATTERNS = [
  /^api-v1$/,
  /^images-v1$/,
  /^static-v1$/,
  /^cdn-v1$/,
];

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => OLD_CACHE_PATTERNS.some((p) => p.test(key)))
          .map((key) => caches.delete(key)),
      );
    }).then(() => self.clients.claim()),
  );
});

registerRoute(
  /^\/api\//,
  new NetworkFirst({
    cacheName: "api-v2",
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 })],
    networkTimeoutSeconds: 5,
  }),
);

registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
  new NetworkFirst({
    cacheName: "images-v2",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 2592000 })],
  }),
);

registerRoute(
  /\.(?:js|css|woff2?|ttf|eot)$/,
  new StaleWhileRevalidate({
    cacheName: "static-v2",
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 2592000 })],
  }),
);

registerRoute(
  /(?:tile\.openstreetmap|unpkg|cdn\.jsdelivr|fonts\.(?:googleapis|gstaticache))\./,
  new StaleWhileRevalidate({
    cacheName: "cdn-v2",
    plugins: [new ExpirationPlugin({ maxEntries: 200 })],
  }),
);

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? "Notifikasi Baru";
  const options: NotificationOptions = {
    body: data.body ?? data.message ?? "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: { url: data.url ?? "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(clients.openWindow(url));
});

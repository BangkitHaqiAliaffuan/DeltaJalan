# Skip List — Notifikasi & PWA

Fitur yang belum diimplementasi, untuk dikerjakan nanti.

## 1. Progressive Web App (PWA)

- `vite-plugin-pwa` — belum diinstall/dikonfigurasi
- `public/icons/` — icon 192x192 & 512x512 untuk manifest
- Manifest `theme-color`, `display: standalone`
- Meta PWA di `__root.tsx` (`apple-mobile-web-app-capable`, dll)
- Service Worker precaching (offline support)

## 2. Push Notification (WebPush)

- `composer require minishlink/web-push`
- Migration `push_subscriptions` table
- Model `PushSubscription`
- `WebPushService` class
- `PushSubscriptionController` (subscribe/unsubscribe)
- VAPID keys generation + config (`.env`)
- Service Worker push handler (`self.addEventListener('push')`)
- SW `notificationclick` handler (deep link ke laporan)
- Frontend push subscription (`Notification.requestPermission` + `pushManager.subscribe`)
- Integrasi `report_edited`, `triage_updated`, `report_reopened` events

## 3. Event Tambahan

- `Diedit` → supervisor
- `Triage updated` → supervisor
- `Reopen` → petugas_eksekusi
- `Bulk` approve/tolak → petugas
- Notif ke petugas spesifik saat laporan **diedit** atau **dibatalkan editnya**

## 4. Penyempurnaan UI

- Animasi transisi dropdown notifikasi
- Sonner toast saat notif baru datang (dari polling)
- Pagination/infinite scroll di dropdown notifikasi (saat >10 notif)
- Halaman "Semua Notifikasi" terpisah
- Filter notifikasi (by type / by date)
- Sound effect saat notif baru
- "Lihat Semua" link di footer dropdown
- Notif grouping (misal: "3 laporan baru dari Kec. Taman")

## 5. Backend Opt-in

- Fitur notifikasi hanya untuk role tertentu (toggle notif per event per user)
- Mark as read via swipe (mobile)
- Batas waktu notifikasi (TTL/expiry)
- Notifikasi untuk user yang offline (queue retry push)

## 6. Observability

- Log pengiriman notifikasi gagal (push subscription expired)
- Cleanup subscriptions invalid (410 Gone)
- Stats: notifikasi terkirim vs gagal

/* Wohnungs-Tool Service-Worker V5.0
 * Workbox-CDN basiert.
 * - Precache: index.html, manifest, icons
 * - Network-first fuer /api/*  (Backend-Bridge, Tailscale)
 * - Stale-while-revalidate fuer Tailwind/Fonts-CDN (read-only)
 *
 * Cache-Version bei Code-Aenderung erhoehen.
 */
const SW_VERSION = "v5.0.1";

importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js");

if (workbox) {
  workbox.setConfig({ debug: false });

  // Precache (manuell, weil wir keinen Build-Step haben)
  workbox.precaching.precacheAndRoute([
    { url: "./", revision: SW_VERSION },
    { url: "./index.html", revision: SW_VERSION },
    { url: "./manifest.webmanifest", revision: SW_VERSION },
    { url: "./icons/icon-192.png", revision: SW_VERSION },
    { url: "./icons/icon-512.png", revision: SW_VERSION },
    { url: "./icons/icon-512-maskable.png", revision: SW_VERSION },
    { url: "./icons/apple-touch-icon.png", revision: SW_VERSION }
  ]);

  // Network-first fuer /api/*  (Backend-Bridge auf Tailscale / lokalem Mac-Mini)
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/feedback"),
    new workbox.strategies.NetworkFirst({
      cacheName: "wohnungs-api-" + SW_VERSION,
      networkTimeoutSeconds: 4,
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 })
      ]
    })
  );

  // Tailwind / Fonts: stale-while-revalidate
  workbox.routing.registerRoute(
    ({ url }) =>
      url.origin === "https://cdn.tailwindcss.com" ||
      url.origin === "https://fonts.googleapis.com" ||
      url.origin === "https://fonts.gstatic.com",
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "wohnungs-cdn-" + SW_VERSION
    })
  );

  // Fallback: documents -> network-first mit Offline-Stub auf index.html
  workbox.routing.setDefaultHandler(
    new workbox.strategies.NetworkFirst({
      cacheName: "wohnungs-default-" + SW_VERSION,
      networkTimeoutSeconds: 4
    })
  );
} else {
  // Workbox-CDN nicht erreichbar: minimaler Offline-Cache
  self.addEventListener("install", (e) => {
    e.waitUntil(
      caches.open("wohnungs-fallback-" + SW_VERSION).then((c) =>
        c.addAll([
          "./",
          "./index.html",
          "./manifest.webmanifest",
          "./icons/icon-192.png",
          "./icons/icon-512.png",
          "./icons/apple-touch-icon.png"
        ])
      )
    );
    self.skipWaiting();
  });
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
  self.addEventListener("fetch", (e) => {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
    );
  });
}

// Wartet nicht auf Tab-Close
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

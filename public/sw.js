const CACHE = "spent-cost-v3";
const SHELL = ["/", "/plans", "/calendar"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for everything this worker handles: a stale balance is worse
// than no offline support, so the cache is only ever a fallback for when the
// network genuinely fails, never a shortcut around it.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/"))),
  );
});

// Morning reminders from supabase/functions/push-reminders: { title, body, url }.
self.addEventListener("push", (event) => {
  const { title = "Spent/Cost", body = "", url = "/" } = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url } }),
  );
});

// Tapping it opens the app — the window already open if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === location.origin);
      return open ? open.focus().then((w) => w.navigate(url)) : self.clients.openWindow(url);
    }),
  );
});

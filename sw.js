// Network-first: always try for the latest version, fall back to cache when offline.
// Pages and config are re-checked with the server on every load ("no-cache"), so a new
// upload shows up on the next open instead of waiting for GitHub's 10-minute cache.
const CACHE = "odo-v7";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // never touch Supabase/Stripe calls
  // hashed files in /assets/ never change, so the normal cache is fine; everything else gets re-checked
  // (navigation requests can't be copied with new options, so fetch them by URL)
  const go = url.pathname.includes("/assets/") ? fetch(req)
    : req.mode === "navigate" ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" })
    : fetch(req, { cache: "no-cache" });
  e.respondWith(
    go
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
  );
});

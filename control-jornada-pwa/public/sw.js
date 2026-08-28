const CACHE_NAME = "control-jornada-v11";
const BASE = "/control-jornada/";

const APP_SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});


self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});


self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(

    fetch(event.request)
      .then(response => {

        if (
          response &&
          response.status === 200
        ) {

          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, copy);
            });

        }

        return response;

      })

      .catch(() => {

        return caches.match(event.request)
          .then(cached => {

            if (cached) {
              return cached;
            }

            if (event.request.mode === "navigate") {
              return caches.match(
                BASE + "index.html"
              );
            }

            return new Response(
              "Offline",
              {
                status: 503,
                statusText: "Offline"
              }
            );

          });

      })

  );

});

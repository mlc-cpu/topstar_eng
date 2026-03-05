function escapeJson(value) {
  return String(value ?? "").replace(/\"/g, '\\"');
}

export function renderManifest({ pageTitle }) {
  const title = escapeJson(pageTitle || "TopStar 영어학원 숙제 체크리스트");
  const shortName = "TopStar 숙제";

  return JSON.stringify(
    {
      name: title,
      short_name: shortName,
      description: "TopStar 영어학원 숙제 체크리스트 웹앱",
      start_url: "./",
      scope: "./",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0b1526",
      theme_color: "#0f172a",
      lang: "ko",
      icons: [
        {
          src: "./icon.png",
          sizes: "1280x1280",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: "./icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any",
        },
      ],
    },
    null,
    2
  );
}

export function renderServiceWorker() {
  return `const CACHE_NAME = "topstar-eng-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.png",
  "./icon.svg",
  "./homework.json",
  "./short-url.txt"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin) {
    return;
  }

  const isHomeworkJson = url.pathname.endsWith("/homework.json") || url.pathname.endsWith("homework.json");
  if (isHomeworkJson) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", cloned));
          return response;
        })
        .catch(async () => (await caches.match("./index.html")) || (await caches.match(request)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
`;
}

export function renderIconSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#143b66"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="104" fill="url(#g)"/>
  <circle cx="256" cy="256" r="164" fill="#1f7aff" fill-opacity="0.2"/>
  <text x="256" y="292" text-anchor="middle" font-family="Pretendard, Noto Sans KR, sans-serif" font-size="148" font-weight="700" fill="#f8fbff">TS</text>
</svg>
`;
}

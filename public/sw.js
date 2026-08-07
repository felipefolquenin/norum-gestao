// Service worker mínimo — habilita a instalação do app e serve a casca offline.
// Os dados sempre vêm do Supabase pela rede (nunca são cacheados).
const CACHE = "norum-v1";
const ESSENCIAIS = ["/", "/index.html", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Nunca intercepta chamadas ao banco/API — dados são sempre atuais
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;
  // Estratégia: rede primeiro, cache como reserva (evita servir versão velha)
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/index.html")))
  );
});

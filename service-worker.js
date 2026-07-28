const CACHE_NAME="vb-inventory-0.1.0-alpha.4-20260728-VB04";
const LOCAL=[
  "./","./index.html","./manifest.json","./css/style.css",
  "./js/config.js","./js/storage.js","./js/scanner.js","./js/updates.js","./js/app.js",
  "./icons/icon.svg","./icons/icon-192.png","./icons/icon-512.png",
  "./icons/apple-touch-icon.png","./icons/favicon-32.png"
];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(LOCAL)));
});
self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(
    fetch(event.request)
      .then(response=>{
        if(response.ok&&new URL(event.request.url).origin===location.origin){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
        }
        return response;
      })
      .catch(()=>caches.match(event.request).then(response=>response||caches.match("./index.html")))
  );
});
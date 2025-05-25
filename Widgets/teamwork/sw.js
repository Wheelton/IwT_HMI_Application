const CW_NAME = encodeURI(self.location.pathname.split('/').reverse()[1]);

const CACHE = CW_NAME + '-v1';
const RES_CACHE = "CWResources" + '-v1';

const PRECACHE_URLS = [
  './index.html',
  './' + CW_NAME + '.wjson',
  '../resources/libs/bootstrap_5_0_2/dist/css/bootstrap.min.css',
  './build/build.min.css',
  '../resources/libs/jquery_3_6_1/dist/jquery.min.js',
  '../resources/libs/bootstrap_5_0_2/dist/js/bootstrap.min.js',
  '../resources/libs/eventemitter_5_1_0/eventEmitter.js',
  '../resources/apis/proxy.js',
  '../resources/apis/MASvrHelper.js',
  './build/build.min.js',
];

// Set all relative paths that can have their files cached.
// NOTE: The paths are relative to / part of the URL.
const PATHS_TO_CACHE = [
  '../resources/',
  '/apis/resources/',
  '/widgets/resources/'
];

let cacheMap = [];
let cacheNms = [];
let resUrl = [];
let fUrl = [];
for (var url of PRECACHE_URLS) {
  var isRes = false;
  for (var path of PATHS_TO_CACHE) {
    if (url && path && url.toLowerCase().includes(path.toLowerCase())) {
      isRes = true;
      break;
    }
  }
  if (isRes && url) resUrl.push(url);
    else if (url) fUrl.push(url);
}
if (fUrl.length > 0) {
  cacheMap.push({ 'name': CACHE, 'url': fUrl });
  cacheNms.push(CACHE);
}
if (resUrl.length > 0) {
  cacheMap.push({ 'name': RES_CACHE, 'url': resUrl });
  cacheNms.push(RES_CACHE);
}

self.addEventListener('install', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(cacheMap.map(function (appCache) {
      return caches.open(appCache.name).then(function (cache) {
        return cache.addAll(appCache.url);
      })
    })).then(function () {
      return this.skipWaiting();
    });
  }));
});

// Delete any cache that has the prefix as the custom widget name
// that does not match with the current cache version
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(cacheNames => {
      return cacheNames.filter(cache => {
        return cacheNms.indexOf(cache) < 0 && cache.indexOf(CW_NAME) !== -1;
      });
    })
    .then(cachesToDelete => {
      return Promise.all(
        cachesToDelete.map(cacheToDelete => caches.delete(cacheToDelete))
      );
    })
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  if (evt.request.cache === 'only-if-cached' && evt.request.mode !== 'same-origin') return;
  if (evt.request.method === "GET" && evt.request.url.startsWith(self.location.origin)) {
    var cacheName = CACHE;
    for (var path of PATHS_TO_CACHE) {
      if (path && evt.request.url.toLowerCase().includes(path.toLowerCase())) {
        cacheName = RES_CACHE;
        break;
      }
    }
    evt.respondWith(
      caches.match(evt.request, { cacheName: cacheName, ignoreSearch: true, ignoreVary: true })
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return caches.open(cacheName).then(cache => {
            return fetch(evt.request).then(response => {
              if (!response.ok) return response;
              // Check whether the request url contains one of the paths
              // that can have their files cached. If so, cache it.
              for (const path of PATHS_TO_CACHE) {
                if (path && evt.request.url.toLowerCase().includes(path)) {
                  return cache.put(evt.request, response.clone())
                    .then(() => response);
                }
              }

              return response;
            });
          });
        })
    );
  }
});
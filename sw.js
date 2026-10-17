var CACHE = 'ddt-v6';
var FILES = ['/', '/index.html'];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(FILES); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

// "Condividi verso l'app" (Web Share Target, vedi share_target nel manifest):
// le foto arrivano in POST su /share-target, vengono parcheggiate in IndexedDB
// (db 'ddt-share', store 'foto') e l'app le carica all'avvio con ?condiviso=1.
function apriDbCondivise() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open('ddt-share', 1);
    req.onupgradeneeded = function() { req.result.createObjectStore('foto', {autoIncrement: true}); };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
}

function salvaFotoCondivise(request) {
  return request.formData().then(function(fd) {
    var files = fd.getAll('foto').filter(function(f) { return f && typeof f !== 'string' && f.size > 0; });
    return apriDbCondivise().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction('foto', 'readwrite');
        var st = tx.objectStore('foto');
        files.forEach(function(f) { st.add({file: f, nome: f.name || '', ts: Date.now()}); });
        tx.oncomplete = function() { db.close(); resolve(); };
        tx.onerror = function() { db.close(); reject(tx.error); };
      });
    });
  }).catch(function() {}).then(function() {
    return Response.redirect('/?condiviso=1', 303);
  });
}

self.addEventListener('fetch', function(e) {
  if (e.request.method === 'POST' && new URL(e.request.url).pathname === '/share-target') {
    e.respondWith(salvaFotoCondivise(e.request));
    return;
  }
  e.respondWith(
    fetch(e.request, {cache: 'no-store'}).catch(function() {
      return caches.match(e.request);
    })
  );
});

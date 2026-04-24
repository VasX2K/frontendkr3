const CACHE='todo-pwa-v4';
const STATIC=['/','/index.html','/styles.css','/app.js','/manifest.json','/assets/icons/icon-192.png','/assets/icons/icon-512.png','/content/offline.html'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname.startsWith('/content/')){
    event.respondWith(fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }).catch(()=>caches.match(event.request).then(r=>r||caches.match('/content/offline.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(response=>response||fetch(event.request)));
});

self.addEventListener('push',event=>{
  let data={title:'Уведомление',body:'Новое уведомление',id:null};
  if(event.data){
    try{data=event.data.json()}catch(e){data.body=event.data.text()}
  }
  event.waitUntil(self.registration.showNotification(data.title||'Уведомление',{
    body:data.body||'',
    icon:'/assets/icons/icon-192.png',
    badge:'/assets/icons/icon-192.png',
    data:{id:data.id},
    actions:[{action:'snooze_5m',title:'Отложить на 5 минут'}]
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  if(event.action==='snooze_5m'&&event.notification.data&&event.notification.data.id){
    event.waitUntil(fetch('/api/reminders/snooze',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:event.notification.data.id})
    }));
    return;
  }
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if(client.url.includes(location.origin))return client.focus()}
    return clients.openWindow('/');
  }));
});

let tasks=JSON.parse(localStorage.getItem('tasks')||'[]');
let deferredPrompt=null;
const socket=io({reconnection:true});
const $=id=>document.getElementById(id);

function setPushStatus(text){$('pushStatus').textContent=text}

function saveLocal(){
  localStorage.setItem('tasks',JSON.stringify(tasks));
}

function sync(){
  saveLocal();
  render();
  socket.emit('tasks:update',tasks);
}

function render(){
  $('taskList').innerHTML='';
  tasks.forEach((task,index)=>{
    const li=document.createElement('li');
    if(task.done)li.className='done';
    const checkbox=document.createElement('input');
    checkbox.type='checkbox';
    checkbox.checked=task.done;
    const span=document.createElement('span');
    span.textContent=task.text;
    const del=document.createElement('button');
    del.textContent='Удалить';
    del.className='danger';
    checkbox.onchange=()=>{tasks[index].done=checkbox.checked;sync()};
    del.onclick=()=>{tasks.splice(index,1);sync()};
    li.append(checkbox,span,del);
    $('taskList').appendChild(li);
  });
  const done=tasks.filter(t=>t.done).length;
  $('stats').textContent=`Всего: ${tasks.length} Выполнено: ${done} Осталось: ${tasks.length-done}`;
}

$('taskForm').onsubmit=event=>{
  event.preventDefault();
  const text=$('taskInput').value.trim();
  if(!text)return;
  tasks.push({text,done:false});
  $('taskInput').value='';
  sync();
};

$('clearDone').onclick=()=>{
  tasks=tasks.filter(t=>!t.done);
  sync();
};

socket.on('tasks:sync',serverTasks=>{
  tasks=serverTasks;
  saveLocal();
  render();
});

function updateNetwork(){
  $('netStatus').textContent=navigator.onLine?'Онлайн':'Офлайн';
}
addEventListener('online',updateNetwork);
addEventListener('offline',updateNetwork);
updateNetwork();

addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredPrompt=event;
  $('installBtn').hidden=false;
});

$('installBtn').onclick=async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  $('installBtn').hidden=true;
};

async function registerSW(){
  if(!('serviceWorker' in navigator)){
    setPushStatus('Service Worker не поддерживается');
    return null;
  }
  return navigator.serviceWorker.register('/sw.js');
}

function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  const output=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)output[i]=raw.charCodeAt(i);
  return output;
}

async function subscribePush(){
  try{
    const reg=await registerSW();
    if(!reg)return;
    if(!('PushManager' in window)){
      setPushStatus('Push не поддерживается этим браузером');
      return;
    }
    const permission=await Notification.requestPermission();
    if(permission!=='granted'){
      setPushStatus('Разрешение на уведомления не выдано');
      return;
    }
    const key=await fetch('/api/push/vapid-public-key').then(r=>r.text());
    const sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(key)
    });
    await fetch('/api/push/subscribe',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(sub)
    });
    setPushStatus('Уведомления включены');
  }catch(e){
    setPushStatus('Ошибка подписки: '+e.message);
  }
}

$('subscribeBtn').onclick=subscribePush;

$('pushBtn').onclick=async()=>{
  await subscribePush();
  const r=await fetch('/api/push/test',{method:'POST'});
  const data=await r.json();
  setPushStatus(data.ok?'Тестовое уведомление отправлено':data.error||'Ошибка отправки');
};

$('reminderForm').onsubmit=async event=>{
  event.preventDefault();
  await subscribePush();
  const delaySeconds=Number($('delayInput').value||10);
  const r=await fetch('/api/reminders/schedule',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({title:'Напоминание',body:`Прошло ${delaySeconds} сек.`,delaySeconds})
  });
  const data=await r.json();
  setPushStatus(data.ok?`Напоминание запланировано на ${delaySeconds} сек.`:data.error||'Ошибка планирования');
};

document.querySelectorAll('.preset').forEach(btn=>{
  btn.onclick=()=>{$('delayInput').value=btn.dataset.sec};
});

$('loadMain').onclick=async()=>{
  const html=await fetch('/content/main.html').then(r=>r.text()).catch(()=>'<p>Контент недоступен</p>');
  $('contentBox').innerHTML=html;
};

const quotes=['Сделай маленький шаг сейчас.','Лучшее время — сегодня.','Задача проще, когда она записана.','Не идеально, зато работает.'];
$('quote').textContent=quotes[Math.floor(Math.random()*quotes.length)];

registerSW();
render();

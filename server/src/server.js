require('dotenv').config();
const http=require('http');
const path=require('path');
const express=require('express');
const webpush=require('web-push');
const {Server}=require('socket.io');

const app=express();
const PORT=process.env.PORT||3443;
const root=path.join(__dirname,'../..');

let subscription=null;
let reminders=new Map();

let publicKey=process.env.VAPID_PUBLIC_KEY;
let privateKey=process.env.VAPID_PRIVATE_KEY;
let subject=process.env.VAPID_SUBJECT||'mailto:test@example.com';

if(!publicKey||!privateKey){
  const keys=webpush.generateVAPIDKeys();
  publicKey=keys.publicKey;
  privateKey=keys.privateKey;
  console.log('Временные VAPID ключи созданы автоматически');
}

webpush.setVapidDetails(subject,publicKey,privateKey);

app.use(express.json());
app.use(express.static(root));

app.get('/api/push/vapid-public-key',(req,res)=>{
  res.type('text/plain').send(publicKey);
});

app.post('/api/push/subscribe',(req,res)=>{
  subscription=req.body;
  res.json({ok:true});
});

async function sendPush(payload){
  if(!subscription)throw new Error('Нет push-подписки');
  await webpush.sendNotification(subscription,JSON.stringify(payload));
}

app.post('/api/push/test',async(req,res)=>{
  try{
    await sendPush({title:'Тестовое уведомление',body:'Push работает'});
    res.json({ok:true});
  }catch(e){
    res.json({ok:false,error:e.message});
  }
});

function planReminder(reminder){
  if(reminder.timer)clearTimeout(reminder.timer);
  const delay=Math.max(0,reminder.fireAt-Date.now());
  reminder.timer=setTimeout(async()=>{
    try{
      await sendPush({id:reminder.id,title:reminder.title,body:reminder.body});
    }catch(e){
      console.log(e.message);
    }
  },delay);
  reminders.set(reminder.id,reminder);
}

app.post('/api/reminders/schedule',(req,res)=>{
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2);
  const delaySeconds=Math.max(1,Number(req.body.delaySeconds||10));
  const reminder={
    id,
    title:req.body.title||'Напоминание',
    body:req.body.body||'Запланированное уведомление',
    fireAt:Date.now()+delaySeconds*1000,
    timer:null
  };
  planReminder(reminder);
  res.json({ok:true,id});
});

app.post('/api/reminders/snooze',(req,res)=>{
  const reminder=reminders.get(req.body.id);
  if(!reminder){
    res.json({ok:false,error:'Напоминание не найдено'});
    return;
  }
  reminder.fireAt=Date.now()+5*60*1000;
  reminder.body='Отложенное напоминание';
  planReminder(reminder);
  res.json({ok:true});
});

const server=http.createServer(app);
const io=new Server(server);

io.on('connection',socket=>{
  socket.on('tasks:update',tasks=>{
    socket.broadcast.emit('tasks:sync',tasks);
  });
});

server.listen(PORT,()=>{
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});

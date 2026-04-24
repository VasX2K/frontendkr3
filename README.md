# PWA Список задач

## Запуск

```bash
cd server
npm install
npm run dev
```

Открыть:

```text
http://localhost:3443
```

## Push

Для локальной проверки ключи можно не создавать. Сервер создаст временные VAPID-ключи сам.

Для постоянных ключей:

```bash
cd server
npm run vapid
```

Заполнить `server/.env` по примеру `server/.env.example`.

## Реализовано

- PWA manifest
- Service Worker
- офлайн App Shell
- localStorage
- статус онлайн/офлайн
- установка PWA
- Socket.IO синхронизация вкладок
- Web Push
- тестовые push-уведомления
- отложенные уведомления
- snooze на 5 минут
- `.gitignore`

## Ограничения

- подписка хранится в памяти сервера
- напоминания хранятся в памяти сервера
- после перезапуска сервера напоминания теряются
- локально используется `http://localhost`, для production нужен HTTPS

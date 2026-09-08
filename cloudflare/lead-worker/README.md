# Заявки photoprobiz → Telegram

Отдельный Cloudflare Worker для заявок с сайта делового фотографа. Пока Telegram не подключён, Worker существует как безопасная заготовка: `/health` отвечает успешно, а `/lead` возвращает `503` и не имитирует отправку заявки.

## Текущие адреса сайта

- GitHub Pages: `https://kuznetsovphotographer-prog.github.io/photoprobiz/`
- Будущий основной домен: `https://photoprobiz.ru/`
- Worker: `https://photoprobiz-lead-form.kuznetsovphotographer.workers.dev/`
- Проверка состояния: `https://photoprobiz-lead-form.kuznetsovphotographer.workers.dev/health`

В CORS используется origin без пути `/photoprobiz/`, поскольку браузер передаёт только схему и имя хоста.

## Проверка и публикация

```powershell
npm.cmd install
npm.cmd run types
npm.cmd run check
npm.cmd run deploy:dry
npx.cmd wrangler login
npm.cmd run deploy
```

Для текущего развёртывания API-токен Wrangler хранится вне репозитория в `%LOCALAPPDATA%\photoprobiz\cloudflare-api-token.txt`. Перед повторной публикацией загрузите его только в переменную текущего процесса PowerShell:

```powershell
$env:CLOUDFLARE_API_TOKEN = Get-Content "$env:LOCALAPPDATA\photoprobiz\cloudflare-api-token.txt" -Raw
npm.cmd run deploy
Remove-Item Env:CLOUDFLARE_API_TOKEN
```

После создания Telegram-бота код будет дополнен реальной доставкой. Токен и ID чата нужно сохранить только в Cloudflare Secrets:

```powershell
npx.cmd wrangler secret put TELEGRAM_BOT_TOKEN
npx.cmd wrangler secret put TELEGRAM_CHAT_ID
```

Не добавляйте значения секретов в `wrangler.jsonc`, `.env`, GitHub или переписку.

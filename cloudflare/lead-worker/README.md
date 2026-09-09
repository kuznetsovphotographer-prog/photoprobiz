# Заявки photoprobiz → Telegram

Отдельный Cloudflare Worker для заявок с сайта делового фотографа. Он принимает валидную заявку с разрешённых доменов и отправляет её в Telegram. Секреты Telegram хранятся только в Cloudflare Worker Secrets.

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

Worker уже использует Telegram для доставки заявок. При замене бота или чата обновите соответствующие Cloudflare Secrets:

```powershell
npx.cmd wrangler secret put TELEGRAM_BOT_TOKEN
npx.cmd wrangler secret put TELEGRAM_CHAT_ID
```

Не добавляйте значения секретов в `wrangler.jsonc`, `.env`, GitHub или переписку.

## Формат заявки

`POST /lead` принимает JSON с именем, способом связи, контактом, согласием на обработку данных и источником формы. Неверный JSON, неполные данные и запросы с постороннего origin отклоняются.

# Обезличенные уведомления photoprobiz → Telegram

Worker принимает только серверное уведомление от Yandex Cloud Function после успешной записи заявки в YDB. В запросе разрешены четыре поля: `event`, `site`, `submissionId`, `serverReceivedAt`. Имя, телефон, способ связи и сведения о согласии Worker не принимает и в Telegram не отправляет.

Публичный адрес: `https://api.photoprobiz.ru`; проверка состояния: `https://api.photoprobiz.ru/health`.

## Секреты

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `RELAY_TOKEN` — общий случайный секрет Worker и Yandex Cloud Function

Секреты задаются через `wrangler secret put` и не добавляются в `wrangler.jsonc`, Git или документацию.

```powershell
$env:CLOUDFLARE_API_TOKEN = Get-Content "$env:LOCALAPPDATA\photoprobiz\cloudflare-api-token.txt" -Raw
Get-Content "$env:LOCALAPPDATA\photoprobiz\yandex-relay-token.txt" -Raw | npx.cmd wrangler secret put RELAY_TOKEN
npm.cmd run check
npm.cmd run deploy
Remove-Item Env:CLOUDFLARE_API_TOKEN
```

POST `/lead` требует разрешённый `Origin` и заголовок `X-Relay-Token`. Запросы с дополнительными полями отклоняются, поэтому персональные данные нельзя случайно переслать через этот маршрут.

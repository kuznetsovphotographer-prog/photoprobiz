# Обезличенные уведомления photoprobiz → Telegram

Worker принимает только серверное уведомление от Yandex Cloud Function после успешной записи заявки в YDB. В запросе разрешены четыре поля: `event`, `site`, `submissionId`, `serverReceivedAt`. `site` может быть любым подключённым и уже проверенным функцией доменом. Имя, телефон, способ связи, заметки и сведения о согласии Worker не принимает и в Telegram не отправляет.

Публичный адрес: `https://api.photoprobiz.ru`; проверка состояния: `https://api.photoprobiz.ru/health`.

## Секреты

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `RELAY_TOKEN` — общий случайный секрет Worker и Yandex Cloud Function

Несекретная переменная `ADMIN_BASE_URL` задаётся в `wrangler.jsonc`. Worker добавляет к ней `?admin=1&lead=<submissionId>` и прикрепляет к уведомлению Telegram кнопку `Открыть заявку`. Кабинет запрашивает персональные данные напрямую у Yandex Cloud Function только после входа владельца.

Секреты задаются через `wrangler secret put` и не добавляются в `wrangler.jsonc`, Git или документацию.

```powershell
$env:CLOUDFLARE_API_TOKEN = Get-Content "$env:LOCALAPPDATA\photoprobiz\cloudflare-api-token.txt" -Raw
Get-Content "$env:LOCALAPPDATA\photoprobiz\yandex-relay-token.txt" -Raw | npx.cmd wrangler secret put RELAY_TOKEN
npm.cmd run check
npm.cmd run deploy
Remove-Item Env:CLOUDFLARE_API_TOKEN
```

POST `/lead` требует разрешённый `Origin` и заголовок `X-Relay-Token`. Запросы с дополнительными полями отклоняются, поэтому персональные данные нельзя случайно переслать через этот маршрут.

Фактический сайт берётся из подписанного relay payload. Браузер не вызывает этот маршрут и не может сам назначить себе `site`: Yandex Function сначала сопоставляет браузерный `Origin` с `CRM_SITES_JSON`, сохраняет заявку под доверенным хостом и только затем вызывает Worker.

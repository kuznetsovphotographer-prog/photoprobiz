# Yandex Cloud Function: photoprobiz-leads

Функция принимает заявки сайта, проверяет данные и согласие, сначала сохраняет персональные данные в YDB Serverless `ru-central1`, а затем отправляет через Cloudflare Worker обезличенное уведомление в Telegram.

Действующий публичный адрес функции: `https://functions.yandexcloud.net/d4e5ur2fo156lrcve6id`.

Полное руководство: [YANDEX-CLOUD-YDB-PERSONAL-DATA-GUIDE.md](../../YANDEX-CLOUD-YDB-PERSONAL-DATA-GUIDE.md).

## Загрузка новой версии

1. Откройте Cloud Functions → `photoprobiz-leads` → **Редактор**.
2. Выберите Node.js 22 и источник **ZIP-архив**.
3. Загрузите `output/photoprobiz-leads-admin-ydb-console.zip` из корня проекта. В корне архива должны непосредственно лежать `index.js`, `storage.js`, `admin-auth.js`, `admin-page.js`, `package.json` и `package-lock.json`.
4. Точка входа: `index.handler`.
5. Таймаут: 15 секунд. Память: 256 МБ.
6. Сервисный аккаунт: `photoprobiz-leads-sa`.
7. Сеть: не выбрана.
8. Добавьте или сохраните переменные окружения:

```text
ENDPOINT=grpcs://ydb.serverless.yandexcloud.net:2135
DATABASE=/ru-central1/b1g3rq4isb0l45hg2kg0/etnj5v1s6iavjmndcs7o
DELIVERY_MODE=cloudflare-relay
RELAY_TOKEN=<значение из локального защищённого файла>
ADMIN_BASE_URL=https://functions.yandexcloud.net/d4e5ur2fo156lrcve6id
ADMIN_PASSWORD_SCRYPT=<scrypt-хеш пароля>
ADMIN_SESSION_SECRET=<случайная строка не короче 32 байт>
```

`RELAY_TOKEN` должен совпадать с одноимённым Cloudflare Worker Secret. Не помещайте его в код, ZIP, Git, Markdown или скриншоты. Telegram-секреты функции в режиме `cloudflare-relay` не использует.

Авторизация в YDB использует краткоживущий IAM-токен из контекста Cloud Function. Яндекс автоматически добавляет его, когда к версии прикреплён `photoprobiz-leads-sa`; статический ключ и отдельная SDK для metadata service не нужны. Переменная `YDB_METADATA_CREDENTIALS`, если она осталась в старой версии, не используется и может быть удалена позднее.

9. Сохраните изменения и дождитесь состояния новой версии **Active**.
10. Публичный вызов функции должен остаться включённым.

## Личный кабинет заявок

Адрес: `https://functions.yandexcloud.net/d4e5ur2fo156lrcve6id?admin=1`.

Пароль и значения трёх переменных администратора хранятся только в локальном защищённом файле `%LOCALAPPDATA%\photoprobiz\admin-cabinet-credentials.txt`. В GitHub, ZIP и документацию их не добавляют.

Кабинет отдаётся самой Yandex Cloud Function и не загружает сторонние шрифты, скрипты или аналитику. До входа персональные данные не передаются браузеру. После входа подписанный токен сессии сохраняется только в `localStorage` этого origin и передаётся закрытому API в заголовке `X-Admin-Session`; секрет подписи и пароль остаются на сервере. Такой вариант нужен потому, что прямой HTTPS-вызов Yandex Cloud Functions фильтрует заголовки `Cookie`/`Set-Cookie`. В кабинете доступны поиск, фильтрация, постраничная загрузка, карточка заявки, звонок, переход в выбранный мессенджер и статусы `Новая`, `Связался`, `Завершена`.

Авторизация скользящая: каждый успешный запрос кабинета выдаёт новый подписанный токен на 90 дней. Пароль потребуется снова только после 90 дней бездействия, ручного выхода, очистки данных браузера или смены `ADMIN_SESSION_SECRET`.

Cloudflare Worker получает только ID и служебное время. Кнопка `Открыть заявку` в Telegram ведёт в кабинет Yandex; имя и телефон по-прежнему не проходят через Cloudflare и Telegram.

При первом корректном POST функция автоматически создаст таблицы `leads` и `consent_events`. У `leads` настроено удаление по `expires_at` через один год, у `consent_events` — через три года. Запись обеих строк выполняется одним запросом. Только после успешной записи функция вызывает Worker.

GET по адресу функции должен вернуть:

```json
{
  "ok": true,
  "storage": "ydb",
  "databaseConfigured": true,
  "deliveryMode": "cloudflare-relay"
}
```

## Проверка после развёртывания

1. Откройте адрес функции по Wi-Fi и через мобильную сеть.
2. Отправьте одну тестовую заявку с сайта.
3. Убедитесь, что сайт показал успешную отправку, а Telegram прислал только ID заявки без имени и телефона.
4. Откройте YDB → `photoprobiz-leads-db` → **Навигация**: должны появиться таблицы `leads` и `consent_events`.
5. Выполните запрос:

```sql
SELECT submission_id, server_received_at, name, phone, contact_method, package_name, status
FROM leads
ORDER BY server_received_at DESC
LIMIT 20;
```

## Локальные проверки

```powershell
cd yandex/lead-function
npm.cmd install
npm.cmd test
```

Тесты не подключаются к рабочей YDB и не отправляют сообщения. Они проверяют порядок «YDB → уведомление», сроки хранения, схему и параметры записи, CORS, валидацию, таймауты и отсутствие персональных данных в запросе к Cloudflare/Telegram.

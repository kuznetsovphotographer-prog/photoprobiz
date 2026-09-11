# Универсальная схема заявок: GitHub Pages → Yandex Cloud → YDB → Cloudflare → Telegram

## 1. Что строим

Эта инструкция подходит для статического сайта на GitHub Pages, который должен принимать заявки из российских сетей без VPN, хранить персональные данные в российском регионе Yandex Cloud и быстро уведомлять владельца в Telegram.

```text
Клиент в браузере
  ├─ открывает сайт на GitHub Pages
  └─ POST с именем, телефоном и согласием
       ↓
Yandex Cloud Function, публичный российский адрес
  ├─ проверяет origin, формат данных и согласие
  ├─ сохраняет заявку и событие согласия в YDB Serverless ru-central1
  └─ передаёт в Cloudflare Worker только ID заявки и время
       ↓
Cloudflare Worker
  └─ отправляет в Telegram обезличенное уведомление и кнопку «Открыть заявку»
       ↓
Личный кабинет в Yandex Cloud Function
  └─ после входа читает имя и телефон напрямую из YDB
```

Критическое правило: браузер посетителя обращается к Yandex Cloud Function, а не к Cloudflare. На некоторых мобильных сетях России Cloudflare может быть недоступен. Связь Yandex → Cloudflare выполняется сервером и не мешает посетителю отправить форму.

Персональные данные не передаются в Cloudflare и Telegram. Worker принимает только:

```json
{
  "event": "lead_stored",
  "site": "example.ru",
  "submissionId": "уникальный-id-заявки",
  "serverReceivedAt": "2026-09-11T12:00:00.000Z"
}
```

## 2. Что потребуется

- репозиторий сайта на GitHub и включённый GitHub Pages;
- домен сайта;
- аккаунт Yandex Cloud с платёжным аккаунтом;
- YDB Serverless в `ru-central1`;
- Yandex Cloud Function с Node.js 22;
- отдельный сервисный аккаунт функции;
- аккаунт Cloudflare и Worker;
- Telegram-бот и ID личного чата;
- Node.js 22 и npm на компьютере;
- Yandex Cloud CLI `yc` или доступ к консоли Yandex Cloud.

Имена ресурсов удобно строить от домена:

```text
example-leads-db
example-leads-sa
example-leads
example-lead-form
```

Не помещайте токены, пароль кабинета, хеш пароля и секрет сессии в Git, ZIP, Markdown, скриншоты или сообщения нейросети. Храните их в локальной папке пользователя или в менеджере паролей.

## 3. Подготовка формы на сайте

Форма должна иметь:

- поле имени;
- одно поле телефона для любого выбранного способа связи;
- пустую по умолчанию галочку согласия;
- запрет отправки без самостоятельной установки галочки;
- ссылки на политику обработки персональных данных и текст согласия;
- стабильный идентификатор формы;
- новую случайную строку `submissionId` для каждой новой попытки клиента;
- время согласия в ISO 8601;
- версию текста согласия.

Пример тела запроса:

```json
{
  "name": "Анна",
  "contact": "+79991234567",
  "contactMethod": "telegram",
  "consent": true,
  "source": "modal",
  "phoneCountry": "RU",
  "consentAcceptedAt": "2026-09-11T12:00:00.000Z",
  "consentVersion": "2026-09-11",
  "submissionId": "019a1234-5678-7000-8000-123456789abc",
  "formId": "modal-general",
  "packageName": "Базовый"
}
```

Телефон валидируется и в браузере, и в функции. Сервер не должен доверять данным формы. `submissionId` используется как первичный ключ и делает повторную отправку идемпотентной.

Адрес функции передавайте сборке сайта через переменную, например:

```yaml
env:
  VITE_LEAD_ENDPOINT: https://functions.yandexcloud.net/<FUNCTION_ID>
```

Для Vite код отправки может читать `import.meta.env.VITE_LEAD_ENDPOINT`.

## 4. Создание YDB Serverless в России

1. Откройте Yandex Cloud Console и выберите нужный каталог.
2. Создайте ресурс **Managed Service for YDB → База данных**.
3. Укажите тип **Serverless** и нагрузку **OLTP**.
4. Выберите российский регион `ru-central1`.
5. Для небольшого сайта достаточно ограничения 10 RU/с и 1 ГБ.
6. Включите защиту от удаления.
7. Дождитесь статуса `Running`.
8. На странице обзора сохраните два значения:

```text
ENDPOINT=grpcs://ydb.serverless.yandexcloud.net:2135
DATABASE=/ru-central1/<FOLDER_ID>/<DATABASE_ID>
```

Для разных сайтов можно использовать одну базу с разными таблицами, но проще изолировать сайты отдельными базами или добавлять префикс таблиц. Квоты и бесплатные объёмы учитываются на уровне платёжного аккаунта/облака согласно текущему тарифу Yandex Cloud, а не выдаются заново каждому сайту.

## 5. Сервисный аккаунт и права

1. Откройте **Identity and Access Management → Сервисные аккаунты**.
2. Создайте `<site>-leads-sa`.
3. В YDB откройте **Права доступа → Назначить роли**.
4. Выберите этот сервисный аккаунт.
5. Назначьте роль `ydb.editor` на конкретную базу.

Не выдавайте роль владельца облака. `ydb.editor` достаточно для создания таблиц, записи, чтения и смены статуса.

## 6. Таблицы YDB

Рекомендуется две таблицы:

### `leads`

Хранит рабочие данные заявки:

- `submission_id` — UTF-8, первичный ключ;
- `server_received_at` — Timestamp;
- `client_submitted_at` — Timestamp;
- `consent_version` — UTF-8;
- `form_id` — UTF-8;
- `source` — UTF-8;
- `site_host` — UTF-8;
- `name` — UTF-8;
- `phone` — UTF-8;
- `phone_country` — UTF-8;
- `contact_method` — UTF-8;
- `package_name` — UTF-8;
- `status` — UTF-8;
- `expires_at` — Timestamp, TTL.

### `consent_events`

Хранит доказательство согласия:

- `submission_id` — UTF-8, первичный ключ;
- `accepted_at` — Timestamp;
- `server_received_at` — Timestamp;
- `consent_version` — UTF-8;
- `form_id` — UTF-8;
- `source` — UTF-8;
- `site_host` — UTF-8;
- `name` — UTF-8;
- `phone` — UTF-8;
- `expires_at` — Timestamp, TTL.

Для рабочей таблицы можно установить TTL один год, для журнала согласий — три года. Сроки должны совпадать с вашей реальной политикой и юридическим основанием.

Функция может создавать таблицы при первом POST. В `ydb-sdk` 5.11.1 для этого используйте:

```js
const description = new TableDescription()
  .withColumn(new Column('submission_id', Types.UTF8))
  .withColumn(new Column('expires_at', Types.TIMESTAMP))
  .withPrimaryKey('submission_id')
  .withTtl('expires_at');

await session.createTable('leads', description);
```

Проверяйте наличие таблицы через `session.describeTable(...)`. В этой версии SDK метода `session.executeSchemeQuery(...)` нет.

## 7. Код Yandex Cloud Function

Для этой реализации рабочим эталоном служат:

- `yandex/lead-function/index.js` — HTTP, валидация, CORS, кабинет и relay;
- `yandex/lead-function/storage.js` — YDB, таблицы, запись, список и статусы;
- `yandex/lead-function/admin-auth.js` — пароль и подписанная сессия;
- `yandex/lead-function/admin-page.js` — мобильный кабинет;
- `yandex/lead-function/package.json` и `package-lock.json` — точные зависимости.

Используйте точную зависимость:

```json
{
  "engines": { "node": ">=22" },
  "dependencies": { "ydb-sdk": "5.11.1" }
}
```

Функции с прикреплённым сервисным аккаунтом получают краткоживущий IAM-токен в `context.token.access_token`. Передавайте его в YDB так:

```js
const authService = new TokenAuthService(accessToken);
const driver = new Driver({ endpoint, database, authService });
```

Не включайте `YDB_METADATA_CREDENTIALS=1` и не используйте metadata auth service. В архиве не нужен `@yandex-cloud/nodejs-sdk`. Иначе возможна ошибка:

```text
Cannot find module '@yandex-cloud/nodejs-sdk/dist/token-service/metadata-token-service'
```

Последовательность POST должна быть строгой:

1. проверить метод, Content-Type, Origin и размер тела;
2. разобрать JSON;
3. проверить все поля и согласие;
4. записать `leads` и `consent_events`;
5. только после успешной записи вызвать Cloudflare Worker;
6. вернуть клиенту успех.

При сбое YDB нельзя уведомлять Telegram и нельзя отвечать успехом: иначе владелец увидит ID, которого нет в базе.

## 8. CORS и публичный доступ функции

Разрешите только реальные origin сайта:

```text
https://example.ru
https://www.example.ru
https://<github-user>.github.io
http://localhost:4173
```

Обрабатывайте `OPTIONS`. Для POST принимайте только `application/json`. Ограничьте тело, например, 16 КБ. Не возвращайте клиенту технические детали YDB или значения секретов.

Функция должна быть публичной, потому что её вызывает браузер. Административные API остаются закрытыми собственной подписанной cookie.

## 9. Личный кабинет

Кабинет можно отдавать той же функцией:

```text
https://functions.yandexcloud.net/<FUNCTION_ID>?admin=1
```

Нужны три переменные:

```text
ADMIN_BASE_URL=https://functions.yandexcloud.net/<FUNCTION_ID>
ADMIN_PASSWORD_SCRYPT=scrypt$16384$8$1$<salt>$<hash>
ADMIN_SESSION_SECRET=<случайная строка минимум 32 байта>
```

Никогда не храните открытый пароль в переменной функции. На компьютере владельца допустимо сохранить пароль и значения переменных в защищённом локальном файле вне репозитория.

Минимальные требования к кабинету:

- до входа не отдавать PII в HTML или API;
- HMAC-подпись и срок сессии;
- подписанный токен в `localStorage` и пользовательский заголовок `X-Admin-Session`;
- задержка после неверного пароля;
- заголовки `Cache-Control: no-store`, CSP, `X-Frame-Options: DENY`;
- список с датой и временем, поиском, фильтром и пагинацией;
- просмотр одной заявки по `lead=<submissionId>`;
- смена статуса;
- ссылки `tel:`, `tg://resolve?phone=` и `https://wa.me/...`;
- никаких внешних CDN, шрифтов, скриптов и аналитики.

Прямой HTTPS-вызов Yandex Cloud Functions фильтрует заголовки `Cookie` и `Set-Cookie`, поэтому обычная серверная cookie на адресе `functions.yandexcloud.net/<FUNCTION_ID>` не работает. Для этой схемы кабинет хранит только подписанный сессионный токен в `localStorage`; пароль, ключ подписи и данные заявок туда не записываются. Строгая CSP и отсутствие сторонних скриптов снижают риск утечки токена. Если нужен именно `HttpOnly` cookie, добавьте перед функцией Yandex API Gateway с собственным доменом и отдельно проверьте прохождение cookie.

## 10. Cloudflare Worker

Worker нужен только как серверный мост к Telegram. Он не должен быть endpoint формы в браузере.

Secrets:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
RELAY_TOKEN
```

Несекретная переменная:

```text
ADMIN_BASE_URL=https://functions.yandexcloud.net/<FUNCTION_ID>
```

`RELAY_TOKEN` должен совпадать с переменной Yandex Function. Передавайте его в заголовке `X-Relay-Token`. Сравнивайте секрет безопасным сравнением и отклоняйте запросы с лишними JSON-полями.

Telegram Bot API получает сообщение без имени и телефона:

```text
Новая заявка с example.ru
Получена: 11.09.2026, 15:00
ID заявки: ...
Откройте защищённый кабинет, чтобы увидеть контакт.
```

К сообщению добавляется inline keyboard:

```json
{
  "inline_keyboard": [[
    {
      "text": "Открыть заявку",
      "url": "https://functions.yandexcloud.net/<FUNCTION_ID>?admin=1&lead=<SUBMISSION_ID>"
    }
  ]]
}
```

Если владелец уже вошёл на телефоне, нужная карточка откроется сразу. Если сессии нет, сначала появится экран пароля, затем та же заявка.

## 11. Сборка ZIP без прежних ошибок

Перед упаковкой:

```powershell
cd yandex\lead-function
npm.cmd ci
npm.cmd test
```

Для загрузки через редактор Yandex Cloud упакуйте только исходники и манифесты. Yandex соберёт зависимость по lock-файлу:

```powershell
tar.exe -a -cf ..\..\output\lead-function.zip `
  index.js storage.js admin-auth.js admin-page.js package.json package-lock.json
```

Проверьте содержимое:

```powershell
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path '..\..\output\lead-function.zip'))
$zip.Entries.FullName
$zip.Dispose()
```

Правильный корень:

```text
index.js
storage.js
admin-auth.js
admin-page.js
package.json
package-lock.json
```

Неправильно:

```text
lead-function/index.js
```

Не включайте тесты, `.env`, `.git`, локальные файлы секретов и весь проект. Архив с полным `node_modules` может превысить лимит прямой загрузки консоли 3,5 МБ; тогда потребуется Object Storage. Маленький архив с `package-lock.json` удобнее.

## 12. Создание версии Yandex Function

Через консоль:

1. **Cloud Functions → функция → Редактор**.
2. Среда: **Node.js 22**.
3. Источник: **ZIP-архив**.
4. Загрузите проверенный ZIP.
5. Точка входа: `index.handler`.
6. Таймаут: 15 секунд.
7. Память: 256 МБ.
8. Сервисный аккаунт: `<site>-leads-sa`.
9. Сеть: не выбрана.
10. Добавьте переменные:

```text
ENDPOINT=grpcs://ydb.serverless.yandexcloud.net:2135
DATABASE=/ru-central1/<FOLDER_ID>/<DATABASE_ID>
DELIVERY_MODE=cloudflare-relay
RELAY_TOKEN=<секрет>
ADMIN_BASE_URL=https://functions.yandexcloud.net/<FUNCTION_ID>
ADMIN_PASSWORD_SCRYPT=<scrypt-хеш>
ADMIN_SESSION_SECRET=<секрет сессии>
```

11. Не добавляйте `YDB_METADATA_CREDENTIALS`.
12. Сохраните и дождитесь `Active`.
13. Оставьте публичный вызов включённым.

Через CLI общая форма команды:

```powershell
yc serverless function version create `
  --function-id <FUNCTION_ID> `
  --runtime nodejs22 `
  --entrypoint index.handler `
  --memory 256m `
  --execution-timeout 15s `
  --service-account-id <SERVICE_ACCOUNT_ID> `
  --source-path .\output\lead-function.zip `
  --environment "ENDPOINT=...,DATABASE=...,DELIVERY_MODE=cloudflare-relay,RELAY_TOKEN=...,ADMIN_BASE_URL=...,ADMIN_PASSWORD_SCRYPT=...,ADMIN_SESSION_SECRET=..."
```

Перед CLI-развёртыванием выполните `yc init`. Современный мастер откроет официальную страницу Yandex в браузере, сохранит краткоживущий IAM-токен в локальном профиле CLI и предложит выбрать облако и каталог. Не копируйте токены в репозиторий или инструкцию.

Официальная документация: [создание версии функции](https://yandex.cloud/ru/docs/functions/operations/function/version-manage) и [установка Yandex Cloud CLI](https://yandex.cloud/ru/docs/cli/operations/install-cli).

## 13. Развёртывание Worker

В каталоге Worker:

```powershell
npm.cmd install
npx.cmd wrangler secret put TELEGRAM_BOT_TOKEN
npx.cmd wrangler secret put TELEGRAM_CHAT_ID
npx.cmd wrangler secret put RELAY_TOKEN
npm.cmd run check
npm.cmd run deploy
```

В `wrangler.jsonc` можно настроить custom domain `api.example.ru`. Для браузера он не используется, поэтому недоступность этого адреса у отдельного мобильного оператора не блокирует форму.

Проверка:

```text
https://api.example.ru/health
```

Ответ должен подтверждать `telegramConfigured`, `relayConfigured` и `adminLinkConfigured` без вывода самих секретов.

## 14. Порядок публикации

1. Создать YDB и сервисный аккаунт.
2. Выдать `ydb.editor` на базу.
3. Создать Function и получить её ID.
4. Создать пароль кабинета, scrypt-хеш и секрет сессии.
5. Развернуть Function.
6. Проверить health Function.
7. Создать и развернуть Worker с Telegram secrets, relay secret и `ADMIN_BASE_URL`.
8. В Function добавить тот же `RELAY_TOKEN` и сохранить новую версию, если его ещё не было.
9. Указать URL Function в workflow GitHub Pages.
10. Сделать commit и push.
11. Дождаться успешного GitHub Actions deployment.
12. Проверить опубликованный сайт и реальную форму.

## 15. Обязательная проверка

Проверьте весь путь:

1. GET Function через Wi-Fi без VPN.
2. GET Function через мобильную сеть Beeline/МТС/МегаФон/Tele2 без VPN.
3. CORS preflight с origin сайта.
4. Невалидная заявка получает 400 и не записывается.
5. Заявка без согласия не отправляется.
6. Валидная заявка появляется в `leads` и `consent_events`.
7. Telegram получает только ID и кнопку.
8. Кнопка открывает нужную карточку после входа.
9. Невошедший пользователь не может получить JSON со списком.
10. Поиск, фильтр, пагинация и смена статуса работают на телефоне.
11. В Cloudflare request/log нет имени, телефона и согласия.
12. Публичная страница политики описывает реальную схему хранения и передачи.

После каждого обновления проверяйте опубликованную версию, а не только локальную сборку или успешный `git push`.

## 16. Частые ошибки

### Function доступна по Wi-Fi, но не по мобильной сети

Браузер, вероятно, вызывает Cloudflare. Переключите `VITE_LEAD_ENDPOINT` на публичный URL Yandex Function. Cloudflare оставьте только в серверной части.

### `Cannot find module ... metadata-token-service`

Код выбрал metadata auth из `ydb-sdk`. Удалите `YDB_METADATA_CREDENTIALS`, прикрепите сервисный аккаунт и используйте `context.token.access_token` с `TokenAuthService`.

### `session.executeSchemeQuery is not a function`

Этот метод не поддерживается используемой версией SDK. Применяйте `describeTable` и `createTable` с `TableDescription`, `Column`, `Types` и `withTtl`.

### `Cannot find module` или не найдена точка входа

Откройте ZIP и убедитесь, что `index.js` и `package.json` лежат в корне. Точка входа должна быть `index.handler`, а файл экспортировать `handler`.

### Архив не загружается

Прямая загрузка имеет ограничение размера. Удалите `node_modules` из архива и оставьте `package.json` с `package-lock.json`. Для архива больше лимита используйте Yandex Object Storage.

### Telegram пришёл, но заявки нет в YDB

Уведомление вызвано раньше записи или ошибка записи была проигнорирована. Сначала дождитесь успешного YDB `UPSERT`, затем вызывайте Worker.

### В Telegram нет кнопки

Проверьте `ADMIN_BASE_URL` Worker и health-поле `adminLinkConfigured`. URL должен быть `https://functions.yandexcloud.net/<FUNCTION_ID>`.

### После входа снова просит пароль

Не пытайтесь установить cookie через прямой адрес функции: Yandex фильтрует `Cookie`/`Set-Cookie`. Верните подписанный токен в JSON, сохраните его в `localStorage` и передавайте в `X-Admin-Session`. Проверьте, что CSP не разрешает сторонние скрипты.

### Кнопка открывает список, а не заявку

Worker должен добавлять оба query-параметра: `admin=1` и `lead=<submissionId>`. Кабинет после входа обязан сохранить `lead` из текущего URL и открыть эту запись.

### YDB отвечает `UNAUTHORIZED`

У функции не выбран сервисный аккаунт, токен контекста не передан драйверу или аккаунту не назначена `ydb.editor` на базу.

## 17. Что передать другой нейросети

Передайте ей эту инструкцию и каталог с эталонными файлами, но не секреты. Поставьте задачу:

```text
Адаптируй эталонную схему под домен <DOMAIN> и репозиторий <REPOSITORY>.
Сохрани границу данных: PII только браузер → Yandex Function → YDB ru-central1 → защищённый кабинет.
В Cloudflare и Telegram разрешены только event, site, submissionId и serverReceivedAt.
Используй Node.js 22, ydb-sdk 5.11.1, context.token.access_token и TokenAuthService.
Не используй metadata auth и executeSchemeQuery.
Собери ZIP с файлами непосредственно в корне, без node_modules и секретов.
Запусти тесты, разверни Function и Worker, опубликуй GitHub Pages и проверь реальную форму с мобильной сети без VPN.
```

Нейросеть должна запросить у владельца только действия, которые невозможно выполнить без входа в аккаунт. Она не должна просить прислать секреты в чат: секреты вводятся локально или в secret store соответствующего сервиса.

## 18. Эталон photoprobiz

Текущие несекретные значения:

```text
Сайт: https://photoprobiz.ru
Function: https://functions.yandexcloud.net/d4e5ur2fo156lrcve6id
YDB: photoprobiz-leads-db, Serverless, ru-central1
Сервисный аккаунт: photoprobiz-leads-sa
Worker: photoprobiz-lead-form
Worker health: https://api.photoprobiz.ru/health
```

Локальные эталонные файлы находятся в `yandex/lead-function` и `cloudflare/lead-worker`. Секреты в репозитории отсутствуют.

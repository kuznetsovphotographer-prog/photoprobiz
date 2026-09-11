# Инструкции для AI-агентов

Перед любыми изменениями прочитайте `PROJECT-STATUS.md`, затем профильный README затрагиваемого компонента. Этот проект уже опубликован и принимает реальные заявки.

В начале новой сессии выполните `git status --short --branch`, прочитайте последние коммиты и проверьте публичные health-адреса из `PROJECT-STATUS.md`. Не считайте сведения о production актуальными только потому, что они записаны в Markdown: состояние облачных ресурсов и сайта нужно проверить заново.

## Контекст

- Рабочая папка: `D:\Antigravity\Sites\photoprobiz`.
- Репозиторий: `kuznetsovphotographer-prog/photoprobiz`, ветка `main`.
- Production: `https://photoprobiz.ru/` через GitHub Pages.
- Формы отправляют персональные данные напрямую в Yandex Cloud Function и YDB Serverless `ru-central1`.
- Cloudflare Worker и Telegram получают только обезличенное уведомление с ID заявки.
- CRM-кабинет расположен в Yandex Cloud Function и защищён паролем со скользящей сессией 90 дней. Он объединяет сайты, ручные контакты, статусы и заметки.
- Отдельная Yandex Cloud Function проверяет сайт раз в час; история хранится в YDB, основной канал — Telegram, резерв — Yandex Monitoring email.
- GraphQL/GraphiQL отсутствует; используются HTTPS endpoint и закрытые admin API.

## Обязательные инварианты

- Никогда не добавляйте секреты, пароли, токены, chat ID или их хеши в Git, документацию, ZIP и вывод команд.
- Не просите владельца вставлять секреты в чат. Используйте локальные защищённые файлы, Yandex Cloud Environment Variables и Cloudflare Worker Secrets.
- Никогда не передавайте имя, телефон, способ связи, пакет или доказательство согласия через Cloudflare или Telegram.
- Сохраняйте порядок обработки: валидация → атомарная запись `leads` и `consent_events` в YDB → обезличенное уведомление.
- Для веб-заявки определяйте сайт только по разрешённому `Origin` и серверной конфигурации `CRM_SITES_JSON`; не доверяйте полю `site` из браузера.
- Ручные контакты записывайте как `manual.crm` в `leads` и `lead_meta`; не создавайте для них фиктивное событие веб-согласия в `consent_events`.
- Галочка согласия при открытии формы пустая; без самостоятельной установки отправка заблокирована.
- При изменении обработки данных синхронно обновляйте `src/data/privacy.ts`, страницу согласия, схему хранения, тесты и документацию.
- Не используйте стоковые фотографии и не придумывайте услуги, цены, достижения или юридические факты.
- Не перезаписывайте пользовательские изменения и не запускайте `scripts/compile-design.py` без понимания, что он регенерирует измеренную композицию.
- Перед коммитом просмотрите весь diff и убедитесь, что в него входят только изменения текущей задачи.

## Основные файлы

- `src/data/sections.json` — секции, тексты, цены и изображения.
- `src/data/galleries.json` — галереи и порядок фотографий.
- `src/components/LeadForm.tsx`, `src/services/lead.ts` — форма и транспорт.
- `src/data/privacy.ts` — политика и согласие.
- `yandex/lead-function/` — запись в YDB, многосайтовая CRM и API (`leads`, `consent_events`, `lead_meta`).
- `yandex/monitor-function/` — часовые проверки и история.
- `cloudflare/lead-worker/` — обезличенные Telegram-уведомления.
- `.github/workflows/deploy-pages.yml` — production-сборка с URL Yandex Function.

## Проверка и выпуск

Для изменения сайта выполните:

```powershell
npm.cmd run check
npm.cmd test
node --test yandex/lead-function/*.test.cjs
node --test yandex/monitor-function/*.test.cjs
npm.cmd run build
```

Для Worker дополнительно выполните в `cloudflare/lead-worker`:

```powershell
npm.cmd run check
npm.cmd run deploy:dry
```

После push в `main` дождитесь `Deploy website to GitHub Pages: completed/success`. Затем проверьте реальный `https://photoprobiz.ru/` с cache-busting параметром, health Yandex Function и `https://api.photoprobiz.ru/health`. Не считайте один `git push` доказательством публикации.

## Документирование

После изменения инфраструктуры обновите `PROJECT-STATUS.md` и соответствующий README. Запишите имена и несекретные ID ресурсов, дату проверки, команды валидации и известные ограничения. Секреты описывайте только названием переменной и местом хранения.

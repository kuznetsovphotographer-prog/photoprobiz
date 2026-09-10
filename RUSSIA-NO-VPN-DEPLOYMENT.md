# Сайт и заявки в России без VPN

## Цель

Посетитель из России без VPN должен открыть сайт, заполнить форму и получить успешный ответ. Заявка должна прийти в Telegram.

## Текущая схема

- Основной сайт опубликован по адресу `https://photoprobiz.ru/` через GitHub Pages.
- `www.photoprobiz.ru` перенаправляется GitHub Pages на основной домен.
- Форма отправляет заявки на `https://api.photoprobiz.ru/lead`.
- Worker имеет Custom Domain `api.photoprobiz.ru`; прежний маршрут `workers.dev` отключён.
- Для зоны отключён Encrypted Client Hello (ECH), чтобы российские сети не обрывали TLS-соединение к API формы.
- Telegram-бот и Cloudflare Secrets подключены, а `https://api.photoprobiz.ru/health` отвечает с `"telegramConfigured": true`.

Схема исключает зависимость формы от `workers.dev`. Окончательно доступность для клиентов из России подтверждается контрольным тестом без VPN на мобильной сети и у домашнего провайдера.

## Что подготовлено в коде уже сейчас

- Worker принимает заявки только с разрешённых origin: временного GitHub Pages, `photoprobiz.ru`, `www.photoprobiz.ru` и локальной разработки.
- Токен Telegram-бота и ID чата хранятся только в Cloudflare Secrets.
- Worker принимает `POST /lead`, обрабатывает preflight `OPTIONS` и возвращает JSON.
- В workflow GitHub Pages адрес Worker задан одной переменной `VITE_LEAD_ENDPOINT`.

Логика формы и дизайн сайта не менялись.

## Рабочая схема после подключения собственного домена

Ниже `<домен>` означает фактический домен сайта, например `photoprobiz.ru`.

```text
Посетитель без VPN
  ├─ https://<домен> и https://www.<домен>
  │    └─ GitHub Pages напрямую, Cloudflare DNS only
  └─ https://api.<домен>/lead
       └─ Custom Domain Cloudflare Worker → Telegram Bot API
```

Основной сайт и API используют разные поддомены. Для сайта Cloudflare служит DNS-провайдером, а API является Custom Domain Worker. Это не обычный Cloudflare Route перед сторонним origin.

## Настройка при появлении домена

### 1. DNS для GitHub Pages

Перенесите домен в Cloudflare и создайте записи с серым облаком, то есть `DNS only`:

| Имя | Тип | Значение |
| --- | --- | --- |
| `@` | `A` | `185.199.108.153` |
| `@` | `A` | `185.199.109.153` |
| `@` | `A` | `185.199.110.153` |
| `@` | `A` | `185.199.111.153` |
| `www` | `CNAME` | `kuznetsovphotographer-prog.github.io` |

При необходимости добавьте рекомендованные GitHub IPv6-записи. Не включайте оранжевое облако для `@` и `www`: страницы должны идти прямо на GitHub Pages.

### 2. GitHub Pages

В репозитории откройте **Settings → Pages**, укажите `<домен>` как Custom domain и после выпуска сертификата включите **Enforce HTTPS**.

Проект публикуется GitHub Actions, поэтому вручную создавать `CNAME` в репозитории не требуется: GitHub указывает, что при пользовательском Actions workflow этот файл не создаётся и не нужен.

### 3. Отключение ECH для доступности API из России

Custom Domain Worker всё равно обслуживается на edge-серверах Cloudflare. На бесплатном тарифе Cloudflare включает Encrypted Client Hello (ECH) по умолчанию. Некоторые российские провайдеры обрывают такие TLS-соединения, поэтому одного переноса с `workers.dev` на `api.<домен>` недостаточно.

В Cloudflare откройте **SSL/TLS → Edge Certificates → Encrypted Client Hello (ECH)** и выключите ECH. Настройка действует на proxied-хосты зоны, включая Custom Domain Worker. Основной сайт с серым облаком продолжает открываться напрямую с GitHub Pages.

После изменения проверьте HTTPS-запись домена через DNS-over-HTTPS: в ответе `api.<домен>` не должно быть параметра `ech=`. Обычные поля `alpn=h3,h2` допустимы.

### 4. Custom Domain для Worker

В `cloudflare/lead-worker/wrangler.jsonc` добавьте перед закрывающей фигурной скобкой:

```jsonc
"routes": [
  {
    "pattern": "api.<домен>",
    "custom_domain": true
  }
]
```

Custom Domain сам создаст DNS-запись и сертификат для `api.<домен>`. Не создавайте для `api` отдельный CNAME заранее.

Если фактический домен отличается от `photoprobiz.ru`, обновите `allowedOrigins` в `cloudflare/lead-worker/src/index.ts`, добавив `https://<домен>` и `https://www.<домен>`.

Затем из `cloudflare/lead-worker` выполните:

```powershell
npm.cmd run check
npm.cmd run deploy
```

Секреты `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` уже существуют в Cloudflare и повторно в код или GitHub не добавляются.

### 5. Адрес API в сборке сайта

В `.github/workflows/deploy-pages.yml` замените значение:

```yaml
VITE_LEAD_ENDPOINT: https://photoprobiz-lead-form.kuznetsovphotographer.workers.dev/lead
```

на:

```yaml
VITE_LEAD_ENDPOINT: https://api.<домен>/lead
```

Сделайте commit и push в `main`. GitHub Actions соберёт сайт с новым адресом формы.

## Обязательная проверка после переключения

Проверяем без VPN на мобильном интернете и минимум одном домашнем провайдере в России:

1. Открыть `https://<домен>` и убедиться, что страница полностью загрузилась.
2. Открыть `https://api.<домен>/health` и убедиться, что ответ содержит `"telegramConfigured": true`.
3. Отправить тестовую заявку через опубликованную форму.
4. Проверить открытие страницы благодарности и новую заявку в Telegram.
5. Открыть браузерную консоль и убедиться, что нет `Failed to fetch`, `CORS` или сетевых ошибок формы.

Дополнительно полезно проверить `https://api.<домен>/health` внешними узлами разных российских операторов. После отключения ECH текущий API получил HTTP 200 из сетей Timeweb, Selectel, Yandex Cloud, МТС и нескольких региональных операторов.

## Полезные источники

- [Cloudflare: Custom Domains для Workers](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Cloudflare: Encrypted Client Hello](https://developers.cloudflare.com/ssl/edge-certificates/ech/)
- [Cloudflare: рекомендации по доменам и маршрутам Workers](https://developers.cloudflare.com/workers/configuration/routing/)
- [GitHub: настройка Custom Domain для GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub: HTTPS для GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

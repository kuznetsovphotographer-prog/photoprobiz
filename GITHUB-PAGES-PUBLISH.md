# Публикация photoprobiz.ru через GitHub Pages

Проект публикуется через GitHub Actions. В репозитории хранятся исходники, а папка `dist` собирается на GitHub при каждом обновлении ветки `main`. Добавлять `dist` в Git вручную не нужно.

## 1. Создать репозиторий на GitHub

1. Войдите на https://github.com/.
2. Нажмите **New repository**.
3. Назовите репозиторий `photoprobiz`.
4. Выберите **Public**. Для приватного репозитория GitHub Pages зависит от тарифа.
5. Не добавляйте README, `.gitignore` и лицензию: эти файлы уже есть локально.
6. Нажмите **Create repository**.

## 2. Отправить проект на GitHub

Откройте PowerShell в `D:\Antigravity\Sites\photoprobiz` и выполните команды. Вместо `USERNAME` укажите имя своего аккаунта GitHub.

```powershell
git init
git branch -M main
git add .
git status --short
git commit -m "Подготовить сайт photoprobiz.ru к публикации"
git remote add origin https://github.com/USERNAME/photoprobiz.git
git push -u origin main
```

При авторизации используйте вход через браузер или GitHub Credential Manager. Пароль от GitHub или Google в обычное окно логина и пароля Git вводить не нужно.

Исходные фотографии, `node_modules`, локальные отчёты и готовая папка `dist` исключены через `.gitignore`. В репозиторий попадут оптимизированные изображения из `public` и код, необходимый для повторяемой сборки.

## 3. Включить GitHub Pages

1. Откройте созданный репозиторий.
2. Перейдите в **Settings → Pages**.
3. В разделе **Build and deployment → Source** выберите **GitHub Actions**.
4. Перейдите на вкладку **Actions**.
5. Откройте процесс **Deploy website to GitHub Pages**. Если первый запуск уже завершился ошибкой до включения Pages, нажмите **Re-run all jobs**.

Workflow `.github/workflows/deploy-pages.yml` автоматически устанавливает зависимости, запускает тесты, собирает `dist` и публикует его. После успешного запуска сайт будет доступен по адресу:

```text
https://USERNAME.github.io/photoprobiz/
```

На странице Actions обе задачи, `build` и `deploy`, должны стать зелёными.

## 4. Подключить photoprobiz.ru

Сначала добавьте домен в GitHub, затем меняйте DNS.

1. Откройте **Settings → Pages**.
2. В поле **Custom domain** укажите `photoprobiz.ru` и нажмите **Save**.
3. В панели регистратора домена создайте четыре A-записи для корня домена:

| Тип | Имя | Значение |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

4. Для адреса `www.photoprobiz.ru` добавьте запись:

| Тип | Имя | Значение |
| --- | --- | --- |
| CNAME | `www` | `USERNAME.github.io` |

Удалите конфликтующие A, AAAA, ALIAS, ANAME или CNAME-записи для `@` и `www`, если они направляют домен на старый хостинг. Не используйте wildcard-запись `*` для GitHub Pages.

Проверить DNS в PowerShell:

```powershell
Resolve-DnsName photoprobiz.ru -Type A
Resolve-DnsName www.photoprobiz.ru -Type CNAME
```

Обновление DNS может занять до 24 часов. После успешной проверки домена вернитесь в **Settings → Pages** и включите **Enforce HTTPS**. При публикации через GitHub Actions файл `CNAME` в проекте не требуется: домен хранится в настройках Pages.

## 5. Проверить опубликованный сайт

Откройте следующие адреса:

- https://photoprobiz.ru/
- https://photoprobiz.ru/biznes-portret/
- https://photoprobiz.ru/delovaya-fotosessiya-dlya-vrachey/
- https://photoprobiz.ru/robots.txt
- https://photoprobiz.ru/sitemap.xml
- https://photoprobiz.ru/llms.txt

Проверьте первый экран на телефоне и компьютере, меню, несколько галерей, полноэкранный режим, cookie-плашку и форму.

Production workflow уже задаёт `VITE_LEAD_ENDPOINT` действующей Yandex Cloud Function. GitHub Pages обслуживает статическую часть сайта, а функция принимает заявку, сохраняет её в YDB и запускает обезличенное Telegram-уведомление через Cloudflare Worker. Текущее состояние и идентификаторы ресурсов перечислены в [`PROJECT-STATUS.md`](PROJECT-STATUS.md).

После запуска добавьте `https://photoprobiz.ru/sitemap.xml` в Google Search Console и Яндекс Вебмастер. Публичную публикацию считайте завершённой только после проверки реального домена и перечисленных взаимодействий.

## 6. Публиковать последующие изменения

После каждого набора изменений локально выполните:

```powershell
npm test
npm run build
git add .
git commit -m "Обновить сайт"
git push
```

Каждый push в `main` автоматически запускает новую публикацию. Ход и результат можно увидеть на вкладке **Actions**.

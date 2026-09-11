# Монитор доступности photoprobiz.ru

Отдельная Yandex Cloud Function раз в час проверяет основной сайт, функцию приёма заявок/YDB и Cloudflare-посредник. Каждая проверка сохраняется в `monitoring_checks` на 180 дней, текущее состояние — в `monitoring_state`.

Правила:

- тревога после трёх последовательных неудачных проверок;
- одно сообщение о восстановлении после открытого инцидента;
- ежедневный отчёт `Все системы работают` в 10:00 по Москве;
- основной канал — существующий Telegram-бот через защищённый `/monitor` Cloudflare Worker;
- ошибка доставки не скрывается: функция завершается ошибкой, чтобы её увидел резервный Yandex Monitoring.

Резервный канал в Yandex Monitoring:

- email-канал `photoprobiz-monitor-reserve` (`fbe4m45u0ai126c8ie6s`);
- алерт `photoprobiz-monitor-reserve-alert` (`monsihgbrbl0klc9l2ml`);
- метрика `functions_errors` функции `photoprobiz-monitor`;
- пороги: `Warning > 0`, `Alarm > 0,5` за окно 5 минут с задержкой 30 секунд;
- уведомления включены для `Warning`, `Alarm`, `Error` и восстановления `Ok`;
- уведомления `No data` выключены: отсутствие метрики ошибок при нормальной работе не считается аварией.

Таймер работает каждый час по UTC: `0 * ? * * *`.

Переменные функции: `ENDPOINT`, `DATABASE`, `MAIN_SITE_URL`, `YANDEX_HEALTH_URL`, `CLOUDFLARE_HEALTH_URL`, `RELAY_URL`, `RELAY_TOKEN`.

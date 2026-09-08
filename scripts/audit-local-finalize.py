import sys,json,csv,re,hashlib,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'audit/tooling'))
sys.stdout.reconfigure(encoding='utf-8')
from bs4 import BeautifulSoup
OUT=ROOT/'audit'
local=json.loads((OUT/'local-assets-inventory.json').read_text('utf-8'))
matches=json.loads((OUT/'local-remote-matches.json').read_text('utf-8'))
sources={p.stem:BeautifulSoup(p.read_text('utf-8-sig'),'html.parser') for p in (OUT/'source').glob('*.html')}
accepted=[]
for x in matches:
    status=x.get('matchStatus')
    if status=='byte-identical':
        x['recommendedSource']=x['candidates'][0]['local'];x['selectionReason']='Local source is byte-identical to the published download (SHA-256).'
    elif status in ['high-confidence-perceptual','visually-confirmed-local'] and x['visualReviewId']!=33:
        x['recommendedSource']=x['candidates'][0]['local'];x['selectionReason']='Manually inspected source/local pairs: same photo, crop and color; local original avoids CDN recompression.'
        x['matchStatus']='visually-confirmed-local';accepted.append(x['visualReviewId'])
    elif x.get('type')=='svg':
        x['recommendedSource']=x['file'];x['selectionReason']='Published SVG downloaded locally; keep exact colors and paths.'
    else:
        x['recommendedSource']=x['file']
        x['selectionReason']='Use exact published asset; no confirmed equivalent local source.'
        if x.get('visualReviewId')==33:
            x['matchStatus']='same-photo-different-color';x['selectionReason']='Published portrait is monochrome; local candidate is color despite identical pHash. Preserve published monochrome version.'
        elif x.get('visualReviewId')==21:x['selectionReason']='Same portrait but different framing/processing; preserve exact published version.'
    x['approvedSource']=x['recommendedSource']
    x['approvedSourceType']='local-original' if x['approvedSource'].startswith('Фотографии для сайта') else 'downloaded-published'
    uses=[]
    for page in x['pages']:
        for node in sources[page].find_all(True):
            for attr,value in node.attrs.items():
                if not isinstance(value,str):continue
                if any(a in value for a in x['aliases']):
                    rec=node.find_parent(id=re.compile('^rec'))
                    uses.append({'page':page,'record':rec.get('id') if rec else None,'tag':node.name,'attribute':attr,'alt':node.get('alt'),'dataElemId':node.get('data-elem-id')})
                    break
    x['uses']=uses
(OUT/'local-remote-matches.json').write_text(json.dumps(matches,ensure_ascii=False,indent=2),'utf-8')
with (OUT/'local-image-mapping.csv').open('w',encoding='utf-8-sig',newline='') as f:
    fields=['page','section','content','image','source','migrationStatus','sourceStatus','remoteUrl','localCandidate','publishedDimensions','localDimensions']
    writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader()
    for x in matches:
        c=x.get('candidates',[{}])[0]
        for use in x['uses'] or [{'page':','.join(x['pages']),'record':'head or embedded reference','alt':''}]:
            writer.writerow({'page':use['page'],'section':use['record'],'content':use.get('alt') or '','image':x['file'],'source':x['recommendedSource'],'migrationStatus':'audited; not implemented','sourceStatus':x.get('matchStatus','svg'),'remoteUrl':x['url'],'localCandidate':c.get('local',''),'publishedDimensions':f"{x.get('width','')}x{x.get('height','')}",'localDimensions':f"{c.get('width','')}x{c.get('height','')}"})

guide=ROOT/'Фотографии для сайта по деловым съемкам/biznes-portret-7slides by gemini.html'
soup=BeautifulSoup(guide.read_text('utf-8-sig'),'html.parser')
slides=soup.select('.slide[data-slide]')
transcription=['# Local guide: recovered text and visual verification','',
'The PDF contains raster pages and has no extractable text layer. The following text is recovered from the supplied HTML companion and was manually checked against all six Poppler-rendered PDF pages. This is a transcription for migration/accessibility, not a newly exported PDF.','']
for s in slides:
    transcription.extend([f"## Page {s['data-slide']}",'',s.get_text('\n',strip=True),''])
(OUT/'local-guide-verified-transcription.md').write_text('\n'.join(transcription),'utf-8')

counts=collections.Counter(x.get('matchStatus',x.get('type')) for x in matches)
unmatched=[x for x in matches if x['recommendedSource']==x['file'] and x.get('type')!='svg']
report=['# Аудит локальных материалов photoprobiz.ru','',
'Проверено 7 сентября 2026 года. Исходные файлы сохранены без изменений. Полностью прочитаны и разобраны обе HTML-версии: текст, DOM, формы, ссылки, стили, все скрипты. Главным источником для сравнений служит свежая копия `audit/source/home.html`.','',
'## Файлы и фотографии','',
f'- Всего локальных файлов: {len(local)}; суммарно {sum(x["bytes"] for x in local):,} байт.',
f'- 280 растровых изображений, 45 155 155 байт: 258 JPG, 1 JPEG, 14 WebP, 7 PNG. Отдельно 1 SVG favicon, 2 HTML, 1 PDF, 1 TXT с alt-текстами.',
'- Каждый файл имеет SHA-256; для растра зафиксированы размеры с учётом EXIF-поворота, формат, pHash, dHash и SHA-256 декодированных RGB-пикселей.',
'- `local-assets-inventory.json` — полный реестр всех файлов; `local-images.csv` — удобная таблица размеров и хешей.',
f'- Из 563 URL опубликованных изображений получены 323 уникальных исходника (240 URL были Tilda empty-превью тех же фото). Скачано {sum(x["bytes"] for x in matches):,} байт. Ошибок загрузки/декодирования нет.',
'- Скачанные текущие исходники находятся в `audit/remote-images/`; URL, все алиасы, локальные кандидаты, причины выбора и рекомендованный источник — в `local-remote-matches.json`.',
'- `local-image-mapping.csv` содержит таблицу «Страница / секция / контент / изображение / источник / статус переноса» с опубликованными alt, если они присутствуют.',
'- Результат: 259 опубликованных растров побайтно совпадают с локальными файлами; 26 дополнительно проверены визуально и используют локальный оригинал; 18 сохраняют точный опубликованный вариант. Все 20 SVG сохраняются из локально скачанных опубликованных файлов.',
'- Визуально проверены 44 пары в `local-review-pairs-01.jpg` … `local-review-pairs-08.jpg`. pHash не выявляет различие цвета: автопортрет `dramatichnyy-muzhsko.jpg` на сайте чёрно-белый, а локальный `dramatichnyy-muzhskoy-portret-krupnim-planom.jpg` цветной. Рекомендация — опубликованный Ч/Б файл.',
'- Портрет `6397.webp` соответствует локальному кадру, но имеет отличающееся кадрирование/обработку; оставлен опубликованный вариант. Недостающие локально фото, логотипы клиентов, MAX-иконка и OG-обложка также сохранены с сайта.',
'- Изображения для рекламы в локальных папках не следует добавлять на сайт только из-за их наличия. Манифест выбирает лишь опубликованный контент.',
'', '## Сохранённая главная: существенные различия','',
'`Мой сайт по деловым съемкам.html` (142 135 байт) — ранний самостоятельный Tailwind-макет, не экспорт текущей Tilda. Его нельзя использовать как готовую основу визуально точного переноса.','',
'| Область | Локальный HTML | Текущий сайт |','|---|---|---|',
'| SEO | title «Деловой портрет \\| Профессиональный бизнес-фотограф»; только charset и viewport | Существуют собственные title, description, Open Graph, canonical, verification, favicon и служебные метаданные; брать из свежего аудита |',
'| Типографика/стек | Tailwind CDN, FontAwesome CDN, Google Inter/Montserrat | Отдельные Tilda-блоки и стили; размеры и шрифты сверять с текущим сайтом |',
'| Фото | 48 img: 38 Unsplash, 1 Google Drive, 9 без внешнего src; галереи скрипта используют Unsplash | Собственные опубликованные фотографии/галереи; локальные заглушки не переносить |',
'| Назначение фотосессий | 3 категории | 5: дополнительно «Резюме и поиск работы», «Врачи и клиники» |',
'| Офис | 500+ сотрудников за последний год; старый отзыв Savina | 568 сотрудников; другой полный текст отзыва Savina |',
'| Преимущества | 7 пунктов | 8; добавлен «Результат в реальном времени» |',
'| Команда | Ксения Кирр | Юрий Тыченко в соответствующем блоке; остальные тексты нужно брать из текущего DOM |',
'| Портфолио | Примерные карточки Виктории Ветровой, Милы Колоколовой, Александра Армады, Сергея Иванова | Другой фактический набор имён/описаний и 17 полноценных галерей во всём сайте |',
'| Формы | 2 формы с alert, «Почта или телефон», автоматически отмеченные чекбоксы | Имя, выбор Phone/Telegram/WhatsApp/Max, связанные контактные поля, согласие, варианты пакета; успех ведёт на /thankyou |',
'| Политика/оферта | Только текст чекбоксов; нет полного документа и рабочего сценария открытия | Полный текст политики в popup; юридический контент определён отдельным аудитом текущего сайта |',
'| Гайд | В главной нет ссылки на PDF, локальный guide HTML или thankyou | Сценарий получения PDF после формы через /thankyou |',
'| Футер | © 2024, описание «Профессиональная деловая фотосъемка» | © 2026 и актуальное описание |','',
'Полный текст локальной главной: `local-html-2-full-text.txt`. Все JS-обработчики: `local-html-2-scripts.txt`. Полный машинный разбор обеих HTML: `local-html-inventory.json`. Постатейное сравнение текста главной с текущей: `local-html-2-vs-current.diff`. Различия порядка в DOM Tilda не всегда равны визуальному порядку: он определяется координатами блоков.','',
'## PDF и HTML-гайд','',
'- Локальный PDF: `Идеальный бизнес-портрет. Чек-лист по подготовке.PDF`, 5 712 764 байт, 6 страниц. PDF 1.4; Creator: PDF Presentation Adobe Photoshop; дата создания 11.04.2026.',
'- На всех шести страницах отсутствует текстовый слой. Попытка `get_text()` дала 0 символов, что зафиксировано в `local-guide-pdf-text.txt`; текст не потерян при обработке — он изначально запечён в изображения.',
'- Все 6 страниц успешно отрендерены Poppler в `local-guide-pages/page-1.png` … `page-6.png` и просмотрены. Содержание и оформление полностью читаемы.',
'- Текущая кнопка «Скачать» на /thankyou ведёт на `https://disk.yandex.ru/i/taHh6uKjnoW9KQ?dl=1`.',
'- Этот файл скачан в `local-guide-current-download.pdf` через публичный API Яндекс.Диска; его 5 712 764 байт **побайтно совпадают** с локальным PDF. SHA-256 обоих: `48807f50fa5453dd304457384d648111277863e1e5e4a469b0b77187f0f97574`.',
'- `local-guide-live-metadata.json` содержит полученные метаданные текущего файла; `local-guide-pdf.json` — метаданные/параметры страниц локального PDF.',
'- `biznes-portret-7slides by gemini.html` несмотря на имя содержит **6**, а не 7 слайдов. Их порядок: обложка; введение; гардероб; позирование; вечер перед съёмкой; заключение. Все тексты сверены глазами с соответствующими PDF-страницами.',
'- Полная восстановленная транскрипция по страницам: `local-guide-verified-transcription.md`. Это извлечённый текст HTML-компаньона, вручную сверенный с растром PDF, а не несуществующий текстовый слой PDF.',
'- Гайд использует Playfair Display (заголовки) и DM Sans (текст), кремовый фон `#FCFBF8`, текст `#2A2723`, золотые акценты `#B58D36 / #E0CA94 / #8C6A21`; градиенты, тонкие рамки, SVG-иконки. Растровых img нет; графика inline SVG и CSS.',
'- HTML-гайд: каркас 566×800 максимум, 95vh; при ширине ≤600 или высоте ≤850 полноэкранная высота; ≤480 ширина 100vw. Стрелки, точки, счётчик, ArrowLeft/ArrowRight/Space, свайп >40px; переключение циклично; CSS fading/reveal анимации.',
'- У HTML-гида нет исходящих ссылок и нет защиты доступа; у опубликованного пользовательского сценария ссылка на PDF появляется на /thankyou после формы. Не добавлять пункт гайда в главное меню.',
'- Самое точное автономное поведение: после mock-успеха открыть локальный /thankyou с той же композицией и локальной PDF-ссылкой. Оригинальный локальный PDF подходит без изменения.',
'- Обе локальные HTML-версии не входят в обнаруженные текущие публичные URL сайта. Интерактивный HTML-гайд допустим лишь как дополнительный доступный вариант после успеха формы; он не заменяет приоритетный исходный PDF и не добавляется в публичное основное меню.',
'', '## Ассеты, которые следует брать в опубликованном варианте','',
'| URL-файл | Локально скачанный файл | Причина |','|---|---|---|']
for x in unmatched:report.append(f"| {x['url'].split('/')[-1]} | `{x['file']}` | {x['selectionReason']} |")
report.extend(['','## Проверки и пределы аудита','',
'- Исходники не изменялись; подготовлены только рабочие аудит-файлы и скрипты.',
'- Полное содержимое PDF прочитано визуально; все страницы проверены, не только обложка.',
'- Действующую форму не отправляли; наличие success-url /thankyou подтверждено HTML-атрибутами, а PDF проверен независимым чтением публичной ссылки.',
'- Этот отчёт подтверждает аудит и подбор исходников, но не заявляет React-перенос или pixel-perfect проверку приложения завершёнными.',
'- Первичные скрипты `audit-local-materials.py`, `audit-local-match-remote.py`, `audit-local-review-matches.py`, `audit-local-finalize.py` воспроизводят полный аудит. Запускать последовательно: последний добавляет итоговые решения по ручной проверке.',
''])
(OUT/'local-materials-report.md').write_text('\n'.join(report),'utf-8')
print(json.dumps({'statuses':dict(counts),'visuallyAccepted':accepted,'report':'audit/local-materials-report.md','mappingRows':sum(len(x['uses']) or 1 for x in matches)},ensure_ascii=False,indent=2))

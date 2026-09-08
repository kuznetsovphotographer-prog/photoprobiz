import sys,json,re
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0,str(Path('audit/tooling').resolve()))
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw
soup=BeautifulSoup(Path('audit/source/home.html').read_text('utf-8-sig'),'html.parser')
data=json.loads(Path('audit/source-inventory.json').read_text('utf-8'))
out=['# Полный аудит photoprobiz.ru','Снимок опубликованного сайта: 7 сентября 2026. Источник истины: https://photoprobiz.ru/. Исходный HTML и точные атрибуты сохранены в audit/source.','## Страницы']
for name,p in data.items():
 out += [f'### {name}',p['title'],'```json',json.dumps({'meta':p['meta'],'headLinks':p['headLinks'],'links':p['links']},ensure_ascii=False,indent=2),'```']
 out += ['| Страница | Секция | Контент | Изображение | Источник | Статус переноса |','|---|---|---|---|---|---|']
 for b in p['blocks']:
  out += [f"| {name} | {b['id']} / {b['type']} | {b['text'][:70].replace(chr(10),' ')} | {len(b['images'])} элементов | published HTML | аудит, перенос не начат |"]
 for b in p['blocks']:
  out += [f"### {b['id']} — тип {b['type']}",b['text'],'Изображения и атрибуты:','```json',json.dumps(b['images'],ensure_ascii=False,indent=2),'```']
Path('audit/SITE-AUDIT.md').write_text('\n\n'.join(out),'utf-8')
print('METADATA',json.dumps(data['home']['meta'],ensure_ascii=False))
print('HEADLINKS',json.dumps(data['home']['headLinks'],ensure_ascii=False))
print('ARTBOARDS')
for rec in soup.select('#allrecords > div'):
 art=rec.select_one('.t396__artboard')
 if art: print(rec.get('id'), json.dumps(dict(art.attrs),ensure_ascii=False))
for recid in ['rec2134313191','rec2005519591']:
 rec=soup.find(id=recid)
 Path('audit/source/'+recid+'.html.txt').write_text(rec.prettify(),'utf-8')
for file in Path('output/playwright').glob('original-home-*-initial.png'):
 im=Image.open(file).convert('RGB'); w,h=im.size
 panels=[]
 for y in range(0,h,2000):
  panel=im.crop((0,y,w,min(y+2000,h)));panel.thumbnail((360,500))
  panels.append(panel)
 sheet=Image.new('RGB',(360*6,540*((len(panels)+5)//6)),'#ddd');d=ImageDraw.Draw(sheet)
 for i,panel in enumerate(panels):
  x=(i%6)*360;y=(i//6)*540;sheet.paste(panel,(x,y+30));d.text((x+8,y+8),str(i*2000),fill='black')
 sheet.save('output/playwright/original-overview.jpg',quality=90)
print('Audit document written')

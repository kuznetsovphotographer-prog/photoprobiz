import json,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0,str(Path('audit/tooling').resolve()))
from bs4 import BeautifulSoup
from PIL import Image,ImageDraw
soup=BeautifulSoup(Path('audit/source/home.html').read_text('utf-8-sig'),'html.parser')
data=json.loads(Path('audit/browser-1440.json').read_text('utf-8'))
for b in data['blocks']:
 if b['artboard'] and b['box']['height']>0:
  print(b['id'],'height',b['box']['height'],'art',b['artboard']['box'],'elements',len(b['elements']))
  if b['id']=='rec2134313191':
   for e in b['elements']: print('HERO',e['id'],e['type'],e['box'],e['atomCss'])
print('CUSTOM SCRIPTS AND STYLES')
for rec in soup.select('[data-record-type="131"],[data-record-type="1093"],[data-record-type="270"]'):
 print(str(rec)[:16000])
im=Image.open('output/playwright/original-home-1440.png').convert('RGB')
panels=[]
for i,b in enumerate(data['blocks']):
 if b['box']['height']<10: continue
 y=round(b['box']['y']);h=round(b['box']['height'])
 p=im.crop((0,y,im.width,y+h));p.thumbnail((360,500));panels.append((b['id'],p))
sheet=Image.new('RGB',(360*6,535*((len(panels)+5)//6)),'#dedede');d=ImageDraw.Draw(sheet)
for i,(name,panel) in enumerate(panels):
 x=(i%6)*360;y=(i//6)*535;sheet.paste(panel,(x,y+25));d.text((x+8,y+6),name,fill='black')
sheet.save('output/playwright/original-sections-overview.jpg',quality=90)
for idx in [0,1,2,3,4,5]:
 crop=im.crop((0,idx*4000,1440,min(im.height,(idx+1)*4000)));crop.save(f'output/playwright/original-sections-{idx}.jpg',quality=90)

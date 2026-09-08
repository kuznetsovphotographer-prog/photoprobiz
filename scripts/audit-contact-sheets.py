import sys,json
from pathlib import Path
sys.path.insert(0,str(Path('audit/tooling').resolve()))
from PIL import Image,ImageDraw
d=json.loads(Path('audit/browser-1440.json').read_text('utf-8'))
files=[(b['id'],Path(f"output/playwright/original-1440-{b['id']}.png")) for b in d['blocks'] if b['box']['height']>10]
for group in range(3):
 sheet=Image.new('RGB',(1440,1280),'#ddd');draw=ImageDraw.Draw(sheet)
 for i,(name,file) in enumerate(files[group*12:(group+1)*12]):
  im=Image.open(file).convert('RGB');im.thumbnail((360,390));x=i%4*360;y=i//4*426;sheet.paste(im,(x,y+22));draw.text((x+5,y+5),name,fill='black')
 sheet.save(f'output/playwright/original-summary-{group}.jpg',quality=90)

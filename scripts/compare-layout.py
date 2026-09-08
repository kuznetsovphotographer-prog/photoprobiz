import sys,json,re
from pathlib import Path
sys.path.insert(0,str(Path('audit/tooling').resolve()))
sys.stdout.reconfigure(encoding='utf-8')
from PIL import Image,ImageChops,ImageDraw
import numpy as np
width=int(sys.argv[1]) if len(sys.argv)>1 else 1440
log=Path(f'audit/local-{width}.log').read_text('utf-8-sig')
actual=json.JSONDecoder().raw_decode(log[log.index('### Result')+11:].lstrip())[0]
Path(f'audit/local-{width}.json').write_text(json.dumps(actual,ensure_ascii=False),'utf-8')
original=json.loads(Path(f'audit/browser-{width}.json').read_text('utf-8'))
sections=json.loads(Path('src/data/sections.json').read_text('utf-8'))
records={b['id']:b for b in original['blocks']};local={b['id']:b for b in actual['sections']}
nodes={n['id']:n for n in actual['nodes']}
nodeMap=json.loads(Path('audit/migrated-nodes.json').read_text('utf-8'))
comparison=[];visual=[];big=[]
for s in sections:
 if s['id']=='header':continue
 a=local[s['id']];b=records[s['source']]['box'];dy=a['y']-b['y'];dh=a['height']-b['height']
 comparison.append({'id':s['id'],'yDelta':round(dy,2),'heightDelta':round(dh,2)})
 before=Path(f"output/playwright/original-{width}-{s['source']}.png");after=Path(f"output/playwright/local-{width}-{s['id']}.png")
 if before.exists() and after.exists():
  im1=Image.open(before).convert('RGB');im2=Image.open(after).convert('RGB')
  if im1.size==im2.size:
   arr=np.abs(np.asarray(im1).astype(float)-np.asarray(im2).astype(float));m=float(arr.mean());changed=float((arr.max(axis=2)>40).mean()*100)
   visual.append({'id':s['id'],'mae':round(m,3),'changedOver40Percent':round(changed,2)})
   if changed>3:
    im1.thumbnail((720,1200));im2.thumbnail((720,1200));sheet=Image.new('RGB',(1440,max(im1.height,im2.height)+25),'#ddd');sheet.paste(im1,(0,25));sheet.paste(im2,(720,25));ImageDraw.Draw(sheet).text((8,5),'Original / Local: '+s['id'],fill='black');sheet.save(f"output/playwright/diff-{width}-{s['id']}.jpg",quality=90)
for nm in nodeMap:
 rec=records.get(nm['sourceBlock']);a=nodes.get(nm['class'])
 if not a or not rec:continue
 old=next((e for e in rec['elements'] if e['id']==nm['key']),None)
 if not old or a['display']=='none' or old['css']['display']=='none':continue
 # Relative positions distinguish actual composition errors from upstream offsets.
 asec=local.get(nm['section']);bsec=rec['box'];b=old['box']
 delta={'x':round(a['x']-b['x'],2),'y':round((a['y']-asec['y'])-(b['y']-bsec['y']),2),'w':round(a['width']-b['width'],2),'h':round(a['height']-b['height'],2)}
 if max(abs(v) for v in delta.values())>2:big.append({**nm,**delta})
report={'width':width,'height':actual['height'],'originalHeight':original['height'],'overflow':actual['overflow'],'brokenImages':[i for i in actual['images'] if not i['complete'] or not i['width']],'sections':comparison,'visual':visual,'nodeDifferencesOver2px':big}
Path(f'audit/comparison-{width}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
print('Width',width,'height',actual['height'],'original',original['height'],'overflow',actual['overflow'],'brokenImages',len(report['brokenImages']))
print('Section deltas',comparison)
print('Visual',visual)
print('Node deltas >2px',len(big),big[:12])

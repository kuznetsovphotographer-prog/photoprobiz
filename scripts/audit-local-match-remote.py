import sys, json, re, hashlib, time, urllib.request, concurrent.futures
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'audit/tooling'))
from PIL import Image, ImageOps, ImageDraw, ImageFont
import imagehash
OUT=ROOT/'audit'
REMOTE=OUT/'remote-images'
REMOTE.mkdir(exist_ok=True)
source=json.loads((OUT/'source-inventory.json').read_text('utf-8'))
local=json.loads((OUT/'local-assets-inventory.json').read_text('utf-8'))
images=[x for x in local if 'width' in x]
url_pages={}
for page,data in source.items():
    for url in data['images']:url_pages.setdefault(url,[]).append(page)
def normalize(url):
    return url.replace('https://thb.tildacdn.com/','https://static.tildacdn.com/').replace('/-/empty/','/')
canonical={}
for url,pages in url_pages.items():
    c=normalize(url)
    canonical.setdefault(c,{'aliases':[],'pages':set()})
    canonical[c]['aliases'].append(url)
    canonical[c]['pages'].update(pages)

def fetch(item):
    url,detail=item
    filename=hashlib.sha256(url.encode()).hexdigest()[:12]+'-'+unquote(urlsplit(url).path.split('/')[-1])
    target=REMOTE/filename
    result={'url':url,'aliases':detail['aliases'],'pages':sorted(detail['pages']),'file':str(target.relative_to(ROOT))}
    if not target.exists():
        for attempt in range(3):
            try:
                req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://photoprobiz.ru/'})
                with urllib.request.urlopen(req,timeout=45) as response:
                    content=response.read()
                    result['httpStatus']=response.status
                    result['contentType']=response.headers.get('Content-Type')
                target.write_bytes(content)
                break
            except Exception as e:
                result['error']=str(e)
                if attempt<2:time.sleep(1+attempt)
        if not target.exists():return result
        result.pop('error',None)
    content=target.read_bytes()
    result['bytes']=len(content)
    result['sha256']=hashlib.sha256(content).hexdigest()
    if target.suffix.lower()=='.svg':
        result['type']='svg'
        result['exactLocalMatches']=[x['path'] for x in local if x['sha256']==result['sha256']]
        return result
    try:
        with Image.open(target) as raw:
            result['format']=raw.format
            im=ImageOps.exif_transpose(raw).convert('RGB')
            result['width'],result['height']=im.size
            p=imagehash.phash(im);d=imagehash.dhash(im)
            result['phash']=str(p);result['dhash']=str(d)
            result['pixelSha256']=hashlib.sha256(im.tobytes()).hexdigest()
        candidates=[]
        for x in images:
            pd=int(p-imagehash.hex_to_hash(x['phash']));dd=int(d-imagehash.hex_to_hash(x['dhash']))
            aspect_delta=abs(result['width']/result['height']-x['width']/x['height'])/(result['width']/result['height'])
            candidates.append({'local':x['path'],'width':x['width'],'height':x['height'],'bytes':x['bytes'],'phashDistance':pd,'dhashDistance':dd,'aspectDelta':round(aspect_delta,5),'sameSha256':x['sha256']==result['sha256'],'samePixels':x['pixelSha256']==result['pixelSha256']})
        candidates.sort(key=lambda x:(not x['sameSha256'],not x['samePixels'],x['phashDistance']+x['dhashDistance'],x['aspectDelta']))
        result['candidates']=candidates[:3]
        c=candidates[0]
        if c['sameSha256']:result['matchStatus']='byte-identical'
        elif c['samePixels']:result['matchStatus']='pixel-identical'
        elif c['phashDistance']<=2 and c['dhashDistance']<=2 and c['aspectDelta']<=.005:result['matchStatus']='high-confidence-perceptual'
        elif c['phashDistance']<=8 and c['dhashDistance']<=10 and c['aspectDelta']<=.03:result['matchStatus']='review-perceptual'
        else:result['matchStatus']='use-published-source'
    except Exception as e:result['imageError']=str(e)
    return result

results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
    jobs={pool.submit(fetch,x):x[0] for x in canonical.items()}
    for job in concurrent.futures.as_completed(jobs):
        r=job.result();results.append(r)
        if len(results)%25==0:print(f'Downloaded / analysed {len(results)}/{len(canonical)}',flush=True)
results.sort(key=lambda x:x['url'])
(OUT/'local-remote-matches.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),'utf-8')

# Compact pairs are for explicit visual verification of matches where compression or resolution differ.
review=[x for x in results if x.get('matchStatus') in ['high-confidence-perceptual','review-perceptual']]
for sheet_start in range(0,len(review),20):
    part=review[sheet_start:sheet_start+20]
    sheet=Image.new('RGB',(1200,240*len(part)), '#dddddd');draw=ImageDraw.Draw(sheet)
    for row,x in enumerate(part):
        c=x['candidates'][0]
        for col,p in enumerate([ROOT/x['file'],ROOT/c['local']]):
            with Image.open(p) as raw:
                thumb=ImageOps.exif_transpose(raw).convert('RGB');thumb.thumbnail((500,200))
                sheet.paste(thumb,(col*600+(500-thumb.width)//2,row*240+30))
        label=f'{sheet_start+row:03d} {Path(x["file"]).name[:50]} P{c["phashDistance"]}/D{c["dhashDistance"]}'
        draw.text((10,row*240+7),label,fill='black')
        draw.text((610,row*240+7),Path(c['local']).name[:70],fill='black')
    sheet.save(OUT/f'local-match-contact-{sheet_start//20+1:02d}.jpg',quality=90)
counts={}
for x in results:counts[x.get('matchStatus',x.get('type','error'))]=counts.get(x.get('matchStatus',x.get('type','error')),0)+1
print(json.dumps({'downloads':len(results),'bytes':sum(x.get('bytes',0) for x in results),'statuses':counts,'errors':[x for x in results if 'error'in x or 'imageError'in x]},ensure_ascii=False,indent=2))

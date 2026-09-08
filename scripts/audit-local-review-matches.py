import sys,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'audit/tooling'))
from PIL import Image,ImageOps,ImageDraw,ImageStat,ImageChops
OUT=ROOT/'audit'
items=json.loads((OUT/'local-remote-matches.json').read_text('utf-8'))
review=[x for x in items if x.get('matchStatus') in ['high-confidence-perceptual','review-perceptual','use-published-source']]
for x in review:
    c=x['candidates'][0]
    with Image.open(ROOT/x['file']) as raw: a=ImageOps.exif_transpose(raw).convert('RGB').resize((192,192))
    with Image.open(ROOT/c['local']) as raw:b=ImageOps.exif_transpose(raw).convert('RGB').resize((192,192))
    stats=ImageStat.Stat(ImageChops.difference(a,b));c['rgbMeanAbsoluteError']=round(sum(stats.mean)/3,3)
    x['visualReviewId']=len([z for z in review[:review.index(x)]])
for offset in range(0,len(review),6):
    part=review[offset:offset+6]
    sheet=Image.new('RGB',(1400,300*len(part)), '#eeeeee');draw=ImageDraw.Draw(sheet)
    for row,x in enumerate(part):
        c=x['candidates'][0]
        for col,p in enumerate([ROOT/x['file'],ROOT/c['local']]):
            with Image.open(p) as raw:
                im=ImageOps.exif_transpose(raw).convert('RGB');im.thumbnail((660,255))
                sheet.paste(im,(col*700+(660-im.width)//2,row*300+35))
        draw.text((10,row*300+5),f'{offset+row:02d}: REMOTE {Path(x["file"]).name}',fill='black')
        draw.text((710,row*300+5),f'LOCAL P{c["phashDistance"]}/D{c["dhashDistance"]}/color {c["rgbMeanAbsoluteError"]}',fill='black')
    sheet.save(OUT/f'local-review-pairs-{offset//6+1:02d}.jpg',quality=90)
(OUT/'local-remote-matches.json').write_text(json.dumps(items,ensure_ascii=False,indent=2),'utf-8')
print('Review sheets',math.ceil(len(review)/6),'pairs',len(review))

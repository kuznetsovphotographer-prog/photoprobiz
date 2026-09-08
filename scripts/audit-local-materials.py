import sys, json, re, hashlib, csv, difflib
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'audit/tooling'))
from bs4 import BeautifulSoup
from PIL import Image, ImageOps, ImageDraw
import imagehash
import fitz

LOCAL = ROOT / 'Фотографии для сайта по деловым съемкам'
OUT = ROOT / 'audit'
OUT.mkdir(exist_ok=True)

def dump(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def parse_html(p):
    raw = p.read_text('utf-8-sig')
    soup = BeautifulSoup(raw, 'html.parser')
    clean = BeautifulSoup(raw, 'html.parser')
    for noise in clean.select('script,style'): noise.decompose()
    return {
        'path': str(p.relative_to(ROOT)), 'bytes':p.stat().st_size, 'sha256':sha(p),
        'title': soup.title.get_text() if soup.title else '',
        'meta': [dict(x.attrs) for x in soup.select('meta')],
        'headLinks':[dict(x.attrs) for x in soup.select('head link')],
        'headings':[{'tag':x.name,'text':x.get_text(' ',strip=True)} for x in soup.select('h1,h2,h3,h4,h5,h6')],
        'sections':[{'tag':x.name,'id':x.get('id'),'class':x.get('class'),'text':x.get_text('\n',strip=True)} for x in clean.select('section, header, footer')],
        'images':[dict(x.attrs) for x in soup.select('img')],
        'imageUrls': sorted(set(re.findall(r'https?://[^\s<>"\x27)]+?\.(?:jpg|jpeg|webp|png|svg|gif|avif)(?:\?[^\s<>"\x27)]*)?', raw, re.I))),
        'links':[{'href':x.get('href'),'text':x.get_text(' ',strip=True)} for x in soup.select('a[href]')],
        'forms':[str(x) for x in soup.select('form')],
        'scripts':[{'attrs':dict(x.attrs),'content':x.get_text()} for x in soup.select('script')],
        'styles':[x.get_text() for x in soup.select('style')],
        'text':clean.get_text('\n',strip=True),
    }

htmls={p.stem:parse_html(p) for p in LOCAL.glob('*.html')}
live=parse_html(OUT/'source/home.html')
dump('local-html-inventory.json',htmls)
for i,(name,item) in enumerate(htmls.items(),1):
    (OUT/f'local-html-{i}-full-text.txt').write_text(item['text'],'utf-8')
    (OUT/f'local-html-{i}-scripts.txt').write_text('\n\n'.join(x['content'] for x in item['scripts']),'utf-8')
    (OUT/f'local-html-{i}-styles.css').write_text('\n\n'.join(item['styles']),'utf-8')
    (OUT/f'local-html-{i}-vs-current.diff').write_text('\n'.join(difflib.unified_diff(item['text'].splitlines(),live['text'].splitlines(),fromfile=item['path'],tofile=live['path'],lineterm='')),'utf-8')

inventory=[]
for p in sorted(LOCAL.rglob('*')):
    if not p.is_file(): continue
    entry={'path':str(p.relative_to(ROOT)), 'relativePath':str(p.relative_to(LOCAL)), 'name':p.name, 'suffix':p.suffix.lower(), 'bytes':p.stat().st_size, 'sha256':sha(p)}
    if p.suffix.lower() in ['.jpg','.jpeg','.png','.webp','.avif','.gif']:
        try:
            with Image.open(p) as orig:
                entry['format']=orig.format
                entry['storedWidth'],entry['storedHeight']=orig.size
                im=ImageOps.exif_transpose(orig).convert('RGB')
                entry['width'],entry['height']=im.size
                entry['phash']=str(imagehash.phash(im))
                entry['dhash']=str(imagehash.dhash(im))
                entry['pixelSha256']=hashlib.sha256(im.tobytes()).hexdigest()
        except Exception as e:entry['error']=str(e)
    inventory.append(entry)
dump('local-assets-inventory.json',inventory)
images=[x for x in inventory if 'width' in x]
with (OUT/'local-images.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=['relativePath','width','height','format','bytes','sha256','phash','dhash'])
    writer.writeheader()
    for x in images:writer.writerow({k:x[k] for k in writer.fieldnames})

source=json.loads((OUT/'source-inventory.json').read_text('utf-8'))
url_pages={}
for page, data in source.items():
    for url in data['images']:url_pages.setdefault(url,[]).append(page)
name_matches=[]
for url,pages in url_pages.items():
    name=unquote(Path(urlsplit(url).path).name)
    exact=[x['path'] for x in images if x['name'].lower()==name.lower()]
    name_matches.append({'url':url,'pages':pages,'basename':name,'exactNameMatches':exact})
dump('local-image-url-name-matches.json',name_matches)

pdf=next(LOCAL.glob('*.PDF'))
doc=fitz.open(pdf)
pdf_pages=[]
render_dir=OUT/'local-guide-pages'
render_dir.mkdir(exist_ok=True)
for idx,page in enumerate(doc):
    pdf_pages.append({'page':idx+1,'widthPt':page.rect.width,'heightPt':page.rect.height,'text':page.get_text(),'images':len(page.get_images()),'links':page.get_links(),'fonts':page.get_fonts()})
    # PDF content is inspected via Poppler renders below; this supplies extraction only.
dump('local-guide-pdf.json',{'path':str(pdf.relative_to(ROOT)),'bytes':pdf.stat().st_size,'sha256':sha(pdf),'metadata':doc.metadata,'pageCount':len(doc),'pages':pdf_pages})
(OUT/'local-guide-pdf-text.txt').write_text('\n\n'.join(f'PAGE {x["page"]}\n{x["text"]}' for x in pdf_pages),'utf-8')
print(json.dumps({'files':len(inventory),'images':len(images),'imageBytes':sum(x['bytes'] for x in images),'html':{k:{'title':v['title'],'headings':v['headings'],'sections':len(v['sections']),'images':len(v['images'])} for k,v in htmls.items()},'liveImageUrls':len(url_pages),'urlBasenameMatches':sum(bool(x['exactNameMatches']) for x in name_matches),'pdfPages':len(doc),'pdfTextCharacters':sum(len(x['text']) for x in pdf_pages)},ensure_ascii=False,indent=2))

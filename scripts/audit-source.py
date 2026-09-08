import sys, json, re, hashlib
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
sys.path.insert(0, str(Path('audit/tooling').resolve()))
from bs4 import BeautifulSoup

root = Path('audit/source')
inventory = {}
for file in root.glob('*.html'):
    soup = BeautifulSoup(file.read_text('utf-8-sig'), 'html.parser')
    page = {'title': soup.title.get_text() if soup.title else '', 'meta': [dict(x.attrs) for x in soup.select('meta')], 'headLinks': [dict(x.attrs) for x in soup.select('head link')], 'links': [], 'blocks': [], 'scripts': [], 'images': []}
    for a in soup.select('[href]'):
        if a.name != 'link': page['links'].append({'href': a.get('href'), 'text': a.get_text(' ', strip=True)})
    for s in soup.select('script'):
        body = s.string or s.get_text()
        page['scripts'].append({'src':s.get('src'), 'type':s.get('type'), 'length':len(body), 'body':body if not s.get('src') else ''})
    for rec in soup.select('#allrecords > div'):
        clean = BeautifulSoup(str(rec), 'html.parser')
        for noise in clean.select('script,style'): noise.decompose()
        blocks = {'id': rec.get('id'), 'type':rec.get('data-record-type'), 'class':rec.get('class'), 'text':clean.get_text('\n', strip=True), 'headings': [{'tag':h.name, 'text':h.get_text(' ',strip=True)} for h in rec.select('h1,h2,h3,h4,h5,h6')], 'images':[], 'forms':[], 'popups':[]}
        for e in rec.select('[src],[data-original],[data-img-zoom-url],[data-bg]'):
            attrs={k:v for k,v in e.attrs.items() if k in ['src','data-original','data-img-zoom-url','alt','data-bg','class','data-elem-id']}
            blocks['images'].append(attrs)
        for form in rec.select('form,[data-inputbox]'):
            blocks['forms'].append(str(form))
        blocks['popups'] = [dict(x.attrs) for x in rec.select('[data-tooltip-hook],[data-slider-id],[data-success-url],[data-success-popup]')]
        page['blocks'].append(blocks)
    page['images'] = sorted(set(re.findall(r'https?://[^\s<>"\x27)]+?\.(?:jpg|jpeg|webp|png|svg|gif|avif)(?:\?[^\s<>"\x27)]*)?', str(soup), re.I)))
    inventory[file.stem] = page
Path('audit/source-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2),'utf-8')
for key,p in inventory.items():
    print('\nPAGE',key,p['title'])
    print('LINKS',json.dumps(list({x['href'] for x in p['links']}),ensure_ascii=False))
    print('BLOCKS',len(p['blocks']),'IMAGES',len(p['images']))
    for b in p['blocks']: print(b['id'],b['type'],len(b['text']),b['text'][:180].replace('\n',' | '))

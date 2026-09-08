import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = {}
for path in (root / 'audit').glob('browser-*.json'):
    try:
        source = json.loads(path.read_text(encoding='utf-8-sig'))
    except (ValueError, OSError):
        continue
    data[source['width']] = source
widths = sorted(data)
rows = [['record', 'first_text', *map(str, widths)]]
source = data[1440]
for block in source['blocks']:
    if block['box']['height'] < 1:
        continue
    text = next((e.get('html', '') for e in block['elements'] if e['type'] == 'text'), '')
    text = text.replace('\n', ' ').replace('|', '')[:120]
    rows.append([block['id'], text, *[str(next(b['box']['height'] for b in data[w]['blocks'] if b['id'] == block['id'])) for w in widths]])
(root / 'audit' / 'responsive-heights.tsv').write_text('\n'.join('\t'.join(row) for row in rows), encoding='utf-8')

result = {'widths': widths, 'summary': []}
keys = ['rec2000391521', 'rec2134313191', 'rec2005510351', 'rec2005519591', 'rec2006104721', 'rec2010353871', 'rec2010560351', 'rec2010968521', 'rec2011163991']
for width in widths:
    page = data[width]
    details = []
    for key in keys:
        block = next(b for b in page['blocks'] if b['id'] == key)
        texts = [e for e in block['elements'] if e['type'] == 'text' and e['box']['width'] and e['box']['x'] < width and e['box']['x'] + e['box']['width'] > 0]
        details.append({'id': key, 'h': block['box']['height'], 'boardH': block['artboard']['box']['height'], 'texts': [{ 'id': e['id'], 'box': e['box'], 'zoom': e['css'].get('zoom'), 'size': e.get('atomCss', {}).get('fontSize'), 'lineHeight': e.get('atomCss', {}).get('lineHeight'), 'html': e['html']} for e in texts]})
    result['summary'].append({'width': width, 'height': page['height'], 'visibleBlocks': len([b for b in page['blocks'] if b['box']['height']]), 'details': details})
(root / 'audit' / 'responsive-summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps([{k: v for k, v in page.items() if k != 'details'} for page in result['summary']], ensure_ascii=False))

import json,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
def read(p):return json.loads(Path(p).read_text('utf-8'))
source=read('audit/source-inventory.json')
assets=read('audit/local-remote-matches.json')
galleries=read('audit/secondary-galleries.json')
widths=[320,480,640,960,961,1200]
def walk(nodes):return [node for n in nodes for node in [n]+walk(n['children'])]
layouts={w:read(f'audit/layout-{w}.json') for w in widths}
sig=lambda data:[(b['id'],[(n['kind'],n['key'],n['tag']) for n in walk(b['nodes'])]) for b in data['blocks']]
signatures={w:sig(d) for w,d in layouts.items()}
print('Asset manifest:',len(assets),'sources, all exist:',all(Path(a['approvedSource']).exists() for a in assets))
print('Galleries:',len(galleries),'photos:',sum(len(x['images']) for x in galleries.values()))
print('Layout tree:',len(layouts[1200]['blocks']),'blocks;',sum(len(walk(b['nodes'])) for b in layouts[1200]['blocks']),'nodes')
print('Layout tree stable across all six base widths:',all(s==signatures[1200] for s in signatures.values()))
print('Base layouts:',', '.join(map(str,widths)))
print('JSON-LD:',[(p,sum(s['type']=='application/ld+json' for s in d['scripts'])) for p,d in source.items()])
print('Source head meta:',{p:len([m for m in d['meta'] if 'itemprop' not in m]) for p,d in source.items()})

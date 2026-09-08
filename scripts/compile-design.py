"""One-time migration compiler: measured design values -> framework-free CSS/data.

This is an audit tool, not a runtime/build dependency. npm builds consume the
checked-in src/data/sections.json and src/styles/composition.css only.
"""
import json,re,sys,hashlib
from pathlib import Path
sys.path.insert(0,str(Path('audit/tooling').resolve()))
sys.stdout.reconfigure(encoding='utf-8')
from bs4 import BeautifulSoup

OUT=Path('src/data');OUT.mkdir(parents=True,exist_ok=True)
Path('src/styles').mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads(Path(p).read_text('utf-8'))
WIDTHS=[320,480,640,960,961,1200]
layouts={w:read(f'audit/layout-{w}.json') for w in WIDTHS}
assets=read('src/data/assets.json') if Path('src/data/assets.json').exists() else {}
galleries=read('src/data/galleries.json')
buttonicons={(x['rec'].replace('rec',''),x['key']):x for x in read('audit/button-icons.json')}
buttoncontent={int(w):{(x['rec'].replace('rec',''),x['key']):x for x in values} for w,values in read('audit/button-content.json').items()}
source=BeautifulSoup(Path('audit/source/home.html').read_text('utf-8-sig'),'html.parser')
meta=read('audit/source-inventory.json')
slugmap={
'2000391521':'header','2005333161':'mobile-menu','2134313191':'hero',
'2005510351':'services-title','2005519591':'experts','2005676131':'employees','2005803721':'digital','2135554001':'career','2168638791':'medicine',
'2005914961':'office-title','2006104721':'office-content','2011788721':'savina-review','2007045571':'office-booking',
'2007102781':'studio-content','2007197021':'outdoor','2021736471':'eduard-review','2021753111':'studio-booking',
'2007527121':'benefits-title','2007569591':'locations','2008773901':'posing','2008886241':'wardrobe','2008991961':'retouch','2009307491':'confidentiality','2009366361':'equipment','2009415221':'tethering','2009493001':'team',
'2025351811':'stanislav-review','2008754811':'about','2010067801':'process-title','2010064731':'process','2010239321':'delivery',
'2010353871':'pricing-content','2010560351':'additional-pricing','2010665491':'inquiry','2010800191':'clients','2010968521':'portfolio-content','2011095361':'instagram','2011163991':'footer','2015812641':'contact-design','2020520301':'privacy-design'}
anchors={'services-title':'services','office-title':'office','studio-content':'studio','benefits-title':'benefits','pricing-content':'pricing','portfolio-content':'portfolio'}
sourcekeys={}
for rec in source.select('[data-record-type="396"]'):
 for n in rec.select('[data-elem-id],[data-group-id]'):
  key=n.get('data-elem-id') or n.get('data-group-id')
  sourcekeys[(rec.get('id','').replace('rec',''),key)]=n

def normalize_url(url):
 url=url.replace('&amp;','&')
 match=re.search(r'/(tild[^/]+)/',url)
 if match:return 'https://static.tildacdn.com/'+match.group(1)+'/'+url.split('/')[-1].split('?')[0]
 return url
def asset(url):
 normalized=normalize_url(url)
 direct=assets.get(url) or assets.get(normalized) or assets.get(re.sub(r'(\.(?:jpg|jpeg|png|JPG))\.webp$',r'\1',normalized))
 if direct:return direct
 token=re.search(r'/(tild[^/]+)/',url)
 if token:return next((a for u,a in assets.items() if '/'+token[1]+'/' in u),None)
def replace_urls(text):
 return re.sub(r'https?://[^\s<>"\x27)]+',lambda m:(asset(m[0]) or {}).get('src',m[0]),text)
def clean_html(text,icon=None):
 soup=BeautifulSoup(text or '', 'html.parser')
 button=soup.select_one('.tn-atom__button-content');label=soup.select_one('.tn-atom__button-text')
 iconnode=soup.select_one('.tn-atom__button-icon')
 if iconnode and icon:
  iconnode['style']=f"display:inline-block;flex:none;width:{icon['width']};height:{icon['height']};background-image:{replace_urls(icon['icon'])};background-size:contain;background-repeat:no-repeat;--hover-icon:{replace_urls(icon['hover'])}"
  iconnode['style']=iconnode['style'].replace("url('icons/","url('/icons/")
  iconnode['aria-hidden']='true'
  iconnode.parent['style']='display:flex;align-items:center;justify-content:center;column-gap:'+icon['parent']['gap'].split()[-1]
 for n in soup.select('script,style,iframe,link'):n.decompose()
 for n in soup.find_all(True):
  if n.name=='svg' and not n.get('aria-label'):
   n.attrs.pop('role',None);n.attrs.pop('aria-label',None);n['aria-hidden']='true';n['focusable']='false'
  for attr in list(n.attrs):
   if attr.startswith('on') or attr.startswith('data-') or attr in ['field','class']:del n[attr]
  if n.get('src'):n['src']=replace_urls(n['src'])
  if n.get('href') and n['href'].startswith('javascript:'):del n['href']
  if n.get('style'):
   n['style']=replace_urls(n['style']).replace('var(--t-text-font,Arial)',"'TildaSans',Arial,sans-serif").replace('var(--t-headline-font,Arial)',"'TildaSans',Arial,sans-serif")
 if button:button['class']='button-content'
 if label:label['class']='button-text'
 return str(soup)

# Computed defaults are shared rather than repeated for every element.
defaults={'position':'static','top':'auto','left':'auto','minWidth':'0px','maxWidth':'none','minHeight':'0px','maxHeight':'none','boxSizing':'content-box','flexDirection':'row','flexWrap':'nowrap','flexGrow':'0','flexShrink':'1','flexBasis':'auto','order':'0','alignItems':'normal','alignSelf':'auto','alignContent':'normal','justifyContent':'normal','columnGap':'normal','rowGap':'normal','overflowX':'visible','overflowY':'visible','paddingTop':'0px','paddingRight':'0px','paddingBottom':'0px','paddingLeft':'0px','marginTop':'0px','marginRight':'0px','marginBottom':'0px','marginLeft':'0px','fontFamily':'"Times New Roman"','fontSize':'16px','fontWeight':'400','fontStyle':'normal','lineHeight':'normal','letterSpacing':'normal','textTransform':'none','textAlign':'start','verticalAlign':'baseline','whiteSpace':'normal','textDecorationLine':'none','textDecorationColor':'rgb(0, 0, 0)','color':'rgb(0, 0, 0)','backgroundColor':'rgba(0, 0, 0, 0)','backgroundImage':'none','backgroundSize':'auto','backgroundPosition':'0% 0%','backgroundRepeat':'repeat','borderTopWidth':'0px','borderRightWidth':'0px','borderBottomWidth':'0px','borderLeftWidth':'0px','borderStyle':'none','borderColor':'rgb(0, 0, 0)','borderTopLeftRadius':'0px','borderTopRightRadius':'0px','borderBottomLeftRadius':'0px','borderBottomRightRadius':'0px','boxShadow':'none','filter':'none','transform':'none','opacity':'1','zIndex':'auto','cursor':'auto','zoom':'1','objectFit':'fill','objectPosition':'50% 50%'}
omit={'right','bottom','transformOrigin','zoom'}
def cssname(name):return re.sub('[A-Z]',lambda m:'-'+m[0].lower(),name)
def declarations(vals):return ';'.join(cssname(k)+':'+v for k,v in vals.items())

def field(original,name,width):
 if original is None:return None
 for w in [320,480,640,960,961]:
  if w>=width and original.has_attr(f'data-field-{name}-res-{w}-value'):return original[f'data-field-{name}-res-{w}-value']
 return original.get(f'data-field-{name}-value')

def styles(node,width,root=False,blockid=None,original=None,owner=None):
 s={k:v for k,v in node['css'].items() if k not in omit}
 for k,v in list(s.items()):
  s[k]=replace_urls(v)
  if k=='backgroundImage' and 'url(' in v:s[k]='none' # native responsive picture instead
 # Only root positions depend on the viewport; nested groups retain local units.
 if root and s.get('position') in ['absolute','fixed'] and s['left'].endswith('px'):
  base=960 if width==961 else width
  offset=float(s['left'][:-2])-width/2
  s['left']=f'calc(50% + {offset:g}px)'
 if field(original,'widthunits',width)=='%' and field(original,'container',width)=='window':
  s['width']=field(original,'width',width)+'%'
  if root:
   fraction=float(field(original,'width',width))/100
   axis=field(original,'axisx',width)
   slope=(1-fraction)/2 if axis=='center' else 1-fraction if axis=='right' else 0
   offset=float(node['css']['left'][:-2])-slope*width
   s['left']=f'calc({slope*100:g}% + {offset:g}px)'
   if width==320:s['zoom']='calc(1 / var(--mobile-scale))'
 elif original is None and field(owner,'widthunits',width)=='%' and field(owner,'container',width)=='window':
  s['width']='100%'
 if width!=320:s['zoom']='1'
 # Transform origin is necessary for the two skewed title ribbons.
 if s.get('transform')!='none':s['transformOrigin']=node['css']['transformOrigin']
 return s

allrules={w:[] for w in WIDTHS};sections=[];index=0;usedassets=set();unresolved=set();auditnodes=[]
def flatten(nodes):return [n for x in nodes for n in [x]+flatten(x['children'])]
visibility=read('audit/visibility.json')
defaults['pointerEvents']='auto'
for width in WIDTHS:
 for block,extra in zip(layouts[width]['blocks'],visibility[str(width)]):
  nodes=flatten(block['nodes']);assert len(nodes)==len(extra['nodes'])
  for n,v in zip(nodes,extra['nodes']):
   assert n['key']==v['key'];n['css']['pointerEvents']=v['pointerEvents']
for bi,block in enumerate(layouts[1200]['blocks']):
 bid=block['id'];slug=slugmap[bid]
 if slug in ['mobile-menu','contact-design','privacy-design']:continue
 trees={w:layouts[w]['blocks'][bi] for w in WIDTHS}
 for w,t in trees.items():
  c=t['css'];parent=t['parentCss']; h=float(c['height'].replace('px',''))
  art={'height':f'{h:g}px','backgroundColor':c['backgroundColor'],'backgroundImage':c['backgroundImage'],'overflowX':c['overflowX'],'overflowY':c['overflowY']}
  if slug=='inquiry':art['height']=f'calc({h:g}px + var(--form-growth, 0px))'
  if slug=='header':art.update(position='relative',zIndex='990')
  allrules[w].append((f'.section-{slug} .canvas',art))
  allrules[w].append((f'.section-{slug}',{k:parent[k] for k in ['paddingTop','paddingBottom','backgroundColor']}))
  # Most phone sections upscale their entire authored 320px composition.
  upscale=t['attrs'].get('data-artboard-upscale-res-320')=='window'
  if w==320 and upscale:
   allrules[w].append((f'.section-{slug} .canvas',{'width':'320px','zoom':'var(--mobile-scale)','marginLeft':'0','marginRight':'0'}))
   measure=f'({h:g}px + var(--form-growth, 0px))' if slug=='inquiry' else f'{h:g}px'
   allrules[w].append((f'.section-{slug}',{'height':f'round(down, calc({measure} * var(--mobile-scale)), 1px)'}))
  elif w==320:
   allrules[w].append((f'.section-{slug} .canvas',{'width':'100%','zoom':'1'}))
  else:
   allrules[w].append((f'.section-{slug} .canvas',{'width':'100%','zoom':'1'}))
   allrules[w].append((f'.section-{slug}',{'height':'auto'}))
 fs={w:flatten(t['nodes']) for w,t in trees.items()}
 pos={id(n):i for i,n in enumerate(fs[1200])}
 def convert(n,root=False,owner=None):
  global index
  index+=1;cls=f'n{index}';i=pos[id(n)]
  key=n['key'];original=sourcekeys.get((bid,key)) if key else None
  if original:owner=original
  kind=n['kind'];elemtype=original.get('data-elem-type') if original else None
  tag=n['tag'];attrs={k:v for k,v in n['attrs'].items() if k in ['href','target','rel','aria-label','title','role','tabindex']}
  # Browser adds role=button to anchors; native anchors retain their semantics.
  if tag=='a':attrs.pop('role',None);attrs.pop('tabindex',None)
  if tag=='a' and not attrs.get('aria-label'):
   href=attrs.get('href','')
   label=galleries.get(href,{}).get('title') or {'#mobilemenu':'Открыть меню','#about':'Об авторе','#popup:contacts':'Контакты','#popup:myorder':'Заказать фотосессию'}.get(href)
   if not label:
    label='Instagram' if 'instagram.com/' in href else 'ВКонтакте' if 'vk.com/' in href else 'Telegram' if 't.me/' in href else None
   if label:
    visible=BeautifulSoup(n.get('html') or '', 'html.parser').get_text(' ',strip=True)
    attrs['aria-label']=visible+' — '+label if visible and visible.lower() not in label.lower() else label
  flags=[]
  classes=n['attrs'].get('class','').split()
  for c in classes:
   if c.startswith('uc-'):flags.append(c[3:])
  if original and original.get('data-uc'):flags.append(original['data-uc'])
  if original and original.get('data-animate-sbs-event')=='scroll':flags.append('scroll-reveal')
  if 'sbs-anim-wrapper' in n['attrs'].get('class',''):flags.append('reveal-layer')
  node={'tag':tag,'className':cls+(' '+' '.join(flags) if flags else ''),'attrs':attrs}
  if elemtype=='form':node['widget']='inline-form'
  if elemtype=='html':
   html=original.select_one('.tn-atom').decode_contents() if original.select_one('.tn-atom') else ''
   if 'custom-retouch-slider' in html:node['widget']='retouch'
   else:return None
  image=None
  content=BeautifulSoup(n.get('html') or '', 'html.parser')
  bg=n['css'].get('backgroundImage','')
  match=re.search(r'url\(["\x27]?(.*?)["\x27]?\)',bg)
  img=content.find('img')
  if match:
   url=match.group(1);a=asset(url)
   image={'url':url,'alt':attrs.get('aria-label',''),'position':n['css']['backgroundPosition'],'size':n['css']['backgroundSize'],'background':True}
   if a:image.update(a);usedassets.add(normalize_url(url))
   else:unresolved.add(url)
   node['image']=image;attrs.pop('role',None);attrs.pop('aria-label',None)
  elif img:
   url=img.get('src');a=asset(url)
   image={'url':url,'alt':img.get('alt',''),'background':False}
   if a:image.update(a);usedassets.add(normalize_url(url))
   else:unresolved.add(url)
   node['image']=image
  elif kind=='content' and not node.get('widget'):
   node['html']=clean_html(n['html'],buttonicons.get((bid,owner.get('data-elem-id'))) if owner else None)
  if slug=='hero' and image:node['image']['critical']=True
  if image:
   sizes=[]
   for w,maxw in [(320,479),(480,639),(640,959),(961,1199),(1200,None)]:
    rendered=float(fs[w][i]['css']['width'].replace('px',''))
    bgscale=re.match(r'([\d.]+)% auto$',fs[w][i]['css']['backgroundSize'])
    if image.get('background') and bgscale:rendered*=float(bgscale[1])/100
    upscale=trees[w]['attrs'].get('data-artboard-upscale-res-320')=='window'
    val=f'{rendered/320*100:g}vw' if w==320 and upscale else f'{rendered:g}px'
    sizes.append((f'(max-width:{maxw}px) ' if maxw else '')+val)
   node['image']['sizes']=', '.join(sizes)
  if node.get('widget'):node['children']=[]
  else:node['children']=[v for c in n['children'] if (v:=convert(c,False,owner)) is not None]
  if tag=='a':
   def has_label_text(item):
    return bool(BeautifulSoup(item.get('html') or '', 'html.parser').get_text(' ',strip=True)) or any(has_label_text(c) for c in item.get('children',[]))
   if has_label_text(node):attrs.pop('aria-label',None)
  if key:auditnodes.append({'sourceBlock':'rec'+bid,'key':key,'class':cls,'section':slug,'type':elemtype})
  for w in WIDTHS:
   s=styles(fs[w][i],w,root,bid,original,owner)
   if slug=='inquiry' and (key=='1773076296996000001' or (kind=='layout' and owner is not None and owner.get('data-group-id')=='1773076296996000001') or node.get('widget')=='inline-form'):
    s['height']=f"calc({s['height']} + var(--form-growth, 0px))"
   if node.get('image'):
    # Sizes/crops can change independently from the photograph at each breakpoint.
    if image.get('background'):
     s['--picture-position']=fs[w][i]['css']['backgroundPosition']
     s['--picture-size']=fs[w][i]['css']['backgroundSize']
     size=re.match(r'([\d.]+)% auto$',fs[w][i]['css']['backgroundSize'])
     x,y=fs[w][i]['css']['backgroundPosition'].split()
     s.update({'--picture-width':size[1]+'%' if size else '100%','--picture-height':'auto' if size else '100%','--picture-left':x if size else '0px','--picture-top':y if size else '0px','--picture-transform':f'translate(calc(-1 * {x}),calc(-1 * {y}))' if size else 'none'})
   allrules[w].append(('.'+cls,s))
   content=buttoncontent.get(961 if w==960 else w,{}).get((bid,owner.get('data-elem-id'))) if owner and kind=='content' else None
   if content:
    allrules[w].append(('.'+cls+' .button-content',{'display':'flex','alignItems':'center','justifyContent':'center','padding':content['content']['padding'],'boxSizing':'content-box'}))
    allrules[w].append(('.'+cls+' .button-text',{'whiteSpace':content['label']['whiteSpace']}))
  return node
 nodes=[v for n in block['nodes'] if (v:=convert(n,True)) is not None]
 sections.append({'id':slug,'source':'rec'+bid,'anchor':anchors.get(slug),'nodes':nodes})

# Emit common defaults, then only differences across adjacent responsive states.
baseline=defaults.copy();baseline['margin']='0';baseline['padding']='0';baseline['border']='0';baseline['right']='auto';baseline['bottom']='auto'
css=['/* Measured visual composition. No platform runtime or source CSS required. */','.design-node{'+declarations(baseline)+'}',
':root{--mobile-scale:round(nearest,calc(100vw / 320px),.001)}.canvas{position:relative;isolation:isolate;width:100%;margin:0 auto}.page-section{position:relative}.design-node{transform-origin:center center}.design-node svg{display:block;width:100%;height:100%}.design-node img{display:block;width:100%;height:100%}.design-node p{margin:0}.design-node a{color:inherit;text-decoration:inherit}.photo{display:block;width:100%;height:100%;border-radius:inherit;overflow:hidden}.photo img{position:absolute;left:var(--picture-left,0px);top:var(--picture-top,0px);transform:var(--picture-transform,none);width:var(--picture-width,100%);height:var(--picture-height,100%);object-fit:cover;object-position:var(--picture-position,50% 50%);border-radius:inherit}.design-node:has(>.photo){position:relative}.design-node:has(>.photo)> .photo{position:absolute;inset:0}.design-node a:hover [style*="--hover-icon"]{background-image:var(--hover-icon)!important}.section-header{position:fixed;top:0;left:0;right:0;z-index:990}.site-content{padding-top:80px}.section-services-title{scroll-margin-top:80px}.page-section{scroll-margin-top:80px}',
'@media(max-width:959px){.site-content{padding-top:60px}.page-section{scroll-margin-top:60px}}@media(max-width:479px){.site-content{padding-top:round(down,calc(60px * var(--mobile-scale)),1px)}.page-section{scroll-margin-top:calc(60 * 100vw / 320)}}@media(max-width:639px){.section-services-title{margin-top:15px!important}}']
previous={}
for w in WIDTHS:
 merged={}
 for selector,vals in allrules[w]:merged.setdefault(selector,{}).update(vals)
 rules=[]
 for selector,vals in merged.items():
  if w==320:
   delta={k:v for k,v in vals.items() if not selector.startswith('.n') or defaults.get(k)!=v}
  else:
   old=previous.get(selector,{})
   delta={k:v for k,v in vals.items() if old.get(k)!=v}
  if delta:rules.append(selector+'{'+declarations(delta)+'}')
 previous=merged
 if w==320:css.append(''.join(rules))
 else:css.append(f'@media(min-width:{w}px)'+'{'+''.join(rules)+'}')
Path('src/styles/composition.css').write_text('\n'.join(css),'utf-8')
OUT.joinpath('sections.json').write_text(json.dumps(sections,ensure_ascii=False,separators=(',',':')),'utf-8')
OUT.joinpath('seo.json').write_text(json.dumps({p:{'title':d['title'],'meta':[m for m in d['meta'] if 'itemprop' not in m],'canonical':next((l['href'] for l in d['headLinks'] if l.get('rel')==['canonical']),''),'jsonLd':[json.loads(s['body']) for s in d['scripts'] if s['type']=='application/ld+json']} for p,d in meta.items()},ensure_ascii=False,indent=2),'utf-8')
Path('audit/migrated-nodes.json').write_text(json.dumps(auditnodes,ensure_ascii=False,indent=2),'utf-8')
Path('audit/unresolved-assets.json').write_text(json.dumps(sorted(unresolved),ensure_ascii=False,indent=2),'utf-8')
print('Generated',len(sections),'sections;',index,'nodes;',len(usedassets),'mapped assets;',len(unresolved),'unresolved URLs')
print('CSS bytes',Path('src/styles/composition.css').stat().st_size,'content bytes',OUT.joinpath('sections.json').stat().st_size)

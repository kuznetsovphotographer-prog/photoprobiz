import { renderToString } from 'react-dom/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { HomePage } from '../src/App';
import { ThankYouPage } from '../src/pages/ThankYouPage';
import { ServicePage } from '../src/pages/ServicePage';
import { LegalPage } from '../src/pages/LegalPage';
import { CookieBanner } from '../src/components/CookieBanner';
import { servicePages } from '../src/data/servicePages';
import galleries from '../src/data/galleries.json';
import seoData from '../src/data/seo.json';
import assets from '../src/data/assets.json';
import sections from '../src/data/sections.json';
import heroAvif from '../src/data/hero-avif.json';
import desktopHero from '../src/data/desktop-hero.json';
import type { DesignNode } from '../src/components/DesignSection';

const escape = (s:string) => s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const imageMap=assets as Record<string,{src:string}>;
const flatten=(nodes:DesignNode[]):DesignNode[]=>nodes.flatMap(node=>[node,...flatten(node.children ?? [])]);
const hero=flatten((sections.find(section=>section.id==='hero')?.nodes ?? []) as DesignNode[]).find(node=>node.image?.critical)?.image;
const localImage=(url:string,absolute=false,basePath='./')=>imageMap[url] ? (absolute?'https://photoprobiz.ru/':basePath)+imageMap[url].src : url;
const localizeSchema=(value:unknown):unknown=>typeof value==='string'?localImage(value,true):Array.isArray(value)?value.map(localizeSchema):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,localizeSchema(v)])):value;
type PageSpec = { file: string; key?: keyof typeof seoData; basePath: string; kind: 'home' | 'thankyou' | 'cookie' | 'privacy' | 'consent' | '404' | 'service'; serviceKey?: string };
const pages: PageSpec[]=[
 {file:'index.html',key:'home',basePath:'./',kind:'home'},
 {file:'thankyou/index.html',key:'thankyou',basePath:'../',kind:'thankyou'},
 {file:'cookie/index.html',key:'cookie',basePath:'../',kind:'cookie'},
 {file:'privacy/index.html',basePath:'../',kind:'privacy'},
 {file:'consent/index.html',basePath:'../',kind:'consent'},
 {file:'page132097826.html',key:'page132097826',basePath:'./',kind:'thankyou'},
 {file:'page135439646.html',key:'page135439646',basePath:'./',kind:'cookie'},
 {file:'404.html',key:'cookie',basePath:'./',kind:'404'},
 ...Object.values(servicePages).map(page=>({file:`${page.slug}/index.html`,basePath:'../',kind:'service' as const,serviceKey:page.slug})),
];

type SeoEntry = { title: string; meta: Record<string,string>[]; canonical?: string; jsonLd: unknown[] };
const serviceGallery = galleries as Record<string,{images:{src:string;alt:string}[]}>;
function makeServiceSeo(serviceKey:string):SeoEntry {
 const service=servicePages[serviceKey];
 const image=serviceGallery[service.galleryKey].images[0];
 const canonical=`https://photoprobiz.ru/${service.slug}/`;
 const imageUrl=`https://photoprobiz.ru/${image.src}`;
 return {
  title:service.metaTitle,
  canonical,
  meta:[
   {name:'description',content:service.description},
   {name:'robots',content:'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'},
   {property:'og:url',content:canonical},
   {property:'og:title',content:service.metaTitle},
   {property:'og:description',content:service.description},
   {property:'og:type',content:'website'},
   {property:'og:locale',content:'ru_RU'},
   {property:'og:site_name',content:'Александр Кузнецов — деловой фотограф'},
   {property:'og:image',content:imageUrl},
   {property:'og:image:alt',content:image.alt},
   {name:'twitter:card',content:'summary_large_image'},
   {name:'twitter:title',content:service.metaTitle},
   {name:'twitter:description',content:service.description},
   {name:'twitter:image',content:imageUrl},
   {name:'twitter:image:alt',content:image.alt},
   {name:'format-detection',content:'telephone=no'},
  ],
  jsonLd:[{
   '@context':'https://schema.org','@type':'Service',name:service.title,description:service.description,url:canonical,
   provider:{'@type':'LocalBusiness',name:'Александр Кузнецов — деловой фотограф',url:'https://photoprobiz.ru/',telephone:'+79658502552'},
   areaServed:{'@type':'City',name:'Москва'},
  }],
 };
}

function utilitySeo(kind:PageSpec['kind'], source:SeoEntry):SeoEntry {
 if(kind==='404')return {title:'Страница не найдена | Александр Кузнецов',meta:[{name:'robots',content:'noindex, nofollow'}],jsonLd:[]};
 if(kind==='cookie')return {
  title:'Уведомление об использовании cookie | Александр Кузнецов',canonical:'https://photoprobiz.ru/cookie/',
  meta:[{name:'robots',content:'noindex, follow'},{name:'description',content:'Информация об использовании файлов cookie на сайте фотографа Александра Кузнецова.'}],jsonLd:[],
 };
 if(kind==='privacy' || kind==='consent'){
  const privacy=kind==='privacy';
  return {
   title:privacy?'Политика обработки персональных данных | Александр Кузнецов':'Согласие на обработку персональных данных | Александр Кузнецов',
   canonical:`https://photoprobiz.ru/${kind}/`,
   meta:[
    {name:'robots',content:'noindex, follow'},
    {name:'description',content:privacy?'Политика обработки персональных данных на сайте фотографа Александра Кузнецова.':'Условия согласия на обработку персональных данных при отправке заявки на фотосъёмку.'},
   ],
   jsonLd:[],
  };
 }
 if(kind==='thankyou')return {
  ...source,canonical:'https://photoprobiz.ru/thankyou/',jsonLd:[],
  meta:[...source.meta.filter(meta=>meta.name!=='robots').map(meta=>meta.property==='og:url'?{...meta,content:'https://photoprobiz.ru/thankyou/'}:meta),{name:'robots',content:'noindex, follow'}],
 };
 return source;
}

for(const page of pages){
 const sourceSeo=(page.key ? seoData[page.key] : seoData.home) as unknown as SeoEntry;
 const seo=page.kind==='service' ? makeServiceSeo(page.serviceKey!) : utilitySeo(page.kind,sourceSeo);
 const meta=seo.meta as unknown as Record<string,string>[];
 let head='<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
 head+='<title>'+escape(seo.title)+'</title>';
 for(const m of meta){
  if(m.charset||m.name==='viewport'||m['http-equiv'])continue;
  const attrs={...m};
  if(attrs.content)attrs.content=localImage(attrs.content,true);
  head+='<meta '+Object.entries(attrs).map(([k,v])=>k+'="'+escape(v)+'"').join(' ')+'>';
 }
 if(seo.canonical)head+='<link rel="canonical" href="'+escape(seo.canonical)+'">';
 if(page.kind==='home' && !meta.some(item=>item.name==='robots'))head+='<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">';
 if(page.kind==='home' || page.kind==='service'){
  const markdownPath=page.kind==='home' ? '/ai/index.md' : `/ai/${page.serviceKey}.md`;
  head+='<link rel="describedby" href="/llms.txt" type="text/markdown">';
  head+='<link rel="alternate" href="'+markdownPath+'" type="text/markdown">';
 }
 head+='<link rel="icon" type="image/svg+xml" href="'+page.basePath+'favicon/favicon.svg">';
 if(page.kind==='home')head+='<link rel="preload" as="font" type="font/woff2" href="'+page.basePath+'fonts/tilda-sans-variable.woff2" crossorigin>';
 if(page.kind==='home' && hero){
  head+='<link rel="preload" as="image" type="image/avif" media="(max-width: 1199px)" fetchpriority="high" href="'+page.basePath+heroAvif.src+'" imagesrcset="'+escape(heroAvif.srcSet.replace(/(^|,\s*)([^\s,]+)/g,(_m,sep,src)=>sep+page.basePath+src))+'" imagesizes="'+escape(hero.sizes ?? '')+'">';
  head+='<link rel="preload" as="image" type="image/avif" media="(min-width: 1200px)" fetchpriority="high" href="'+page.basePath+desktopHero.formats.avif.src+'" imagesrcset="'+escape(desktopHero.formats.avif.srcSet.replace(/(^|,\s*)([^\s,]+)/g,(_m,sep,src)=>sep+page.basePath+src))+'" imagesizes="'+escape(desktopHero.sizes)+'">';
 }
 if(page.kind==='thankyou')head+='<link rel="stylesheet" href="/fonts/secondary-fonts.css">';
 if(page.kind==='home')head+='<link rel="stylesheet" href="/src/styles/composition.css">';
 const schemas=page.kind==='home'?[...seo.jsonLd,{'@context':'https://schema.org','@type':'WebSite',name:'Александр Кузнецов — деловой фотограф',url:'https://photoprobiz.ru/',inLanguage:'ru-RU'}]:seo.jsonLd;
 head+=schemas.map(value=>'<script type="application/ld+json">'+JSON.stringify(localizeSchema(value)).replace(/</g,'\\u003c')+'</script>').join('');
 let body='';
 if(page.kind==='home')body=renderToString(<HomePage basePath={page.basePath}/>);
 else if(page.kind==='service')body=renderToString(<ServicePage serviceKey={page.serviceKey!} basePath={page.basePath}/>);
 else if(page.kind==='privacy' || page.kind==='consent')body=renderToString(<LegalPage kind={page.kind} basePath={page.basePath}/>);
 else{
  if(page.kind==='thankyou')body=renderToString(<div id="thankyou-root"><ThankYouPage basePath={page.basePath}/></div>);
  if(page.kind==='404')body='<main style="max-width:600px;margin:15vh auto;padding:24px"><h1>Страница не найдена</h1><a href="'+page.basePath+'">Вернуться на сайт</a></main>';
  body+='<div id="cookie-root">'+renderToString(<CookieBanner/>)+'</div><div id="ui-root"></div>';
 }
 const html='<!doctype html><html lang="ru"><head>'+head+'</head><body data-base-path="'+page.basePath+'" data-page="'+page.kind+'">'+body+'<script type="module" src="/src/main.tsx"></script></body></html>';
 await mkdir(dirname(page.file),{recursive:true});await writeFile(page.file,html,'utf8');
 console.log('Prerendered '+page.file+' ('+Buffer.byteLength(html)+' bytes)');
}
const privatePaths=['/thankyou/','/cookie/','/page132097826.html','/page135439646.html'];
const robotGroup=(agent:string)=>`User-agent: ${agent}\nAllow: /\n${privatePaths.map(path=>`Disallow: ${path}`).join('\n')}`;
const robots=[robotGroup('OAI-SearchBot'),robotGroup('Claude-SearchBot'),robotGroup('*')].join('\n\n')
 +'\n\nSitemap: https://photoprobiz.ru/sitemap.xml\n';
await writeFile('public/robots.txt',robots,'utf8');
const sitemapPages=[
 {url:'https://photoprobiz.ru/',image:'https://photoprobiz.ru/'+desktopHero.formats.webp.variants[0].src,title:desktopHero.alt},
 ...Object.values(servicePages).map(service=>{const image=serviceGallery[service.galleryKey].images[0];return {url:`https://photoprobiz.ru/${service.slug}/`,image:`https://photoprobiz.ru/${image.src}`,title:image.alt};}),
];
const xmlEscape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'+sitemapPages.map(page=>`  <url><loc>${xmlEscape(page.url)}</loc><image:image><image:loc>${xmlEscape(page.image)}</image:loc><image:title>${xmlEscape(page.title)}</image:title></image:image></url>`).join('\n')+'\n</urlset>\n';
await writeFile('public/sitemap.xml',sitemap,'utf8');

const serviceMarkdown=(serviceKey:string)=>{
 const service=servicePages[serviceKey];
 return `# ${service.title}\n\n> ${service.description}\n\n${service.lead}\n\n## Как проходит съёмка\n\n${service.paragraphs.join('\n\n')}\n\n## Что входит\n\n${service.benefits.map(item=>`- ${item}`).join('\n')}\n\n## Ссылки\n\n- [Страница услуги](https://photoprobiz.ru/${service.slug}/)\n- [Главная страница и форма заявки](https://photoprobiz.ru/)\n\nФотограф: Александр Кузнецов. Москва, выезд по России. Минимальная стоимость фотосессии — 15 000 рублей.\n`;
};
await mkdir('public/ai',{recursive:true});
for(const service of Object.values(servicePages))await writeFile(`public/ai/${service.slug}.md`,serviceMarkdown(service.slug),'utf8');
const aiIndex=`# Александр Кузнецов — деловой фотограф\n\n> Деловые портреты и корпоративная фотосъёмка в Москве, в студии и с выездом в офис.\n\nАлександр Кузнецов снимает руководителей, экспертов, сотрудников компаний, врачей и клиники. Помогает с выбором локации, образом и позированием. Готовые фотографии передаются в течение 7 дней. Минимальная стоимость фотосессии — 15 000 рублей.\n\n## Услуги\n\n${Object.values(servicePages).map(service=>`- [${service.title}](https://photoprobiz.ru/${service.slug}/): ${service.description}`).join('\n')}\n\n## Контакты\n\n- Сайт: https://photoprobiz.ru/\n- Телефон: +7 965 850-25-52\n- Email: thealexmay@yandex.ru\n- География: Москва, выезд по России\n`;
await writeFile('public/ai/index.md',aiIndex,'utf8');
const llms=`# Александр Кузнецов — деловой фотограф\n\n> Официальный сайт фотографа деловых портретов и корпоративных съёмок в Москве.\n\nОсновная информация, услуги, стоимость и контакты собраны в [машиночитаемом описании](https://photoprobiz.ru/ai/index.md). Канонический источник — страницы сайта photoprobiz.ru. Минимальная стоимость фотосессии — 15 000 рублей.\n\n## Услуги\n\n${Object.values(servicePages).map(service=>`- [${service.title}](https://photoprobiz.ru/ai/${service.slug}.md): ${service.description}`).join('\n')}\n\n## Страницы сайта\n\n- [Главная и портфолио](https://photoprobiz.ru/)\n${Object.values(servicePages).map(service=>`- [${service.title}](https://photoprobiz.ru/${service.slug}/)`).join('\n')}\n\n## Контакты\n\n- Телефон: +7 965 850-25-52\n- Email: thealexmay@yandex.ru\n- География работы: Москва и Россия\n`;
await writeFile('public/llms.txt',llms,'utf8');

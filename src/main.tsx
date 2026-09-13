import type { ReactNode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { CookieBanner } from './components/CookieBanner';
import { CompactNavigation } from './components/CompactNavigation';
import { LeadForm } from './components/LeadForm';
import './styles/base.css';
import './styles/interaction-states.css';
import './styles/forms.css';
import './styles/secondary.css';

const basePath=document.body.dataset.basePath || './';
const uiRoot=createRoot(document.getElementById('ui-root')!);
type DialogEntry={key:string;variant:'gallery'|'feature'|'form'|'content'|'menu';label:string;child:ReactNode};
let dialogs:DialogEntry[]=[];

function publishMenuState(){
  document.dispatchEvent(new CustomEvent('pp:menu-state',{detail:{
    open:dialogs.some(dialog=>dialog.variant==='menu'),
    active:dialogs.at(-1)?.variant==='menu',
  }}));
}

async function showPopup(hash:string){
  const {Dialog}=await import('./components/Dialog');
  const renderDialogs=()=>{
    uiRoot.render(<>{dialogs.map((entry,i)=><Dialog key={entry.key} variant={entry.variant} label={entry.label} onClose={()=>{dialogs=dialogs.slice(0,i);renderDialogs();}}>{entry.child}</Dialog>)}</>);
    publishMenuState();
  };
  const contentHash=hash.replace('#popup:','');
  let child:ReactNode,variant:'gallery'|'feature'|'form'|'content'|'menu'='content';
  let label='Диалоговое окно';
  if(contentHash.startsWith('myorder')){
    variant='form';label='Заказать фотосессию';
    const packageName=contentHash==='myordermini'?'Минимальный':contentHash==='myorderbase'?'Базовый':contentHash==='myorderfull'?'Полный':undefined;
    child=<LeadForm variant="modal" packageName={packageName} basePath={basePath}/>;
  }else if(contentHash==='privacy'){
    const {PrivacyPolicy}=await import('./components/PrivacyPolicy');label='Политика конфиденциальности';child=<PrivacyPolicy basePath={basePath}/>;
  }else if(contentHash==='contacts'){
    const {ContactCard}=await import('./components/ContactCard');label='Контакты';child=<ContactCard/>;
  }else if(contentHash==='office-setup'){
    const {OfficeSetupFeature}=await import('./components/OfficeSetupFeature');
    variant='feature';label='Полноценная студия в вашем пространстве';child=<OfficeSetupFeature basePath={basePath}/>;
  }else if(contentHash==='lighting-setup'){
    const {LightingSetupFeature}=await import('./components/LightingSetupFeature');
    variant='feature';label='Техническое совершенство';child=<LightingSetupFeature basePath={basePath}/>;
  }else if(contentHash==='wardrobe-guide'){
    const {WardrobeGuideFeature}=await import('./components/WardrobeGuideFeature');
    variant='feature';label='Детальный разбор образов';child=<WardrobeGuideFeature basePath={basePath}/>;
  }else if(hash==='#mobilemenu'){
    variant='menu';label='Меню';
    const {MobileNavigation}=await import('./components/MobileNavigation');
    child=<MobileNavigation/>;
  }else{
    const [{Gallery},data]=await Promise.all([import('./components/Gallery'),import('./data/galleries.json')]);
    const gallery=(data.default as Record<string,any>)[hash] ?? (data.default as Record<string,any>)[contentHash];
    if(!gallery)return;
    variant='gallery';label=gallery.title || 'Фотографии';child=<Gallery gallery={gallery} basePath={basePath}/>;
  }
  const openedFromMenu = dialogs.at(-1)?.variant === 'menu';
  if((contentHash==='privacy' || (openedFromMenu && contentHash.startsWith('myorder'))) && dialogs.length && !dialogs.some(d=>d.key===hash)) dialogs.push({key:hash,variant,label,child});
  else dialogs=[{key:hash,variant,label,child}];
  renderDialogs();
}

document.addEventListener('click',(event)=>{
 if(event.defaultPrevented)return;
 const target=event.target as Element;
 const link=target.closest<HTMLAnchorElement>('a[href]');
 if(!link){
  const teamCard=target.closest<HTMLElement>('.team-card-interactive[data-instagram-href]');
  if(teamCard) location.assign(teamCard.dataset.instagramHref!);
  return;
 }
 const hash=link.getAttribute('href')||'';
 if(hash.startsWith('#popup:')||hash==='#mobilemenu'){event.preventDefault();void showPopup(hash);}
});
document.addEventListener('keydown',(event)=>{
 const keyboardEvent=event as KeyboardEvent;
 if(keyboardEvent.key!=='Enter'&&keyboardEvent.key!==' ')return;
 const teamCard=(keyboardEvent.target as Element).closest<HTMLElement>('.team-card-interactive[data-instagram-href]');
 if(!teamCard||keyboardEvent.target!==teamCard)return;
 keyboardEvent.preventDefault();
 location.assign(teamCard.dataset.instagramHref!);
});
document.addEventListener('pp:open-menu',()=>{
  if(!dialogs.some(dialog=>dialog.variant==='menu')) void showPopup('#mobilemenu');
});
document.addEventListener('pp:open-contacts',()=>void showPopup('#popup:contacts'));
document.addEventListener('input',(event)=>{
 const input=event.target as HTMLInputElement;
 if(!input.matches('.retouch-comparison input'))return;
 const container=input.closest<HTMLElement>('.retouch-comparison')!;
 container.style.setProperty('--split',input.value+'%');
 (container.querySelector('.before-label') as HTMLElement).style.opacity=Number(input.value)<15?'0':'1';
 (container.querySelector('.after-label') as HTMLElement).style.opacity=Number(input.value)>85?'0':'1';
});

const cookie=document.getElementById('cookie-root');
if(cookie)hydrateRoot(cookie,<CookieBanner basePath={basePath}/>);
const thankyou=document.getElementById('thankyou-root');
if(thankyou)void import('./pages/ThankYouPage').then(({ThankYouPage})=>hydrateRoot(thankyou,<ThankYouPage basePath={basePath}/>));
document.querySelectorAll<HTMLElement>('[data-form-root="inline"]').forEach(el=>hydrateRoot(el,<LeadForm variant="inline" basePath={basePath}/>));
if(document.querySelector('.section-header')){
  const compactNavigationRoot=document.createElement('div');
  compactNavigationRoot.id='compact-navigation-root';
  document.body.append(compactNavigationRoot);
  createRoot(compactNavigationRoot).render(<CompactNavigation/>);
}
if(location.hash.startsWith('#popup:')||location.hash==='#mobilemenu')void showPopup(location.hash);

const reveals=document.querySelectorAll('.scroll-reveal');
if(matchMedia('(prefers-reduced-motion: reduce)').matches) reveals.forEach(el=>el.classList.add('is-revealed'));
else {
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(entry.isIntersecting){entry.target.classList.add('is-revealed');observer.unobserve(entry.target);}
 }),{rootMargin:'0px 0px -10% 0px'});
 reveals.forEach(el=>observer.observe(el));
}

document.querySelectorAll('.prev-client,.next-client').forEach(control=>{
 control.setAttribute('role','button');control.setAttribute('tabindex','0');
 control.setAttribute('aria-label',control.classList.contains('prev-client')?'Предыдущие клиенты':'Следующие клиенты');
 const move=()=>document.querySelector('.clients-track > .design-node')?.scrollBy({left:control.classList.contains('prev-client')?-240:240,behavior:'smooth'});
 control.addEventListener('click',move);control.addEventListener('keydown',e=>{if(['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();move();}});
});

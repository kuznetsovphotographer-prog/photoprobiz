async (page) => {
 const checks=[];const errors=[];const failures=[];const external=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('request',r=>{if(!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(r.url())) external.push(r.url());});
 const check=(name,pass,detail)=>checks.push({name,pass:Boolean(pass),detail});
 const dialog=()=>page.locator('[role="dialog"]:not([inert])').last();
 const close=async()=>{for(let n=0;n<4 && await page.locator('[role="dialog"]').count();n++){await page.keyboard.press('Escape');await page.waitForTimeout(60);}};
 const clickLink=async(href)=>{
  const links=page.locator(`a[href="${href}"]`);
  for(let i=0;i<await links.count();i++){
   const link=links.nth(i);const box=await link.boundingBox();
   if(box&&box.width>2&&box.height>2&&box.x+box.width>0&&box.x<await page.evaluate(()=>innerWidth)){
    await link.scrollIntoViewIfNeeded();await link.click({timeout:6000});return;
   }
  }
  throw new Error(`No onscreen-layout link for ${href}`);
 };
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
 await page.evaluate(()=>{
  localStorage.removeItem('photoprobiz:cookie-consent');
  localStorage.removeItem('photoprobiz:cookie-notice-seen');
 });
 await page.reload({waitUntil:'networkidle'});
 const cookie=page.locator('.cookie-banner');
 check('Cookie initially visible',await cookie.isVisible());
 await cookie.getByRole('button',{name:'OK',exact:true}).click();
 check('Cookie accepted locally',!(await cookie.count()),await page.evaluate(()=>Boolean(localStorage.getItem('photoprobiz:cookie-consent'))));

 const galleryHrefs=await page.locator('a[href^="#popup:"]').evaluateAll(links=>[...new Set(links.map(a=>a.getAttribute('href')))].filter(h=>!['#popup:contacts','#popup:privacy'].includes(h)&&!h.startsWith('#popup:myorder')));
 check('Seventeen gallery links exist',galleryHrefs.length===17,galleryHrefs);
 for(const href of galleryHrefs){
  try{
   await clickLink(href);
   await page.locator('.pp-gallery__image').waitFor({state:'visible',timeout:10000});
   const img=page.locator('.pp-gallery__image');await img.evaluate(img=>img.decode());
   const count=await page.locator('.pp-gallery__dot').count();
   check(`Gallery ${href} image decodes`,await img.evaluate(i=>i.naturalWidth>0),{count,src:await img.getAttribute('src')});
   check(`Gallery ${href} first dot`,await page.locator('.pp-gallery__dot').first().getAttribute('aria-current')==='true');
   await page.getByRole('button',{name:'Предыдущая фотография',exact:true}).click();
   check(`Gallery ${href} previous wraps`,await page.locator('.pp-gallery__dot').last().getAttribute('aria-current')==='true');
   await page.keyboard.press('ArrowRight');
   check(`Gallery ${href} keyboard wraps`,await page.locator('.pp-gallery__dot').first().getAttribute('aria-current')==='true');
   if(count>1){await page.locator('.pp-gallery__dot').nth(1).click();check(`Gallery ${href} dot selects`,await page.locator('.pp-gallery__dot').nth(1).getAttribute('aria-current')==='true');}
   check(`Gallery ${href} main isolated`,await page.locator('.site-content').evaluate(el=>Boolean(el.closest('[inert]'))));
  }catch(e){check(`Gallery ${href}`,false,String(e));}
  await close();
 }

 await page.setViewportSize({width:390,height:844});
 for(const width of [390,768]){
  await page.setViewportSize({width,height:1000});
  for(const [i,selector] of ['.n1587','.n1594','.n1601','.n1608','.n1615','.n1622'].entries()){
   try{
    const label=page.locator(selector);await label.scrollIntoViewIfNeeded();await page.waitForTimeout(400);
    const state=await label.evaluate(el=>{const r=el.getBoundingClientRect();return {pointer:getComputedStyle(el).pointerEvents,opacity:getComputedStyle(el.querySelector('.reveal-layer')).opacity,x:r.x+r.width/2,y:r.y+r.height/2};});
    const underlying=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('a')?.getAttribute('href'),state);
    check(`Scroll CTA ${i+1} visible and clickable at ${width}`,state.pointer==='none'&&state.opacity==='1'&&underlying===`#popup:person${i+1}`,{...state,underlying});
    await page.mouse.click(state.x,state.y);await page.locator('.pp-gallery__image').waitFor({state:'visible',timeout:6000});
    check(`Scroll CTA ${i+1} opens gallery at ${width}`,await page.locator('.pp-gallery__dot').count()>0);
   }catch(e){check(`Scroll CTA ${i+1} at ${width}`,false,String(e));}
   await close();
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
 await clickLink('#mobilemenu');
 await page.locator('.pp-mobile-navigation').waitFor({state:'visible'});
 check('Mobile menu has six section links',await page.locator('.pp-mobile-navigation__sections a').count()===6);
 await page.locator('.pp-mobile-navigation__sections a[href="#pricing"]').click();
 await page.waitForFunction(()=>{const y=document.querySelector('#pricing').getBoundingClientRect().y;return y>=0&&y<150;},null,{timeout:5000});
 check('Menu navigation closes dialog',await page.locator('[role="dialog"]').count()===0);
 const pricing=await page.locator('#pricing').boundingBox();
 check('Menu navigation reaches pricing',pricing&&pricing.y>=0&&pricing.y<150,{pricing,scrollY:await page.evaluate(()=>scrollY)});

 await clickLink('#popup:contacts');await page.locator('.contact-card').waitFor({state:'visible'});
 const contactLinks=await page.locator('.contact-card-links a').evaluateAll(a=>a.map(x=>x.getAttribute('href')));
 check('Contact links preserved without opening external apps',contactLinks.length===5,contactLinks);await close();

 for(const [href,expected] of [['#popup:myordermini','Минимальный'],['#popup:myorderbase','Базовый'],['#popup:myorderfull','Полный']]){
  try{
   await clickLink(href);await page.locator('.lead-form--modal').waitFor({state:'visible'});
   const state=await dialog().locator('select').evaluateAll(nodes=>nodes.map(n=>({name:n.name,value:n.value,text:n.options[n.selectedIndex]?.textContent})));
   check(`Package ${expected} preselected`,state.some(s=>s.value===expected||s.text?.includes(expected)),state);
  }catch(e){check(`Package ${expected}`,false,String(e));}
  await close();
 }

 const range=page.locator('.retouch-comparison input[type="range"]');
 await range.scrollIntoViewIfNeeded();await range.focus();await page.keyboard.press('Home');
 check('Retouch keyboard reaches original limit',(await range.inputValue())==='0',await page.locator('.retouch-comparison').evaluate(el=>el.style.getPropertyValue('--split')));
 await page.keyboard.press('End');
 check('Retouch keyboard reaches edited limit',(await range.inputValue())==='100',await page.locator('.retouch-comparison').evaluate(el=>el.style.getPropertyValue('--split')));
 await page.keyboard.press('Home');for(let n=0;n<50;n++)await page.keyboard.press('ArrowRight');

 const track=page.locator('.clients-track > .design-node');
 if(await track.count()){
  const before=await track.evaluate(el=>({x:el.scrollLeft,w:el.clientWidth,full:el.scrollWidth}));
  if(before.full>before.w){await page.getByRole('button',{name:'Следующие клиенты',exact:true}).click();await page.waitForTimeout(500);check('Client carousel moves',await track.evaluate(el=>el.scrollLeft)>before.x,before);}
 }
 await page.screenshot({path:'output/playwright/local-interactions-final-mobile.png'});
 check('No horizontal document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth})));
 check('No runtime page errors',errors.length===0,errors);
 check('No failed network requests',failures.length===0,failures);
 check('No external requests during local interactions',external.length===0,[...new Set(external)]);
 return {passed:checks.filter(x=>x.pass).length,total:checks.length,checks};
}

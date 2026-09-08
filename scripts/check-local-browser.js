async page => {
 await page.reload();
 const width=await page.evaluate(()=>innerWidth);
 await page.evaluate(async()=>{
  await document.fonts.ready;
  for(let y=0;y<document.documentElement.scrollHeight;y+=850){scrollTo(0,y);await new Promise(r=>setTimeout(r,35));}
  scrollTo(0,0);
 });
 const data=await page.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height};};
  return {width:innerWidth,height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth-innerWidth,sections:[...document.querySelectorAll('[data-section]')].map(e=>({id:e.dataset.section,...box(e)})),nodes:[...document.querySelectorAll('.design-node')].map(e=>({id:[...e.classList].find(c=>/^n\d+$/.test(c)),...box(e),display:getComputedStyle(e).display,opacity:getComputedStyle(e).opacity})),images:[...document.images].map(e=>({alt:e.alt,src:e.currentSrc,complete:e.complete,width:e.naturalWidth})),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,encodedBodySize:r.encodedBodySize,transferSize:r.transferSize,type:r.initiatorType}))};
 });
 const hidden=await page.addStyleTag({content:'.section-header,#cookie-root{opacity:0!important}'});
 for(const rec of data.sections){
  if(rec.height<1||rec.id==='header')continue;
  const el=page.locator('[data-section="'+rec.id+'"]');
  await el.scrollIntoViewIfNeeded();await page.waitForTimeout(60);
  await el.screenshot({path:`output/playwright/local-${width}-${rec.id}.png`,animations:'disabled'});
 }
 data.images=await page.evaluate(()=>[...document.images].filter(e=>e.getBoundingClientRect().right>0&&e.getBoundingClientRect().left<innerWidth&&getComputedStyle(e).display!=="none").map(e=>({alt:e.alt,src:e.currentSrc,complete:e.complete,width:e.naturalWidth})));
 await hidden.evaluate(el=>el.remove());await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:`output/playwright/local-${width}-viewport.png`});
 return data;
}

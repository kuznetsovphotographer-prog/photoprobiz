async page => {
 const result={};
 for(const width of [360,375,390,430,768,1024,1200,1440,1920]) {
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:4173/');await page.evaluate(()=>document.fonts.ready);
  result[width]=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,height:document.documentElement.scrollHeight,sections:[...document.querySelectorAll('[data-section]')].map(e=>{const r=e.getBoundingClientRect();return{id:e.dataset.section,x:r.x,y:r.y+scrollY,width:r.width,height:r.height};}),windowShapes:[...document.querySelectorAll('.n924,.n1374,.n125')].map(e=>{const r=e.getBoundingClientRect(),s=e.closest('section').getBoundingClientRect();return{class:e.className,x:r.x,y:r.y-s.y,w:r.width,h:r.height};})}));
  if([390,768,1440].includes(width)){
   await page.mouse.move(0,0);await page.screenshot({path:`output/playwright/local-${width}-final-viewport.png`});
   for(const id of ['office-booking','inquiry','career','portfolio-content']){
    const el=page.locator('[data-section="'+id+'"]');await el.scrollIntoViewIfNeeded();await page.waitForTimeout(250);await el.screenshot({path:`output/playwright/local-${width}-final-${id}.png`});
   }
  }
 }
 return result;
}

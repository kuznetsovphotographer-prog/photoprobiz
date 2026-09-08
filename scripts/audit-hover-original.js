async(page)=>{
 await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(1300);
 const cases=[['portfolio','#rec2010968521 .uc-card'],['outdoor','#rec2007197021 .uc-card'],['pricing','#rec2010353871 .uc-bg'],['footer-line','.uc-btn-anim']];
 const result=[];
 for(const [name,selector] of cases){
  const el=page.locator(selector).first();await el.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.waitForTimeout(400);
  const read=()=>el.evaluate(el=>{
   const rec=el.closest('.r');
   return [...rec.querySelectorAll('.tn-atom__sbs-anim-wrapper,.uc-filter-br,.uc-bg,.uc-bg .tn-molecule,.uc-line,.uc-btn-text')].map(x=>{
    const s=getComputedStyle(x),r=x.getBoundingClientRect();return {id:x.id,key:x.getAttribute('data-group-id'),class:x.className,opacity:s.opacity,filter:s.filter,background:s.backgroundImage,width:s.width,transform:s.transform,box:{x:r.x,y:r.y,w:r.width,h:r.height}};
   });
  });
  const before=await read();await el.hover();await page.waitForTimeout(750);const after=await read();
  await el.screenshot({path:`output/playwright/original-hover-${name}.png`});
  result.push({name,selector,before,after});
 }
 return result;
}

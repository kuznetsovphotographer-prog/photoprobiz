async (page) => {
 const target='1775636919560000001';
 const widths=[390,768];
 const results=[];
 for(const width of widths){
  await page.setViewportSize({width,height:1000});
  await page.waitForTimeout(1200);
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.waitForTimeout(400);
  const read=()=>page.evaluate((target)=>{
   const rec=document.querySelector('#rec2010968521');
   const group=rec.querySelector(`[data-group-id="${target}"]`);
   const wrapper=group.querySelector('.tn-atom__sbs-anim-wrapper');
   const box=group.getBoundingClientRect();const c=getComputedStyle(wrapper);
   return {scrollY,group:{x:box.x,y:box.y,w:box.width,h:box.height},opacity:c.opacity,transform:c.transform,style:wrapper.getAttribute('style')};
  },target);
  const before=await read();
  await page.evaluate(target=>{
   const group=document.querySelector(`#rec2010968521 [data-group-id="${target}"]`);
   scrollTo({top:group.getBoundingClientRect().top+scrollY-innerHeight/2,behavior:'instant'});
  },target);
  await page.waitForTimeout(600);
  const middle=await read();
  await page.evaluate(()=>scrollBy({top:500,behavior:'instant'}));
  await page.waitForTimeout(600);
  const after=await read();
  results.push({width,before,middle,after});
 }
 return results;
}

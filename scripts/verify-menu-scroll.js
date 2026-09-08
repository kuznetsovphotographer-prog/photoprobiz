async(page)=>{
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
 await page.locator('a[href="#mobilemenu"]').click();
 await page.locator('.pp-mobile-navigation__sections a[href="#pricing"]').click();
 const points=[];
 for(let i=0;i<10;i++){
  await page.waitForTimeout(250);
  points.push(await page.evaluate(()=>({y:scrollY,target:document.querySelector('#pricing').getBoundingClientRect().y,hash:location.hash,dialog:document.querySelectorAll('[role="dialog"]').length})));
 }
 return points;
}

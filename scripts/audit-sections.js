async (page) => {
 const width=await page.evaluate(()=>innerWidth);
 const records=await page.locator('#allrecords > div').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height>10).map(n=>({id:n.id,h:n.getBoundingClientRect().height})));
 for(const rec of records){
  const el=page.locator('#'+rec.id);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await el.screenshot({path:`output/playwright/original-${width}-${rec.id}.png`,animations:'disabled'});
 }
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:`output/playwright/original-${width}-viewport.png`});
 return {width,records};
}

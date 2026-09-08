async (page) => {
 const width=await page.evaluate(()=>innerWidth);
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:`output/playwright/original-${width}-viewport.png`});
 const clean = await page.addStyleTag({content:'#rec2000391521 .t396__artboard { opacity: 0 !important; }'});
 const records=await page.locator('#allrecords > div').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height>10).map(n=>({id:n.id,h:n.getBoundingClientRect().height})));
 const keys=['rec2134313191','rec2005510351','rec2005519591','rec2005914961','rec2006104721','rec2010353871','rec2010560351','rec2010968521','rec2011163991'];
 for(const rec of records.filter(r=>[768,390].includes(width)||keys.includes(r.id))){
  const el=page.locator('#'+rec.id);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await el.screenshot({path:`output/playwright/original-${width}-${rec.id}.png`,animations:'disabled'});
 }
 await clean.evaluate(node=>node.remove());
 await page.evaluate(()=>scrollTo(0,0));
 return {width,records};
}




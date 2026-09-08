async page => {
 const width=await page.evaluate(()=>innerWidth);
 const records=await page.locator('#allrecords > div').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height>10).map(n=>n.id));
 const hidden=await page.addStyleTag({content:'#rec2000391521,.t886{opacity:0!important}'});
 for(const id of records){const el=page.locator('#'+id);await el.scrollIntoViewIfNeeded();await page.waitForTimeout(70);await el.screenshot({path:`output/playwright/original-${width}-${id}.png`,animations:'disabled'});}
 await hidden.evaluate(el=>el.remove());await page.evaluate(()=>scrollTo(0,0));
 return {width,records};
}

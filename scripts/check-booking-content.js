async page => {
 await page.setViewportSize({width:390,height:1000});await page.waitForTimeout(700);
 const e=page.locator('#rec2007045571');await e.scrollIntoViewIfNeeded();
 return await e.evaluate(el=>[...el.querySelectorAll('.tn-elem,.tn-atom,.tn-atom__button-content,.tn-atom__button-text')].map(e=>({cls:e.className,text:e.innerText,r:e.getBoundingClientRect().toJSON(),css:{width:getComputedStyle(e).width,display:getComputedStyle(e).display,padding:getComputedStyle(e).padding,whiteSpace:getComputedStyle(e).whiteSpace,boxSizing:getComputedStyle(e).boxSizing}})));
}

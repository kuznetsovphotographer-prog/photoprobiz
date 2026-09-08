async(page)=>{
 const checks=[];
 const check=(name,pass,detail)=>checks.push({name,pass:Boolean(pass),detail});
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
 const cases=[{name:'portfolio',card:'.n1431',photo:'.n1441',image:'.n1442',cta:'.n1445'},{name:'outdoor',card:'.n416',photo:'.n418',image:'.n419',cta:'.n426'}];
 for(const item of cases){
  const card=page.locator(item.card);await card.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.waitForTimeout(400);
  const before=await page.locator(item.photo).evaluate(el=>getComputedStyle(el).filter);
  await card.hover();await page.waitForTimeout(850);
  const data=await page.evaluate(({photo,image,cta})=>({filter:getComputedStyle(document.querySelector(photo)).filter,transform:getComputedStyle(document.querySelector(image)).transform,opacity:getComputedStyle(document.querySelector(cta)).opacity}),item);
  check(`${item.name} photo darkens to 0.8`,before==='none'&&data.filter==='brightness(0.8)',{before,...data});
  check(`${item.name} photo enlarges 1.05`,data.transform==='matrix(1.05, 0, 0, 1.05, 0, 0)',data);
  check(`${item.name} CTA appears`,data.opacity==='1',data);
  await card.screenshot({path:`output/playwright/local-hover-${item.name}.png`});
 }
 await page.locator('.n1100').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.waitForTimeout(400);
 const beforeGradient=await page.locator('.n1102').evaluate(el=>getComputedStyle(el).backgroundImage);
 await page.locator('.n1100').hover();await page.waitForTimeout(600);
 const pricing=await page.locator('.n1101').evaluate(el=>({transform:getComputedStyle(el).transform,opacity:getComputedStyle(el).opacity,gradient:getComputedStyle(el.firstElementChild).backgroundImage}));
 check('Pricing grows 1.02 and fades 0.9',pricing.transform==='matrix(1.02, 0, 0, 1.02, 0, 0)'&&pricing.opacity==='0.9',pricing);
 check('Pricing retains source gradient on hover',pricing.gradient===beforeGradient,{beforeGradient,...pricing});
 check('Pricing sibling CTA reveals',await page.locator('.n1203').evaluate(el=>getComputedStyle(el).opacity)==='1');
 await page.locator('.n1100').screenshot({path:'output/playwright/local-hover-pricing.png'});
 await page.locator('.btn-anim').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.waitForTimeout(650);
 check('Footer line initially hidden',await page.locator('.line').evaluate(el=>getComputedStyle(el).width)==='0px');
 await page.locator('.btn-anim').hover();await page.waitForTimeout(650);
 const footer=await page.locator('.btn-anim').evaluate(el=>({width:parseFloat(getComputedStyle(el.querySelector('.line')).width),textOpacity:getComputedStyle(el.querySelector('.btn-text')).opacity}));
 check('Footer underline reaches original 1132 px',Math.abs(footer.width-1132)<1,footer);
 check('Footer text fades to 0.8',footer.textOpacity==='0.8',footer);
 await page.locator('.btn-anim').screenshot({path:'output/playwright/local-hover-footer-line.png'});
 return {passed:checks.filter(c=>c.pass).length,total:checks.length,checks};
}

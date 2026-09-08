async page => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:1000});await page.goto('http://127.0.0.1:4173/');
 const ok=page.getByRole('button',{name:'OK',exact:true});if(await ok.isVisible())await ok.click();
 await page.locator('.lead-form--inline button[type="submit"]').click();
 const invalid=await page.evaluate(()=>{const f=document.querySelector('.lead-form--inline'),r=f.getBoundingClientRect(),s=f.closest('[data-section]').getBoundingClientRect();return {errors:[...f.querySelectorAll('.lead-field-error')].map(e=>e.textContent),formBottom:r.bottom,sectionBottom:s.bottom,consentColor:getComputedStyle(f.querySelector('.lead-consent a')).color,overflow:document.documentElement.scrollWidth-innerWidth,heroSource:document.querySelector('.section-hero .photo img').currentSrc,starSource:document.querySelector('.n32 .photo img')?.currentSrc,focused:document.activeElement?.getAttribute('name')};});
 await page.screenshot({path:'output/playwright/final-inline-validation-390.png'});
 await page.goto('http://127.0.0.1:5173/');await page.locator('.section-hero .photo img').first().evaluate(e=>e.decode());
 const dev={title:await page.title(),sections:await page.locator('[data-section]').count(),image:await page.locator('.section-hero .photo img').first().evaluate(e=>e.naturalWidth)};
 await page.goto('http://127.0.0.1:5173/thankyou');const thankyou={url:page.url(),main:await page.locator('main').count(),title:await page.title()};
 return {invalid,dev,thankyou,errors};
}

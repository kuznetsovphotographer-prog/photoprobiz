async page => {
 const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [360,390,768,1440]) {
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:4173/');await page.evaluate(()=>document.fonts.ready);
  const ok=page.getByRole('button',{name:'OK',exact:true});if(await ok.isVisible())await ok.click();
  const initial=await page.locator('[data-section="inquiry"]').evaluate(e=>e.getBoundingClientRect().height);
  await page.locator('.lead-form--inline button[type="submit"]').click();await page.waitForTimeout(650);
  const invalid=await page.evaluate(()=>{const f=document.querySelector('.lead-form--inline'),r=f.getBoundingClientRect(),s=f.closest('[data-section]').getBoundingClientRect(),c=document.querySelector('.n1380').getBoundingClientRect();return{formBottom:r.bottom,cardBottom:c.bottom,sectionBottom:s.bottom,height:s.height,growth:f.closest('[data-section]').style.getPropertyValue('--form-growth'),errors:f.querySelectorAll('.lead-field-error').length,overflow:document.documentElement.scrollWidth-innerWidth};});
  if(width===390){await page.locator('.lead-form--inline button[type="submit"]').scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/final-inline-validation-fixed-390.png'});}
  await page.locator('.lead-form--inline input[name="name"]').fill('Проверка');await page.locator('.lead-form--inline input[name="contact"]').fill('9991234567');await page.waitForTimeout(100);
  const reset=await page.locator('[data-section="inquiry"]').evaluate(e=>e.getBoundingClientRect().height);
  results.push({width,initial,invalid,reset,pass:invalid.formBottom<=invalid.cardBottom&&invalid.formBottom<=invalid.sectionBottom&&Math.abs(reset-initial)<1&&invalid.overflow===0});
 }
 return {results,errors};
}

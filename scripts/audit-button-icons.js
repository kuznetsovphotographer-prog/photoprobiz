async page => {
 await page.setViewportSize({width:1440,height:1000});
 return await page.evaluate(()=>[...document.querySelectorAll('.tn-atom__button-icon')].map(e=>{const c=getComputedStyle(e),p=getComputedStyle(e,'::before'),parent=getComputedStyle(e.parentElement);return {rec:e.closest('.r')?.id,key:e.closest('[data-elem-id]')?.dataset.elemId,icon:c.getPropertyValue('--icon'),hover:c.getPropertyValue('--icon-hover'),width:c.width,height:c.height,background:p.backgroundImage,mask:p.maskImage,pseudoContent:p.content,parent:{display:parent.display,gap:parent.gap,alignItems:parent.alignItems,justifyContent:parent.justifyContent}};}));
}

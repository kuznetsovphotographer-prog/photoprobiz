async page => {
 const result={};
 for(const width of [320,480,640,961,1200]) {
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);
  result[width]=await page.evaluate(()=>[...document.querySelectorAll('[data-record-type="396"] .tn-atom__button-content')].map(e=>{const c=getComputedStyle(e),t=getComputedStyle(e.querySelector('.tn-atom__button-text'));return{rec:e.closest('.r').id,key:e.closest('[data-elem-id]').dataset.elemId,text:e.innerText,content:{display:c.display,maxWidth:c.maxWidth,width:c.width,padding:c.padding,gap:c.gap,boxSizing:c.boxSizing},label:{maxWidth:t.maxWidth,width:t.width,whiteSpace:t.whiteSpace,lineHeight:t.lineHeight}};}));
 }
 return result;
}

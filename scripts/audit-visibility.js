async page => {
 const widths=[320,480,640,960,961,1200];const result={};
 for(const width of widths){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);
  result[width]=await page.evaluate(()=>[...document.querySelectorAll('.t396__artboard')].map(a=>({id:a.dataset.artboardRecid,nodes:[...a.querySelectorAll('.tn-elem,.tn-group,.tn-molecule,.tn-atom,.tn-atom__sbs-anim-wrapper,.tn-atom__sbs-anim-wrapper-scale')].map(e=>({key:e.dataset.elemId||e.dataset.groupId||null,visibility:getComputedStyle(e).visibility,pointerEvents:getComputedStyle(e).pointerEvents,clipPath:getComputedStyle(e).clipPath,overflow:getComputedStyle(e).overflow,uc:e.dataset.uc}))})));
 }
 return result;
}

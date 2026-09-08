async page => {
 await page.setViewportSize({width:390,height:1000});await page.goto('http://127.0.0.1:4173/');
 const nodes=['n924','n1374','n125'];const get=()=>page.evaluate(ns=>ns.map(n=>{const e=document.querySelector('.'+n),r=e.getBoundingClientRect(),s=e.closest('section').getBoundingClientRect();return {n,x:r.x,y:r.y-s.y,w:r.width,h:r.height,css:{zoom:getComputedStyle(e).zoom,width:getComputedStyle(e).width,left:getComputedStyle(e).left}}}),nodes);
 const before=await get();await page.addStyleTag({content:'.n924,.n1374,.n125{zoom:calc(320px / 100vw)!important}'});return {before,after:await get()};
}

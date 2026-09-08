async page => {
 const el=page.locator('#rec2010665491');await el.scrollIntoViewIfNeeded();
 return await el.evaluate(e=>({text:e.innerText,items:[...e.querySelectorAll('.tn-elem')].map(n=>({id:n.dataset.elemId,type:n.dataset.elemType,html:n.dataset.elemType==='text'?n.innerHTML:'',css:{display:getComputedStyle(n).display,opacity:getComputedStyle(n).opacity},box:{height:n.getBoundingClientRect().height,y:n.getBoundingClientRect().y}}))}));
}

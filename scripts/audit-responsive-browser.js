async (page) => {
  const width = await page.evaluate(() => innerWidth);
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
      window.scrollTo(0,y);
      await new Promise(resolve => setTimeout(resolve,80));
    }
    window.scrollTo(0,0);
    await document.fonts.ready;
  });
  const data = await page.evaluate(() => {
    const css = el => { const s=getComputedStyle(el); return Object.fromEntries(['display','position','width','height','left','top','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','borderRadius','padding','margin','gap','transform','opacity','backgroundImage','backgroundSize','backgroundPosition','boxShadow','zIndex','textAlign','zoom'].map(k=>[k,s[k]])); };
    const box = el => { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height}; };
    return {width:innerWidth,height:document.documentElement.scrollHeight,fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})),blocks:[...document.querySelectorAll('#allrecords > div')].map(el=>({id:el.id,type:el.dataset.recordType,box:box(el),css:css(el),artboard:el.querySelector('.t396__artboard')?{attrs:Object.fromEntries([...el.querySelector('.t396__artboard').attributes].map(a=>[a.name,a.value])),box:box(el.querySelector('.t396__artboard')),css:css(el.querySelector('.t396__artboard'))}:null,elements:[...el.querySelectorAll('.tn-elem')].map(e=>({id:e.dataset.elemId,type:e.dataset.elemType,box:box(e),css:css(e),attrs:Object.fromEntries([...e.attributes].map(a=>[a.name,a.value])),html:e.querySelector('.tn-atom')?.innerHTML,atomCss:e.querySelector('.tn-atom')?css(e.querySelector('.tn-atom')):null}))})),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,type:r.initiatorType,duration:r.duration,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize}))};
  });
  return data;
}



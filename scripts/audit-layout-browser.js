async (page) => {
 await page.evaluate(()=>document.fonts.ready);
 return await page.evaluate(()=>{
  const properties=['display','position','top','right','bottom','left','width','height','minWidth','maxWidth','minHeight','maxHeight','boxSizing','flexDirection','flexWrap','flexGrow','flexShrink','flexBasis','order','alignItems','alignSelf','alignContent','justifyContent','columnGap','rowGap','overflowX','overflowY','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textTransform','textAlign','verticalAlign','whiteSpace','textDecorationLine','textDecorationColor','color','backgroundColor','backgroundImage','backgroundSize','backgroundPosition','backgroundRepeat','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderStyle','borderColor','borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius','boxShadow','filter','transform','transformOrigin','opacity','zIndex','cursor','zoom','objectFit','objectPosition'];
  const css=e=>{const s=getComputedStyle(e);return Object.fromEntries(properties.map(p=>[p,s[p]]));};
  const walk=(e,index)=>{
   const r=e.getBoundingClientRect();
   return {tag:e.tagName.toLowerCase(),id:e.id,key:e.dataset.elemId||e.dataset.groupId||null,kind:e.classList.contains('tn-elem')?'element':e.classList.contains('tn-group')?'group':e.classList.contains('tn-molecule')?'layout':e.classList.contains('tn-atom')?'content':'other',attrs:Object.fromEntries([...e.attributes].filter(a=>!a.name.startsWith('data-')).map(a=>[a.name,a.value])),css:css(e),box:{x:r.x,y:r.y+scrollY,w:r.width,h:r.height},html:e.classList.contains('tn-atom')?e.innerHTML:null,children:e.classList.contains('tn-atom')?[]:[...e.children].filter(c=>c.matches('.tn-elem,.tn-group,.tn-molecule,.tn-atom,.tn-atom__sbs-anim-wrapper,.tn-atom__sbs-anim-wrapper-scale')).map(walk)};
  };
  return {width:innerWidth,blocks:[...document.querySelectorAll('.t396__artboard')].map(a=>({id:a.dataset.artboardRecid,css:css(a),attrs:Object.fromEntries([...a.attributes].map(a=>[a.name,a.value])),parentCss:css(a.closest('.r')||a.parentElement),nodes:[...a.children].filter(n=>n.matches('.tn-elem,.tn-group')).map(walk)}))};
 });
}

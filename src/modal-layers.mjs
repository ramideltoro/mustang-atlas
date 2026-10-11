/** Keep only the top dialog interactive, including portals outside #root. */
export function createModalLayerManager(){
 const layers=[];let background=null;
 const restore=entry=>{
  entry.node.inert=entry.inert;
  if(entry.hidden==null)entry.node.removeAttribute('aria-hidden');
  else entry.node.setAttribute('aria-hidden',entry.hidden);
 };
 function sync(){layers.forEach((entry,index)=>{
  if(index===layers.length-1)restore(entry);
  else{entry.node.inert=true;entry.node.setAttribute('aria-hidden','true');}
 });}
 return {mount(node,root,body){
  if(!layers.length){background={root,body,inert:root?.inert,overflow:body.style.overflow};if(root)root.inert=true;body.style.overflow='hidden';}
  const entry={node,inert:node.inert,hidden:node.getAttribute('aria-hidden')};layers.push(entry);sync();
  return ()=>{
   const index=layers.indexOf(entry);if(index<0)return;
   layers.splice(index,1);restore(entry);sync();
   if(!layers.length&&background){if(background.root)background.root.inert=background.inert;background.body.style.overflow=background.overflow;background=null;}
  };
 }};
}
export const modalLayers=createModalLayerManager();

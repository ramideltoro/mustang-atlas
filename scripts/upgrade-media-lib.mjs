import crypto from 'node:crypto';
export const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function originalImageUrl(value){
 let url;try{url=new URL(value);}catch{return null;}
 if(url.origin!=='https://www.fordservicecontent.com'||url.username||url.password||url.pathname!=='/images/imagen/imagen2.dll'||!/^[-A-Za-z0-9_.]{1,120}$/.test(url.searchParams.get('id')||''))return null;
 url.searchParams.delete('w');url.searchParams.delete('h');return url.href;
}
export function isLargerOriginal(old,next){
 if(![old.width,old.height,next.width,next.height].every(n=>Number.isInteger(n)&&n>0))return false;
 return next.width>=old.width&&next.height>=old.height&&(next.width>old.width||next.height>old.height)&&(Math.abs((next.width/next.height)/(old.width/old.height)-1)<.035||Math.abs(old.height-next.height*old.width/next.width)<1);
}

export function reusableDocument(doc,status,map,upgradedUrls,exists){
 if(status!=='complete')return false;
 return doc.media.every(media=>{
  const asset=map.assets[media.url];
  return !asset&&!upgradedUrls.has(media.url)||!!asset&&exists(asset.url);
 });
}

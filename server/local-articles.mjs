import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import{load}from'cheerio';
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
export function createLocalArticleStore(contentDir){return id=>{
 if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,150}$/.test(id))return null;
 try{const bytes=fs.readFileSync(path.join(contentDir,'local-articles',id+'.json')),a=JSON.parse(bytes);const digest=hash({id:a.id,kind:a.kind,title:a.title,articleHtml:a.articleHtml,sourceBindings:a.sourceBindings});
  if(a.id!==id||a.review?.kind!=='local-model-review'||a.review.passed!==true||a.review.issues?.length||a.review.candidateSha256!==digest||a.review.sourceBindingsSha256!==hash(a.sourceBindings)||a.deterministicChecks?.passed!==true)return null;
  const $=load(a.articleHtml,null,false);if($('script,iframe,object,embed,form,input,button,textarea,select,base,meta,link,style,svg,math').length)return null;let unsafe=false;$('*').each((_,e)=>{for(const[k,v]of Object.entries(e.attribs||{})){if(/^on/i.test(k)||['srcdoc','style','srcset'].includes(k.toLowerCase()))unsafe=true;if(['src','href','xlink:href'].includes(k.toLowerCase())&&!/^(#|\/(?!\/)|https:\/\/)/i.test(v))unsafe=true;}});if(unsafe)return null;
  return{id:a.id,title:a.title,articleHtml:a.articleHtml,review:{kind:'local-model-review',model:a.review.model,humanReviewed:false},artifactSha256:hash(bytes)};
 }catch{return null;}
};}

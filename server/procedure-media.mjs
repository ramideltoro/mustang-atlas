import fs from 'node:fs';
import path from 'node:path';
const localUrl=/^\/media\/[a-f0-9]{64}\.mp4$/;
const playerUrl=/^https:\/\/players\.brightcove\.net\/5803674275001\/[A-Za-z0-9_]+\/index\.html\?videoId=\d+$/;
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value);
const safeTitle=value=>typeof value==='string'&&value.length>0&&value.length<=300&&!/[<>\u0000-\u001f]/.test(value);
export function stripVideoPrompt(text){return String(text||'').replace(/(?:NOTE:\s*)?Click here to view a video version of (?:this|the [^.\n]+) procedure\.?/gi,'').trim();}
export function createProcedureMediaCatalog({contentDir,dataDir}){
 const file=path.join(contentDir,'procedure-videos.json');let identity='',catalog=new Map();
 function refresh(){let next;try{const s=fs.statSync(file);next=s.mtimeMs+':'+s.size;}catch{next='missing';}if(next===identity)return;identity=next;catalog=new Map();try{const parsed=JSON.parse(fs.readFileSync(file,'utf8'));if(parsed.version===1&&Array.isArray(parsed.documents))catalog=new Map(parsed.documents.map(d=>[d.documentId,d]));}catch{}}
 function available(entry){if(!safeId(entry.id)||!safeTitle(entry.title))return false;if(entry.kind==='external-player')return playerUrl.test(entry.url)&&entry.mime==='text/html';if(entry.kind!=='local'||entry.mime!=='video/mp4'||!localUrl.test(entry.url))return false;try{const file=path.join(dataDir,entry.url.slice(1));const s=fs.statSync(file);if(s.size!==entry.bytes||s.size>80*1024*1024)return false;const fd=fs.openSync(file,'r'),header=Buffer.alloc(12);try{fs.readSync(fd,header,0,12,0);}finally{fs.closeSync(fd);}return header.toString('ascii',4,8)==='ftyp';}catch{return false;}}
 function boundEntries(original){refresh();const record=catalog.get(original.id);return record&&typeof record.sourceHash==='string'&&record.sourceHash.length>0&&record.sourceHash===(original.sourceHash||original.source_hash)&&Array.isArray(record.entries)?record.entries.filter(e=>e&&safeId(e.controlMediaId)&&typeof e.controlUrl==='string'):[];}
 function filterControls(original,media){const entries=boundEntries(original);return (media||[]).filter(m=>!entries.some(e=>e.controlMediaId===m.id&&e.controlUrl===m.url));}
 return {filterControls,apply(doc,original){const bound=boundEntries(original);if(!bound.length)return doc;
  const sourceMedia=new Map((original.media||[]).map(m=>[m.id,m]));const entries=new Map(bound.filter(e=>sourceMedia.get(e.controlMediaId)?.url===e.controlUrl).map(e=>[e.controlMediaId,e]));const videos=[];
  function walk(blocks){return(blocks||[]).flatMap(block=>{const b={...block};if(b.type==='media'&&entries.has(b.mediaId)){const entry=entries.get(b.mediaId);if(!available(entry))return [];const video={id:entry.id,url:entry.url,title:entry.title,mime:entry.mime,kind:entry.kind,...(entry.bytes?{bytes:entry.bytes}:{})};videos.push(video);return [{id:b.id,type:entry.kind==='local'?'video':'video-link',videoId:entry.id,url:entry.url,title:entry.title,mime:entry.mime}];}
   if(typeof b.text==='string')b.text=stripVideoPrompt(b.text);if(b.children)b.children=walk(b.children);if(b.items)b.items=walk(b.items);if(b.rows)b.rows=b.rows.map(r=>({...r,cells:r.cells.map(c=>({...c,text:stripVideoPrompt(c.text),...(c.blocks?{blocks:walk(c.blocks)}:{})}))}));
   if(['paragraph','safety','heading'].includes(b.type)&&!b.text?.trim()&&!b.children?.length)return [];return [b];});}
  doc.blocks=walk(doc.blocks);doc.media=(doc.media||[]).filter(m=>!entries.has(m.id));doc.videos=videos;return doc;
 }};
}

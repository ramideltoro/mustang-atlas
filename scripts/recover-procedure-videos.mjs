import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {openDb} from '../server/db.mjs';
const source=process.argv[process.argv.indexOf('--source')+1];
if(!source||source===process.argv[0])throw new Error('Use --source /path/to/original/export');
const db=openDb({readOnly:true}),dataDir=path.resolve('data'),contentFile=path.resolve('content/procedure-videos.json');
const documents=[],urls=new Map();
for(const d of db.prepare("SELECT id,title,source_hash,source_path,media FROM documents WHERE kind NOT IN ('wiring','connector') AND text LIKE '%video%'").all()){
 const filename=path.join(source,d.source_path);if(!filename.endsWith('.html')||!fs.existsSync(filename))continue;const $=load(fs.readFileSync(filename,'utf8')),media=JSON.parse(d.media),used=new Set(),entries=[];
 for(const a of $('a[href]').toArray()){
  const url=$(a).attr('href');const direct=/^https:\/\/www\.fordservicecontent\.com\/\/Ford_Content\/videos\/WorkShopManual\/[A-Za-z0-9_-]+\.mp4$/.test(url);const player=/^https:\/\/bcove\.video\/[A-Za-z0-9]+$/.test(url);if(!direct&&!player)continue;
  const image=$(a).find('img').first().attr('src')||'';const match=/^data:image\/[a-z0-9+.-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(image);if(!match)throw new Error('Expected original embedded video control: '+d.id);const hash=createHash('sha256').update(Buffer.from(match[1],'base64')).digest('hex');const control=media.find(m=>m.url.includes(hash)&&!used.has(m.id));if(!control)throw new Error('Cannot bind video control to catalog: '+d.id);used.add(control.id);
  const entry={id:d.id+'-video'+String(entries.length+1).padStart(2,'0'),controlMediaId:control.id,controlUrl:control.url,title:d.title+' — video'+(entries.length?' '+(entries.length+1):''),sourceUrl:url,kind:direct?'local':'external-player'};entries.push(entry);if(!urls.has(url))urls.set(url,{url,direct});
 }
 if(entries.length)documents.push({documentId:d.id,sourceHash:d.source_hash,entries});
}
let previous={};try{previous=JSON.parse(fs.readFileSync(contentFile));}catch{}
const previousAssets=new Map((previous.documents||[]).flatMap(d=>d.entries).map(e=>[e.sourceUrl,e]));const assets=new Map();
const queue=[...urls.values()];let done=0;
async function worker(){while(queue.length){const item=queue.shift(),old=previousAssets.get(item.url);if(old?.url?.startsWith('/media/')&&fs.existsSync(path.join(dataDir,old.url.slice(1)))){const file=fs.readFileSync(path.join(dataDir,old.url.slice(1)));if(createHash('sha256').update(file).digest('hex')===path.basename(old.url,'.mp4')){assets.set(item.url,{url:old.url,mime:old.mime,bytes:file.length});continue;}}
 if(item.direct){const probe=await fetch(item.url,{headers:{Range:'bytes=0-31'},signal:AbortSignal.timeout(30000)}),sample=Buffer.from(await probe.arrayBuffer());const total=Number(probe.headers.get('content-range')?.split('/')[1]);if(probe.status!==206||sample.toString('ascii',4,8)!=='ftyp'||!total||total>80*1024*1024)throw new Error('Unusable or oversized video: '+item.url);
  const result=await fetch(item.url,{headers:{Range:`bytes=0-${total-1}`},signal:AbortSignal.timeout(180000)});if(!result.ok||!/^video\/mp4/.test(result.headers.get('content-type')||''))throw new Error('Video unavailable: '+item.url);const chunks=[];let size=0;for await(const chunk of result.body){size+=chunk.length;if(size>total)throw new Error('Video exceeds verified size');chunks.push(chunk);}const bytes=Buffer.concat(chunks);if(bytes.length!==total||bytes.toString('ascii',4,8)!=='ftyp')throw new Error('Truncated or invalid MP4');const hash=createHash('sha256').update(bytes).digest('hex'),url='/media/'+hash+'.mp4';fs.writeFileSync(path.join(dataDir,url.slice(1)),bytes);assets.set(item.url,{url,mime:'video/mp4',bytes:bytes.length});
 }else{const result=await fetch(item.url,{signal:AbortSignal.timeout(30000)});const html=await result.text();if(!result.ok||!/^https:\/\/players\.brightcove\.net\/5803674275001\/[A-Za-z0-9_]+\/index\.html\?videoId=\d+$/.test(result.url)||!html.includes('<video-js'))throw new Error('Unavailable video player: '+item.url);assets.set(item.url,{url:result.url,mime:'text/html'});}
 console.log(JSON.stringify({completed:++done,total:urls.size,kind:item.direct?'mp4':'external-player'}));}}
await Promise.all([worker(),worker()]);
for(const d of documents)for(const entry of d.entries)Object.assign(entry,assets.get(entry.sourceUrl));
const manifest={version:1,verifiedAt:new Date().toISOString(),documents};fs.writeFileSync(contentFile+'.tmp',JSON.stringify(manifest,null,2)+'\n');fs.renameSync(contentFile+'.tmp',contentFile);db.close();console.log(JSON.stringify({documents:documents.length,videos:assets.size,localBytes:[...assets.values()].reduce((n,a)=>n+(a.bytes||0),0),manifest:contentFile}));

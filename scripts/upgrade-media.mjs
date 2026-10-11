import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {load} from 'cheerio';
import sharp from 'sharp';
import {saveAsset} from '../server/parser.mjs';
import {digest,originalImageUrl,isLargerOriginal,reusableDocument} from './upgrade-media-lib.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const configFile=option('--session-config'),cookieFile=option('--session-cookies');
if(!configFile||!cookieFile)throw Error('Provide --session-config and --session-cookies paths for the existing Ford session. Credentials are never saved or printed.');
const data=path.resolve(option('--data','data')),root=path.join(data,'media-upgrade');fs.mkdirSync(root,{recursive:true});
const config=JSON.parse(fs.readFileSync(configFile,'utf8')).workshop;
const cookie=fs.readFileSync(cookieFile,'utf8').split(';').map(c=>c.trim()).filter(c=>c.startsWith('CONTENT_PERMISSIONS=')).join('; ');
const mapFile=path.join(data,'media-quality.json'),stateFile=path.join(root,'state.json'),lock=path.join(root,'worker.pid');
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function atomic(file,value){fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2));fs.renameSync(file+'.tmp',file);}
if(fs.existsSync(lock)){try{process.kill(Number(fs.readFileSync(lock)),0);throw Error('Media upgrade already running');}catch(e){if(e.code!=='ESRCH')throw e;}}
fs.writeFileSync(lock,String(process.pid));
const catalog=new DatabaseSync(path.join(data,'atlas.sqlite'),{readOnly:true});
const all=catalog.prepare('SELECT id,title,media,source_path FROM documents').all().map(d=>({...d,media:JSON.parse(d.media)}));
const originals=new Map(all.flatMap(d=>d.media).map(m=>[m.url,m]));
const map=read(mapFile,{version:1,assets:{}}),state=read(stateFile,{version:1,documents:{},images:{}});
let stop=false,dirty=0,networkActive=0;const waiting=[],imageJobs=new Map();
const concurrency=Math.min(6,Math.max(1,Number(option('--concurrency','4'))));
const first=new Set(option('--first','G2214748').split(','));
const candidates=all.filter(d=>/^G\d+(?:-[a-f0-9]{8})?$/.test(d.id)&&d.media.some(m=>m.mime==='image/jpeg'));
const limit=Number(option('--limit','0'));
const upgradedUrls=new Set(Object.values(state.images).filter(i=>i.result==='upgraded').map(i=>i.originalUrl));
const pending=candidates.filter(d=>!reusableDocument(d,state.documents[d.id]?.status,map,upgradedUrls,url=>/^\/media\/[a-f0-9]{64}\.(jpg|jpeg|png|gif|webp)$/.test(url)&&fs.existsSync(path.join(data,url.slice(1))))).sort((a,b)=>Number(first.has(b.id))-Number(first.has(a.id)));
if(limit)pending.splice(limit);
const startedAt=new Date().toISOString();
const report={state:'running',pid:process.pid,startedAt,documents:candidates.length,processed:0,failed:0,upgraded:0,nativeAlready:0};
function checkpoint(force=false){if(!force&&dirty<12)return;dirty=0;atomic(mapFile,map);atomic(stateFile,state);atomic(path.join(data,'media-quality-progress.json'),{...report,updatedAt:new Date().toISOString(),completedDocuments:Object.values(state.documents).filter(d=>d.status==='complete').length,upgradedAssets:Object.keys(map.assets).length});}
function log(event){console.log(JSON.stringify({time:new Date().toISOString(),...event}));}
async function request(url,options={}){
 if(networkActive>=concurrency)await new Promise(resolve=>waiting.push(resolve));networkActive++;
 try{for(let attempt=0;attempt<3;attempt++){
  try{const response=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(45000)});
   if(response.status===429||response.status>=500){if(attempt<2){await delay(Math.min(20000,Number(response.headers.get('retry-after'))*1000||1000*(attempt+1)));continue;}}
   if(response.status!==200)throw Error('Source request HTTP '+response.status);
   return {bytes:Buffer.from(await response.arrayBuffer()),mime:(response.headers.get('content-type')||'').split(';')[0]};
  }catch(error){if(attempt===2||/HTTP (?:30\d|401|403)/.test(error.message))throw Error(/HTTP/.test(error.message)?error.message:'Source request timed out or failed');await delay(1000*(attempt+1));}
 }}finally{networkActive--;waiting.shift()?.();}
}
async function upgrade(url){
 if(imageJobs.has(url))return imageJobs.get(url);
 const job=(async()=>{
  const prior=state.images[url];if(prior?.status==='complete'&&(prior.result!=='upgraded'||map.assets[prior.originalUrl]&&fs.existsSync(path.join(data,map.assets[prior.originalUrl].url.slice(1)))))return prior;
  const nativeUrl=originalImageUrl(url);if(!nativeUrl)return {status:'complete',result:'not-resizable'};
  const low=await request(url);const ext={'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/webp':'webp'}[low.mime];
  if(!ext)throw Error('Source returned an unsupported image format');
  const oldUrl='/media/'+digest(low.bytes)+'.'+ext;const old=originals.get(oldUrl);
  if(!old){const result={status:'unmatched',result:'source-does-not-match-catalog'};state.images[url]=result;return result;}
  if(map.assets[oldUrl]&&fs.existsSync(path.join(data,map.assets[oldUrl].url.slice(1))))return state.images[url]={status:'complete',result:'upgraded',originalUrl:oldUrl};
  const high=nativeUrl===url?low:await request(nativeUrl);if(!/^image\/(jpeg|png|webp|gif)$/.test(high.mime))throw Error('Original image format unavailable');
  const metadata=await sharp(high.bytes,{limitInputPixels:150000000}).metadata();
  let result='native-already';
  if(isLargerOriginal(old,metadata)){
   const asset=await saveAsset(high.bytes,high.mime,data);map.assets[oldUrl]={...asset,sourceWidth:old.width,sourceHeight:old.height,sourceUrl:nativeUrl};report.upgraded++;result='upgraded';
  }else if(metadata.width!==old.width||metadata.height!==old.height)throw Error('Original image geometry differs; retained existing image');else report.nativeAlready++;
  state.images[url]={status:'complete',result,originalUrl:oldUrl};dirty++;checkpoint();return state.images[url];
 })();imageJobs.set(url,job);try{return await job;}catch(error){imageJobs.delete(url);throw error;}
}
async function documentWorker(){while(pending.length&&!stop){const doc=pending.shift();try{
 const url=new URL('https://www.fordservicecontent.com/Ford_Content/PublicationRuntimeRefreshPTS//publication/Proc');url.searchParams.set('environment',config.environment||'prod_1_3_362022');
 const response=await request(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Cookie:cookie,Origin:'https://www.fordtechservice.dealerconnection.com',Referer:'https://www.fordtechservice.dealerconnection.com/'},body:new URLSearchParams({fromPageBase:'https://www.fordtechservice.dealerconnection.com',isMobile:'no',usertype:'Retailer',...config,searchNumber:doc.id.replace(/-[a-f0-9]{8}$/,'')})});
 const $=load(response.bytes.toString());if(!$('meta[name="tps_proctitle"]').length)throw Error('Ford session returned no procedure content');
 const urls=[...new Set($('img').toArray().map(e=>e.attribs.src).filter(src=>originalImageUrl(src)))];
 const results=[];for(const url of urls){if(stop)break;try{results.push(await upgrade(url));}catch(error){results.push({status:'error',error:error.message});log({event:'image-error',documentId:doc.id,error:error.message});if(/HTTP (?:30\d|401|403)/.test(error.message)){stop=true;report.state='source-access-required';}}}
 const unmatched=results.filter(r=>r.status!=='complete').length;
 state.documents[doc.id]={status:stop?'interrupted':unmatched?'needs-review':'complete',images:urls.length,unmatched,checkedAt:new Date().toISOString()};
 report.processed++;dirty++;if(report.processed%20===0||first.has(doc.id))log({event:'documents',processed:report.processed,remaining:pending.length,upgradedAssets:Object.keys(map.assets).length,documentId:doc.id,unmatched});checkpoint();
 }catch(error){report.failed++;state.documents[doc.id]={status:'error',error:error.message};log({event:'document-error',documentId:doc.id,error:error.message});if(/HTTP (?:30\d|401|403)|no procedure content/.test(error.message)){stop=true;report.state='source-access-required';}dirty++;checkpoint();}
}}
process.on('SIGINT',()=>stop=true);process.on('SIGTERM',()=>stop=true);
try{checkpoint(true);await Promise.all(Array.from({length:concurrency},documentWorker));if(report.state==='running')report.state=stop?'stopped':candidates.some(d=>state.documents[d.id]?.status&&state.documents[d.id].status!=='complete')?'needs-review':candidates.some(d=>!state.documents[d.id])?'partial':'complete';checkpoint(true);log({event:'finished',...report,upgradedAssets:Object.keys(map.assets).length});}finally{catalog.close();fs.rmSync(lock,{force:true});}

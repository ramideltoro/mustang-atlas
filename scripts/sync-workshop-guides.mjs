import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {marked} from 'marked';
import {createMaintenanceGuideCatalog} from '../server/maintenance-guides.mjs';
import {createAssetQualityStore} from '../server/asset-quality.mjs';
import {documentApplicability, isPublicDocument} from '../server/catalog.mjs';

const MB=1024*1024;
const files={'maintenance-guides.json':8*MB,'workshop-guides.json':32*MB,'workshop-coverage.json':32*MB,'procedure-videos.json':8*MB};
const optional=new Set(['procedure-videos.json']);
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const identity=file=>{try{const s=fs.statSync(file);return `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(v);
const safeAsset=/^\/media\/[a-f0-9]{64}\.(?:png|jpe?g|gif|webp|svg)$/;
const atomic=(file,value)=>{fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2)+'\n',{mode:0o600});fs.renameSync(file+'.tmp',file);};

// Read identities before and after the complete set, not just each file. The
// author replaces guides and coverage separately; semantic checks below also
// reject the short interval where only one of those replacements has occurred.
export function readStableWorkshopSnapshot(contentDir){
 const before=Object.fromEntries(Object.keys(files).map(name=>[name,identity(path.join(contentDir,name))]));
 const snapshot={};
 for(const[name,max]of Object.entries(files)){
  if(before[name]===null&&optional.has(name))continue;
  const file=path.join(contentDir,name),stat=fs.statSync(file);
  if(!stat.isFile()||stat.size>max)throw Error(`Invalid snapshot file size: ${name}`);
  snapshot[name]=fs.readFileSync(file);
 }
 for(const name of Object.keys(files))if(identity(path.join(contentDir,name))!==before[name])throw Error('Content changed while reading publication snapshot; retry.');
 return snapshot;
}

export function validateWorkshopSnapshot(db,{snapshot,dataDir,assetResolver=m=>m}){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-workshop-publication-'));
 const issues=[];const fail=(reason,extra={})=>issues.push({reason,...extra});
 try{
  for(const name of Object.keys(files)){
   if(!snapshot[name]){if(!optional.has(name))fail('missing-snapshot-file',{file:name});continue;}
   if(snapshot[name].length>files[name]){fail('oversized-snapshot-file',{file:name});continue;}
   fs.writeFileSync(path.join(temp,name),snapshot[name]);
  }
  if(issues.length)return{ok:false,issues};
  const seed=JSON.parse(snapshot['maintenance-guides.json']),workshop=JSON.parse(snapshot['workshop-guides.json']),coverage=JSON.parse(snapshot['workshop-coverage.json']);
  const catalog=createMaintenanceGuideCatalog(db,{contentDir:temp,assetResolver}),report=catalog.report();
  issues.push(...report.errors);
  if(!Array.isArray(workshop.guides)||report.workshopGuides!==workshop.guides.length)fail('not-all-workshop-guides-accepted');
  if(!Array.isArray(seed.guides)||report.guides!==seed.guides.length+workshop.guides.length)fail('not-all-guides-accepted');
  if(coverage.version!==1||!Array.isArray(coverage.documents))return{ok:false,issues:[...issues,{reason:'invalid-coverage-manifest'}]};
  const docs=new Map(db.prepare('SELECT id,title,kind,system_id,section_code,section_title,engines,source_hash,media,length(text) text_length FROM documents').all().filter(isPublicDocument).map(d=>[d.id,d]));
  const guides=new Map([...(seed.guides||[]),...(workshop.guides||[])].map(g=>[g.id,g]));
  const accepted=new Set(report.guideIds),records=new Map(),boundGuides=new Set(),assets=new Set();
  const bound=(id,docId)=>{const d=docs.get(docId);return d&&accepted.has(id)&&guides.get(id)?.sourceRefs?.some(r=>r.documentId===docId&&r.sourceHash===d.source_hash);};
  for(const r of coverage.documents){
   const d=docs.get(r.documentId);if(records.has(r.documentId))fail('duplicate-coverage-document',{documentId:r.documentId});records.set(r.documentId,r);
   if(!d||r.sourceHash!==d.source_hash){fail('stale-coverage-source',{documentId:r.documentId});continue;}
   if(!['covered','pending','pointer','unsupported','reserved'].includes(r.status))fail('invalid-coverage-status',{documentId:d.id});
   if(!Array.isArray(r.guideIds)||!r.guideIds.every(safeId)||new Set(r.guideIds).size!==r.guideIds.length||!Array.isArray(r.sections)){fail('invalid-coverage-bindings',{documentId:d.id});continue;}
   if(r.status==='covered'&&!r.guideIds.length)fail('covered-without-guide',{documentId:d.id});
   if(['unsupported','reserved'].includes(r.status)&&(r.guideIds.length||!r.reason?.trim()))fail('unavailable-coverage-claims-guide',{documentId:d.id});
   const targets=r.status==='pointer'?r.destinationIds:[d.id];
   if(!Array.isArray(targets)||!targets.length||new Set(targets).size!==targets.length||targets.some(id=>!safeId(id)||!docs.has(id)||(r.status==='pointer'&&id===d.id))){fail('invalid-coverage-destinations',{documentId:d.id});continue;}
   for(const id of r.guideIds){
    if(!targets.some(target=>bound(id,target)))fail('coverage-guide-unbound',{documentId:d.id,guideId:id});
    else if(r.status!=='pointer')boundGuides.add(id);
    if(r.status==='pointer'&&guides.has(id)){const engines=documentApplicability(d).engines;if(engines.length&&!engines.some(e=>guides.get(id).applicability.engines.includes(e)))fail('pointer-guide-engine-mismatch',{documentId:d.id,guideId:id});}
   }
   const seen=new Set();for(const s of r.sections){
    if(!safeId(s.id)||seen.has(s.id))fail('duplicate-or-invalid-section',{documentId:d.id});seen.add(s.id);
    if(!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end<=s.start||s.end>d.text_length)fail('invalid-section-range',{documentId:d.id,sectionId:s.id});
    if(!['covered','pending'].includes(s.status))fail('invalid-section-status',{documentId:d.id,sectionId:s.id});
    if(s.status==='covered'&&(!r.guideIds.includes(s.guideId)||!bound(s.guideId,d.id)))fail('covered-section-unbound',{documentId:d.id,sectionId:s.id});
    if(r.status==='covered'&&s.status!=='covered')fail('covered-document-has-pending-section',{documentId:d.id});
   }
   if(r.status==='covered'&&!r.sections.length&&!r.reason?.trim())fail('curated-coverage-needs-scope-reason',{documentId:d.id});
  }
  for(const d of docs.values())if(['repair','diagnosis'].includes(d.kind)&&!records.has(d.id))fail('technical-document-missing-from-coverage',{documentId:d.id});
  for(const r of records.values())if(r.status==='pointer'&&r.destinationCoverage==='covered'&&r.destinationIds?.some(id=>records.get(id)?.status!=='covered'))fail('pointer-destination-not-covered',{documentId:r.documentId});
  for(const g of workshop.guides||[])if(!boundGuides.has(g.id))fail('workshop-guide-missing-from-coverage',{guideId:g.id});
  const mediaCache=new Map();
  const mediaFor=id=>{if(!mediaCache.has(id))mediaCache.set(id,JSON.parse(docs.get(id)?.media||'[]'));return mediaCache.get(id);};
  function checkAsset(m,guideId){
   if(!m)return;
   if(!safeAsset.test(m.url)||!m.documentId||!mediaFor(m.documentId).some(v=>v.id===m.id)){fail('invalid-public-image-reference',{guideId});return;}
   const file=path.resolve(dataDir,m.url.slice(1));
   try{if(!fs.statSync(file).isFile()||fs.statSync(file).size===0)throw Error('empty');}catch{fail('missing-image-file',{guideId,mediaId:m.id});}
   assets.add(m.url);
  }
  function strings(v){return typeof v==='string'?[v]:Array.isArray(v)?v.flatMap(strings):v&&typeof v==='object'?Object.values(v).flatMap(strings):[];}
  for(const g of guides.values()){
   for(const p of g.procedures||[])if(!bound(g.id,p.documentId))fail('unbound-procedure',{guideId:g.id,documentId:p.documentId});
   for(const target of g.relatedGuideIds||[])if(!accepted.has(target))fail('unavailable-related-guide',{guideId:g.id,target});
   if(g.hero){const m=mediaFor(g.hero.documentId).find(m=>m.id===g.hero.mediaId);if(g.hero.mediaId&&!m)fail('missing-hero-media',{guideId:g.id});if(m)checkAsset({...assetResolver(m),documentId:g.hero.documentId},g.id);}
   for(const text of strings(g))marked.walkTokens(marked.lexer(text),token=>{
    if(!['link','image'].includes(token.type))return;
    const href=token.href,docMatch=/^#\/document\/([A-Za-z0-9_-]+)$/.exec(href),guideMatch=/^#\/maintenance\/([A-Za-z0-9_-]+)$/.exec(href);
    if(docMatch){if(token.type==='image'||!bound(g.id,docMatch[1]))fail('unbound-inline-article-link',{guideId:g.id,target:href});}
    else if(guideMatch){if(token.type==='image'||(guideMatch[1]!=='schedule'&&!accepted.has(guideMatch[1]))||(guideMatch[1]==='schedule'&&!report.schedule))fail('unavailable-inline-guide-link',{guideId:g.id,target:href});}
    else if(token.type==='image'&&safeAsset.test(href)){
     const ref=(g.sourceRefs||[]).flatMap(r=>mediaFor(r.documentId).map(m=>({...assetResolver(m),documentId:r.documentId}))).find(m=>m.url===href);
     if(ref)checkAsset(ref,g.id);else fail('unbound-inline-image',{guideId:g.id});
    }else{
     const allowed=(g.evidence||[]).map(id=>workshop.evidence?.[id]?.url||seed.evidence?.[id]?.url);
     if(token.type==='image'||!allowed.includes(href)||!/^https:\/\/www\.fordservicecontent\.com\//.test(href))fail('unsupported-inline-link',{guideId:g.id,target:href});
    }
   });
   for(const engine of ['all',...(g.applicability?.engines||[])]){
    const detail=catalog.detail(g.id,{engine});if(!detail)continue;
    checkAsset(detail.thumbnail,g.id);for(const p of detail.procedures)checkAsset(p.thumbnail,g.id);for(const r of detail.relatedGuides)checkAsset(r.thumbnail,g.id);
   }
  }
  return{ok:issues.length===0,issues,guides:report.guides,workshopGuides:report.workshopGuides,coverageDocuments:records.size,coveredDocuments:[...records.values()].filter(r=>r.status==='covered').length,assets:[...assets].sort(),hashes:Object.fromEntries(Object.entries(snapshot).map(([name,bytes])=>[name,digest(bytes)]))};
 }catch(error){return{ok:false,issues:[...issues,{reason:'snapshot-validation-failed',message:error.message}]};}
 finally{fs.rmSync(temp,{recursive:true,force:true});}
}

export function deploymentTarget(env=process.env){
 const host=env.ATLAS_DEPLOY_HOST||'65.75.201.18',content=env.ATLAS_DEPLOY_CONTENT||'/srv/mustang-atlas/content/',data=env.ATLAS_DEPLOY_DATA||'/srv/mustang-atlas/data/';
 if(!/^[A-Za-z0-9][A-Za-z0-9@.-]*$/.test(host)||[content,data].some(v=>!/^\/[A-Za-z0-9/_-]+\/$/.test(v)||v.split('/').includes('..')))throw Error('Invalid deployment destination');
 return{host,content,data};
}
export function remotePublicationScript({target,hashes,databaseHash,assets,tempName}){
 if(!/^[a-f0-9]{64}$/.test(databaseHash)||!/^\.workshop-guides\.[a-f0-9]{20}\.tmp$/.test(tempName)||Object.values(hashes).some(h=>!/^[a-f0-9]{64}$/.test(h))||assets.some(a=>!safeAsset.test(a)))throw Error('Unsafe publication metadata');
 deploymentTarget({ATLAS_DEPLOY_HOST:target.host,ATLAS_DEPLOY_CONTENT:target.content,ATLAS_DEPLOY_DATA:target.data});
 const check=(hash,file)=>`printf '%s  %s\\n' '${hash}' '${file}' | sha256sum --check --status`;
 return ['set -eu',`trap 'rm -f -- "${target.content+tempName}"' EXIT`,check(databaseHash,target.data+'atlas.sqlite'),check(hashes['maintenance-guides.json'],target.content+'maintenance-guides.json'),...(hashes['procedure-videos.json']?[check(hashes['procedure-videos.json'],target.content+'procedure-videos.json')]:[`test ! -e '${target.content}procedure-videos.json'`]),...(assets.length?["sha256sum --check --status <<'ATLAS_ASSETS'",...assets.map(a=>`${path.basename(a).split('.')[0]}  ${target.data+a.slice(1)}`),'ATLAS_ASSETS']:[]),check(hashes['workshop-guides.json'],target.content+tempName),`chmod 644 '${target.content+tempName}'`,`mv -- '${target.content+tempName}' '${target.content}workshop-guides.json'`,check(hashes['workshop-guides.json'],target.content+'workshop-guides.json'),''].join('\n');
}

async function fileHash(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
function command(cmd,args,input){return new Promise(resolve=>{const child=spawn(cmd,args,{stdio:['pipe','ignore','pipe']});let error='',done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timeout);resolve({ok,error});};const timeout=setTimeout(()=>{error='Command timed out';child.kill('SIGKILL');finish(false);},120000);child.stderr.on('data',b=>{error=(error+b.toString()).slice(-3000);});child.on('error',e=>{error=e.message;finish(false);});child.on('exit',code=>finish(code===0));child.stdin.on('error',()=>{});child.stdin.end(input||'');});}
function alive(file){try{const pid=Number(fs.readFileSync(file,'utf8'));if(!Number.isInteger(pid)||pid<2)return false;process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}}
function acquire(file){for(let attempt=0;attempt<2;attempt++){try{fs.writeFileSync(file,String(process.pid),{flag:'wx',mode:0o600});return;}catch(e){if(e.code!=='EEXIST')throw e;if(alive(file))throw Error('Workshop publisher is already running');fs.unlinkSync(file);}}throw Error('Unable to acquire publisher lock');}

export async function main(args=process.argv.slice(2)){
 if(args.some(a=>!['--publish','--dry-run','--watch'].includes(a))||(args.includes('--publish')&&args.includes('--dry-run'))||args.includes('--watch')&&!args.includes('--publish'))throw Error('Usage: node scripts/sync-workshop-guides.mjs [--dry-run | --publish [--watch]]');
 const publish=args.includes('--publish'),watch=args.includes('--watch'),target=deploymentTarget();
 const contentDir=path.resolve('content'),dataDir=path.resolve(process.env.DATA_DIR||'data'),root=path.resolve('work/workshop-author'),dbFile=path.join(dataDir,'atlas.sqlite');
 fs.mkdirSync(root,{recursive:true});const lock=path.join(root,'publisher.pid');acquire(lock);
 let db,stopped=false,lastHash='',failures=0;
 const stop=()=>{stopped=true;};process.on('SIGTERM',stop);process.on('SIGINT',stop);
 try{db=new DatabaseSync(dbFile,{readOnly:true});const dbIdentity=identity(dbFile),databaseHash=await fileHash(dbFile),quality=createAssetQualityStore({dataDir});do{
  const wasAlive=alive(path.join(root,'worker.pid'));
  try{
   if(identity(dbFile)!==dbIdentity)throw Error('Source database changed; restart publication against the new baseline.');
   const snapshot=readStableWorkshopSnapshot(contentDir),report=validateWorkshopSnapshot(db,{snapshot,dataDir,assetResolver:m=>quality.resolve(m)});
   if(!report.ok)throw Error('Publication rejected: '+JSON.stringify(report.issues.slice(0,12)));
   const hash=report.hashes['workshop-guides.json'];
   if(publish&&hash!==lastHash){
    const tempName='.workshop-guides.'+crypto.randomBytes(10).toString('hex')+'.tmp',local=path.join(root,tempName);
    fs.writeFileSync(local,snapshot['workshop-guides.json'],{mode:0o600});
    try{
     const copy=await command('rsync',['-az','--no-owner','--no-group','--timeout=90','-e','ssh -o BatchMode=yes -o ConnectTimeout=15',local,target.host+':'+target.content+tempName]);
     if(!copy.ok)throw Error('Workshop transfer failed: '+copy.error);
     const apply=await command('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=15',target.host,'sh -s'],remotePublicationScript({target,hashes:report.hashes,databaseHash,assets:report.assets,tempName}));
     if(!apply.ok)throw Error('Remote validation/atomic publication failed: '+apply.error);
     lastHash=hash;
     atomic(path.join(root,'publication-state.json'),{publishedAt:new Date().toISOString(),hash,coverageHash:report.hashes['workshop-coverage.json'],baselineHash:report.hashes['maintenance-guides.json'],databaseHash,workshopGuides:report.workshopGuides});
    }finally{fs.rmSync(local,{force:true});}
   }
   console.log(JSON.stringify({time:new Date().toISOString(),mode:publish?'publish':'dry-run',workshopGuides:report.workshopGuides,coveredDocuments:report.coveredDocuments,coverageDocuments:report.coverageDocuments,assets:report.assets.length,hash,validated:true}));failures=0;
   const isAlive=alive(path.join(root,'worker.pid'));if(!watch||(!wasAlive&&!isAlive))break;
   if(wasAlive&&!isAlive)continue; // Re-read after the worker's final publication.
  }catch(error){failures++;console.error(JSON.stringify({time:new Date().toISOString(),error:error.message,consecutiveFailures:failures}));if(!watch||failures>=8){process.exitCode=1;break;}}
  const seconds=failures?Math.min(60,5*2**(failures-1)):30;for(let elapsed=0;elapsed<seconds&&!stopped;elapsed+=5)await delay(Math.min(5,seconds-elapsed)*1000);
 }while(!stopped);if(stopped)process.exitCode=1;
 }finally{db?.close();process.off('SIGTERM',stop);process.off('SIGINT',stop);try{if(Number(fs.readFileSync(lock,'utf8'))===process.pid)fs.unlinkSync(lock);}catch{}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});

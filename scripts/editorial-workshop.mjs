#!/usr/bin/env node
/** Unpublished, source-bound authoring. Never writes content/ or server data. */
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {openDb} from '../server/db.mjs';
import {validateStagedCatalog} from './editorial-workshop-catalog.mjs';
import {buildWorkshopPlan,scopeEngines} from './workshop-author-plan.mjs';
import {hash,outputSchema,normalizedQuantities} from './workshop-author-lib.mjs';
import {AUTHOR,REVIEW,VERSION,reviewSchema,validateCandidate,packNodes,splitSpan,curatedSpans,spanMedia} from './editorial-workshop-lib.mjs';
const group={type:'object',additionalProperties:false,required:['id','title','summary','start','end'],properties:{id:{type:'string'},title:{type:'string'},summary:{type:'string'},start:{type:'integer'},end:{type:'integer'}}};
outputSchema.properties.guides.items.properties.stepGroups={type:'array',items:group};outputSchema.properties.guides.items.required.push('stepGroups');
const args=process.argv.slice(2),opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const root=process.cwd(),dir=path.resolve(opt('--directory','work/editorial-workshop'));
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const atomic=(f,v)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f+'.tmp',JSON.stringify(v,null,2)+'\n');fs.renameSync(f+'.tmp',f);};
const db=openDb({readOnly:true}),base=read('content/workshop-guides.json').guides;
const core=read('content/maintenance-guides.json').guides;
const plan=buildWorkshopPlan(db.prepare('select * from documents').all(),{existingGuides:core}),byId=plan.byId;
const jobMap=new Map(plan.jobs.map(j=>[j.id,j]));
const getJob=g=>jobMap.get(g.id)||{id:g.id,title:g.title,engines:g.applicability.engines,documents:(g.primaryDocumentIds?.length?g.primaryDocumentIds:g.procedures.map(p=>p.documentId)).map(id=>byId.get(id)).filter(Boolean),contextDocs:[],scopeConstraints:['Curated scope: preserve existing explicit scope boundaries; do not claim whole-source coverage.'],spans:(g.primaryDocumentIds?.length?g.primaryDocumentIds:g.procedures.map(p=>p.documentId)).map(id=>byId.get(id)).filter(Boolean).flatMap(d=>curatedSpans(g,d))};
function evidenceFor(g){
 const job=getJob(g),primary=new Set(job.documents.map(d=>d.id)),docs=new Map(job.documents.map(d=>[d.id,d]));
 for(const d of job.contextDocs||[])docs.set(d.id,d);
 if(primary.has('G1692554'))docs.set('G1716189',byId.get('G1716189'));
 if(job.kind==='repair'&&['suspension','brakes','driveline'].includes(job.systemId))for(const id of ['G1686507','G1663631']){const d=byId.get(id);if(d)docs.set(id,d);}
 for(const r of g.sourceRefs||[]){const d=byId.get(r.documentId);if(d&&d.text.length<45000)docs.set(d.id,d);}
 const unresolved=[];let frontier=[...docs.values()];
 // Expand actual access references rather than adding every system diagnostic chapter.
 for(let depth=0;depth<4;depth++){
  const next=[];for(const d of frontier)for(const id of d.related||[]){const ref=byId.get(id);if(!ref||docs.has(id)||id==='G1693180')continue;
   if((ref.kind==='repair'||/Jacking and Lifting/i.test(ref.title))&&scopeEngines(ref).some(e=>job.engines.includes(e))&&(primary.has(d.id)?job.spans.filter(s=>s.documentId===d.id).map(s=>d.text.slice(s.start,s.end)).join('\n'):d.text).toLowerCase().includes(('refer to: '+ref.title.split(' - ')[0]).toLowerCase())){docs.set(id,ref);next.push(ref);}
   else unresolved.push({from:d.id,documentId:id,title:ref.title,reason:'Reference is outside execution dependency scope; do not invent its instructions.'});
  }frontier=next;
 }
 for(const d of frontier)for(const id of d.related||[])if(!docs.has(id)&&byId.has(id)&&id!=='G1693180')unresolved.push({from:d.id,documentId:id,title:byId.get(id).title,reason:'Deeper dependency not supplied: identify an explicit boundary if essential.'});
 const nodes=[];for(const d of docs.values()){
  const spans=primary.has(d.id)?job.spans.filter(s=>s.documentId===d.id):[{id:'dependency',start:0,end:d.text.length,title:d.title}];
  for(const s of spans)for(const piece of splitSpan(d.text,s.start,s.end))nodes.push({nodeId:`${d.id}:${s.id}:${piece.start}-${piece.end}`,documentId:d.id,sourceHash:d.source_hash,sectionId:s.id,title:d.title,role:primary.has(d.id)?'primary':'dependency',engines:scopeEngines(d),start:piece.start,end:piece.end,text:piece.text,images:[]});
  // Original images are private review evidence, never copied into publication.
  const images=spanMedia(d,spans).filter(m=>m.width>=150&&m.height>=100).map(m=>({...m,documentId:d.id,sourceHash:d.source_hash}));
  for(let i=0;i<images.length;i+=6)nodes.push({nodeId:`${d.id}:images:${i}-${Math.min(images.length,i+6)}`,documentId:d.id,sourceHash:d.source_hash,sectionId:'illustrations',title:d.title,role:primary.has(d.id)?'primary-image':'dependency-image',engines:scopeEngines(d),text:'Interpret only visible details; associate images with the supplied complete text of this document. Do not infer hidden fasteners, measurements or applicability.',images:images.slice(i,i+6)});
 }

 const diagramFindings=[
  {documentId:'G1686507',sourceHash:'05bdc00833f259d6a8ccaacb05f1d7240193618e941b7779ee0612612b765454',mediaId:'G1686507-m0003',fileHash:'eca58ea6a46370bf8aa37a02ba727d63821e2151d74945d35f6fb071ea21f108',observation:'The highlighted central pilot bore has both a wiping/cleaning callout and a lubricant tube callout. Clean this bore before applying the specified thin lubricant film; do not restrict the cleaning instruction to the flat wheel mounting face.'},
  {documentId:'G1693784',sourceHash:'9249ad74482b718dd4a5dd6df7a2f5883b829920530621d8e4bd2f1c1b39a375',mediaId:'G1693784-m0001',fileHash:'861640281be52904844fb3a777dec82f4bd448c9a26c71ff6c7b04cb02e2526f',observation:'In the 2-piston brake-disc access branch, the illustration places a discard-bin symbol and x2 callout at the two caliper assembly mounting bolts. Discard and replace both of these bolts, despite the prose omitting that word. This applies to those assembly mounting bolts at115Nm, not unrelated caliper guide-pin fasteners.'}
 ];
 const observations=diagramFindings.filter(f=>{const d=docs.get(f.documentId),m=d?.media?.find(m=>m.id===f.mediaId);if(d?.source_hash!==f.sourceHash||!m)return false;const file=path.join(root,'data',m.url.replace(/^\//,''));return fs.existsSync(file)&&hash(fs.readFileSync(file))===f.fileHash;});
 const sources=[...docs.values()].map(d=>({documentId:d.id,sourceHash:d.source_hash,title:d.title,engines:scopeEngines(d)}));
 const contract={jobId:g.id,title:job.title,applicability:{...g.applicability,engines:job.engines},scopeConstraints:job.scopeConstraints||[],coveredSections:job.spans.map(s=>({documentId:s.documentId,sectionId:s.id})),sources,unresolvedDependencies:unresolved,reviewedEvidence:[...(job.evidenceSupplements||[]),...observations],relatedGuides:job.documents.some(d=>d.id==='G1692537')?[{id:'job-dc7f65eee891660d',title:'SVT Performance Package front hub: separate bolt-on assembly for5.2L'}]:[]};
 const fingerprint=hash(JSON.stringify({version:VERSION,guide:g,contract,nodes}));
 return{job,contract,nodes,fingerprint,packets:packNodes(nodes)};
}
const inventory=base.map(g=>{const e=evidenceFor(g);return{id:g.id,title:g.title,fingerprint:e.fingerprint,baseHash:hash(JSON.stringify(g)),primarySpans:e.job.spans.length,evidenceNodes:e.nodes.length,packets:e.packets.length,sourceCharacters:e.nodes.reduce((s,n)=>s+(n.text?.length||0),0),images:e.nodes.reduce((s,n)=>s+n.images.length,0),unresolvedDependencies:e.contract.unresolvedDependencies.length};});
atomic(path.join(dir,'inventory.json'),{version:VERSION,total:base.length,planned:base.filter(g=>jobMap.has(g.id)).length,curated:base.filter(g=>!jobMap.has(g.id)).length,guides:inventory});
if(!args.includes('--run')){console.log(JSON.stringify({total:base.length,planned:inventory.filter(g=>jobMap.has(g.id)).length,packets:inventory.reduce((s,g)=>s+g.packets,0),maximumPackets:Math.max(...inventory.map(g=>g.packets)),path:dir}));process.exit(0);}
const codex=opt('--codex','/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex');
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(?:API_KEY|ACCESS_TOKEN)$/.test(k)));
const auth=spawnSync(codex,['login','status'],{encoding:'utf8',env});if(!/Logged in using ChatGPT/.test(auth.stdout+auth.stderr))throw Error('Requires existing ChatGPT Codex login. No API fallback permitted.');
const pid=path.join(dir,'worker.pid');if(fs.existsSync(pid)){try{process.kill(Number(fs.readFileSync(pid)),0);throw Error('Editorial worker is already running');}catch(e){if(e.code!=='ESRCH')throw e;}}fs.writeFileSync(pid,String(process.pid));process.on('exit',()=>{try{if(Number(fs.readFileSync(pid))===process.pid)fs.unlinkSync(pid);}catch{}});
let stopped=false,child=null;process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
const ledgerFile=path.join(dir,'ledger.json');let ledger=fs.existsSync(ledgerFile)?read(ledgerFile):{};
const save=(id,record)=>{ledger[id]={...ledger[id],...record,updatedAt:new Date().toISOString()};atomic(ledgerFile,ledger);atomic(path.join(dir,'progress.json'),{pid:process.pid,state:stopped?'stopping':'running',total:base.length,reviewed:Object.values(ledger).filter(x=>x.status==='reviewed').length,needsReview:Object.values(ledger).filter(x=>['needs-review','failed'].includes(x.status)).length,active:id,updatedAt:new Date().toISOString(),method:'Signed-in Codex CLI, one process; separate source reviewer; no API calls; not human reviewed.'});};
async function imagesFor(packet,folder){const out=[];for(const n of packet)for(const m of n.images){const original=path.join(root,'data',m.url.replace(/^\//,''));if(!fs.existsSync(original))throw Error('Missing source image '+m.id);const name=path.join(folder,m.id+'.png');if(!fs.existsSync(name))await sharp(original).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png().toFile(name);out.push({path:name,documentId:m.documentId,mediaId:m.id,sha256:hash(fs.readFileSync(original)),legend:m.legend||[]});}return out;}
async function call(folder,name,prompt,schema,images=[]){
 fs.mkdirSync(folder,{recursive:true});const output=path.join(folder,name+'.json'),schemaFile=path.join(folder,name+'.schema.json'),promptFile=path.join(folder,name+'.prompt.txt');const callHash=hash(JSON.stringify({prompt,schema,images:images.map(i=>({sha256:i.sha256,mediaId:i.mediaId}))}));
 const checkpoint=output+'.checkpoint';if(fs.existsSync(output)&&fs.existsSync(checkpoint)&&fs.readFileSync(checkpoint,'utf8')===callHash)return read(output);
 atomic(schemaFile,schema);fs.writeFileSync(promptFile,prompt);fs.writeFileSync(path.join(folder,'AGENTS.md'),'This is a bounded offline editorial task. Use only supplied evidence and attached images. Do not run tools, browse, read other files, delegate or alter files. Return the requested JSON.');
 const log=fs.openSync(path.join(folder,name+'.log'),'w');
 try{await new Promise((resolve,reject)=>{child=spawn(codex,['exec','--skip-git-repo-check','--ephemeral','--sandbox','read-only','--color','never','--output-schema',schemaFile,'--output-last-message',output,...images.flatMap(i=>['--image',i.path]),'-'],{cwd:folder,env,stdio:['pipe',log,log]});child.stdin.on('error',()=>{});child.stdin.end(prompt);const timeout=setTimeout(()=>{child?.kill('SIGTERM');reject(Error('Codex call exceeded 25-minute limit'));},25*60*1000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timeout);child=null;code===0?resolve():reject(Error('Codex failed; inspect '+name+'.log'));});});}finally{fs.closeSync(log);}
 const result=read(output);fs.writeFileSync(checkpoint,callHash);return result;
}
const ids=opt('--ids','').split(',').filter(Boolean),limit=Number(opt('--limit','0'));let count=0;
for(const baseGuide of base.filter(g=>!ids.length||ids.includes(g.id))){
 if(stopped||fs.existsSync(path.join(dir,'stop-after-current'))||limit&&count>=limit)break;
 const e=evidenceFor(baseGuide),id=baseGuide.id;const stagedPath=path.join(dir,'reviewed',id+'.json');if(fs.existsSync(stagedPath)){const staged=read(stagedPath);if(staged.guide.authoring?.editorialVersion===VERSION&&JSON.stringify(staged.guide)===JSON.stringify(baseGuide)&&staged.guide.sourceRefs.every(r=>byId.get(r.documentId)?.source_hash===r.sourceHash)){save(id,{status:'reviewed',published:true,fingerprint:e.fingerprint});continue;}}const textContext=e.nodes.reduce((n,v)=>n+v.text.length,0)<=90000?e.nodes.filter(n=>n.text&&n.images.length===0):[];if(ledger[id]?.fingerprint===e.fingerprint&&ledger[id]?.status==='reviewed')continue;
 if(!args.includes('--retry')&&ledger[id]?.fingerprint===e.fingerprint&&['needs-review','failed'].includes(ledger[id]?.status))continue;
 count++;const folder=path.join(dir,'jobs',id,e.fingerprint.slice(0,16));fs.mkdirSync(folder,{recursive:true});atomic(path.join(folder,'manifest.json'),{id,fingerprint:e.fingerprint,baseHash:hash(JSON.stringify(baseGuide)),contract:e.contract,nodes:e.nodes});save(id,{status:'authoring',fingerprint:e.fingerprint,folder});
 try{
  let candidate=null;const imageLists=[];
  for(let i=0;i<e.packets.length;i++){
   const packet=e.packets[i],images=await imagesFor(packet,folder);imageLists.push(images);
   const payload={contract:e.contract,packetIndex:i,packetCount:e.packets.length,evidence:packet,textContext,images:images.map(({path,...v})=>v),existingGuide:baseGuide,previousDraft:candidate};
   const result=await call(folder,`author-${i}`,AUTHOR+'\n'+JSON.stringify(payload),outputSchema,images);candidate=result.guides?.[0];if(!candidate)throw Error('Missing author result');save(id,{status:'authoring',authoredPackets:i+1,packets:e.packets.length});
  }
  let reviews=[],errors=[];
  for(let attempt=0;attempt<2;attempt++){
   errors=validateCandidate(candidate,e.contract,e.nodes);reviews=[];save(id,{status:'reviewing',attempt});
   for(let i=0;i<e.packets.length;i++){
    const result=await call(folder,`review-${attempt}-${i}`,REVIEW+'\n'+JSON.stringify({contract:e.contract,candidate,evidence:e.packets[i],textContext,images:imageLists[i].map(({path,...v})=>v),mechanicalErrors:errors,packetIndex:i,packetCount:e.packets.length}),reviewSchema,imageLists[i]);reviews.push(result);
    const expected=e.packets[i].map(n=>n.nodeId).sort(),actual=result.coverage.map(n=>n.nodeId).sort();if(JSON.stringify(expected)!==JSON.stringify(actual))errors.push('Reviewer did not account for every source node in packet '+i);
   }
   const issues=[...errors,...reviews.flatMap(r=>r.issues.map(v=>`${v.severity}: ${v.location}: ${v.problem} Fix: ${v.correction}`))];
   if(!errors.length&&reviews.every(r=>r.verdict==='approve'&&r.coverage.every(n=>n.status==='covered'||n.status==='not-applicable')))break;
   if(attempt===1||reviews.some(r=>r.verdict==='needs-evidence'))break;
   for(let i=0;i<e.packets.length;i++){
    const result=await call(folder,`revise-${i}`,AUTHOR+'\nRevise the candidate to address independent technical review. Preserve every correct earlier section.\n'+JSON.stringify({contract:e.contract,evidence:e.packets[i],textContext,previousDraft:candidate,reviewIssues:issues,packetIndex:i,packetCount:e.packets.length}),outputSchema,imageLists[i]);candidate=result.guides?.[0];if(!candidate)throw Error('Missing revision');
   }
  }
  const accepted=!errors.length&&candidate.status==='complete'&&reviews.every(r=>r.verdict==='approve'&&r.coverage.every(n=>n.status==='covered'||n.status==='not-applicable'));
  atomic(path.join(folder,'result.json'),{candidate,reviews,errors,accepted});
  if(accepted){const {jobId,status,concern,coveredSections,equipment,...body}=candidate;const guide={...baseGuide,...body,hero:baseGuide.hero,procedures:candidate.procedures.map(p=>({...baseGuide.procedures.find(v=>v.documentId===p.documentId),...p})),applicability:{...e.contract.applicability,...(equipment?{equipment}:{})},relatedGuideIds:[...new Set([...(baseGuide.relatedGuideIds||[]),...(e.contract.relatedGuides||[]).map(g=>g.id)])],sourceRefs:e.contract.sources.map(({documentId,sourceHash})=>({documentId,sourceHash})),authoring:{...baseGuide.authoring,editorialVersion:VERSION,editorialFingerprint:e.fingerprint,independentSourceReview:true,humanReviewed:false}};const staged={guide,baseHash:hash(JSON.stringify(baseGuide)),fingerprint:e.fingerprint,reviewFolder:folder,reviewedAt:new Date().toISOString()};const catalogValidation=validateStagedCatalog(db,[staged],{directory:dir});atomic(path.join(folder,'catalog-validation.json'),catalogValidation);if(!catalogValidation.valid)throw Error('Catalog validation rejected candidate: '+JSON.stringify(catalogValidation.errors));atomic(path.join(dir,'reviewed',id+'.json'),staged);}
  save(id,{status:accepted?'reviewed':'needs-review',errors,issues:reviews.flatMap(r=>r.issues),reviewedPackets:reviews.length});console.log(id+' '+(accepted?'reviewed':'needs-review'));
 }catch(error){save(id,{status:'failed',error:String(error)});console.error(id+': '+error.message);const logs=fs.readdirSync(folder).filter(f=>f.endsWith('.log')).map(f=>fs.readFileSync(path.join(folder,f),'utf8')).join('\n');if(/usage limit|quota|rate.limit|not authenticated|sign.in required/i.test(logs)){stopped=true;save(id,{status:'failed',stopReason:'Codex authentication or usage limit; no API fallback.'});}}
}
atomic(path.join(dir,'progress.json'),{state:stopped?'stopped':'idle',total:base.length,reviewed:Object.values(ledger).filter(x=>x.status==='reviewed').length,needsReview:Object.values(ledger).filter(x=>['needs-review','failed'].includes(x.status)).length,remaining:base.filter(g=>ledger[g.id]?.status!=='reviewed').length,updatedAt:new Date().toISOString()});

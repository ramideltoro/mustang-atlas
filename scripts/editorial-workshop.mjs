#!/usr/bin/env node
/** Unpublished, source-bound authoring. Never writes content/ or server data. */
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {openDb} from '../server/db.mjs';
import {validateStagedCatalog} from './editorial-workshop-catalog.mjs';
import {buildWorkshopPlan,scopeEngines} from './workshop-author-plan.mjs';
import {hash,outputSchema,normalizedQuantities} from './workshop-author-lib.mjs';
import {AUTHOR,REVIEW,VERSION,reviewSchema,validateCandidate,packNodes,splitSpan,curatedSpans,spanMedia,reviewCoverageErrors,renderEvidenceImage} from './editorial-workshop-lib.mjs';
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
const getJob=g=>jobMap.get(g.id)||{id:g.id,title:g.title,kind:g.taskType,engines:g.applicability.engines,documents:(g.primaryDocumentIds?.length?g.primaryDocumentIds:g.procedures.map(p=>p.documentId)).map(id=>byId.get(id)).filter(Boolean),contextDocs:[],scopeConstraints:['Curated scope: preserve existing explicit scope boundaries; do not claim whole-source coverage.'],spans:(g.primaryDocumentIds?.length?g.primaryDocumentIds:g.procedures.map(p=>p.documentId)).map(id=>byId.get(id)).filter(Boolean).flatMap(d=>curatedSpans(g,d))};
// A recovered private PDF procedure supplements one missing indexed dependency.
const headlinerSupplementFile=path.join(root,'work/editorial-workshop/evidence/access-audit/headliner-supplement.json');
const headlinerSupplement=fs.existsSync(headlinerSupplementFile)?read(headlinerSupplementFile):null;
if(headlinerSupplement){if(hash(fs.readFileSync(headlinerSupplement.pdfPath))!==headlinerSupplement.sourceHash||hash(headlinerSupplement.text)!==headlinerSupplement.textHash)throw Error('Recovered headliner source changed');for(const m of headlinerSupplement.images){if(hash(fs.readFileSync(path.join(root,m.privatePath)))!==m.sha256)throw Error('Recovered headliner figure changed');}}
function evidenceFor(g){
 const job=getJob(g),primary=new Set(job.documents.map(d=>d.id)),docs=new Map(job.documents.map(d=>[d.id,d]));
 const dependencySpans=new Map();
 const recoveredHeadliner=g.id==='job-182f6103a6e8f1af'?headlinerSupplement:null;
 if(recoveredHeadliner)for(const ref of recoveredHeadliner.dependencies){const d=byId.get(ref.id);if(d?.source_hash!==ref.sourceHash)throw Error('Recovered headliner dependency changed');docs.set(d.id,d);}
 // The bounded oil-tracing article performs an underside hoist inspection, not engine repairs.
 if(g.id==='engine-oil-leak-tracing')for(const id of ['G1663631','G1693189'])docs.set(id,byId.get(id));
 const fourPistonBleed=primary.has('G1693778')&&byId.get('G1693778')?.source_hash==='87587b789bab3cc0a7acb4e1e9a27fba478a48e0cced9bad7abd7c7fcba5b0c9'&&byId.get('G2361881')?.source_hash==='6caefdfcf40a04bf00a284f1f6fcde50d9579096fca81b19d2badfe70e3a8b57'&&byId.get('G1694687')?.source_hash==='c1909f2c4ff8ca77cb33862bb9d20b51fa06642cb1c6c22c7b1c36f1148188e6';
 if(fourPistonBleed){docs.set('G2361881',byId.get('G2361881'));const spec=byId.get('G1694687');docs.set(spec.id,spec);const at=label=>{const index=spec.text.indexOf(label);if(index<0)throw Error('Missing verified bleeding specification boundary '+label);return index;};dependencySpans.set(spec.id,[{id:'bleed-fluid',start:0,end:at('Torque Specifications'),title:'Specified brake fluid'},{id:'bleed-torque-columns',start:at('Torque Specifications'),end:at('Front caliper bleeder screw-vehicles with 2'),title:'Torque column units'},{id:'four-piston-front-bleeder',start:at('Front caliper bleeder screw-vehicles with 4'),end:at('Front caliper bleeder screw-vehicles with 6'),title:'Four-piston front bleeder torque'},{id:'rear-bleeder',start:at('Rear caliper bleeder screw\n'),end:at('Master cylinder brake tube fittings'),title:'Rear bleeder torque'}]);}
 for(const d of job.contextDocs||[])docs.set(d.id,d);
 if(primary.has('G1692554'))docs.set('G1716189',byId.get('G1716189'));
 // This exact SYNC source says 'remove the FCIM' without a document hyperlink.
 if(primary.has('G1704851')&&byId.get('G1704851')?.source_hash==='fb743ec647f67cf2754413dd1e08fc2a89782cd1e6f79163ab44744af743f771'&&byId.get('G1704003')?.source_hash==='9c561bd42d94ddb2c50cacf758376fbd9766aa58088cf459e7cf1467cf59c74e')docs.set('G1704003',byId.get('G1704003'));
 // Curated switch contact tests need their exact, short access/refit procedures.
 const switchAccess={'passenger-window-switch-testing':'G1695936','headlamp-switch-contact-testing':'G1694120','power-seat-switch-contact-testing':'G1695513'}[g.id];
 if(switchAccess)docs.set(switchAccess,byId.get(switchAccess)); 
 if(['suspension','brakes','driveline'].includes(job.systemId))for(const id of ['G1686507','G1663631']){const d=byId.get(id);if(d)docs.set(id,d);}
 const referenceOnly=new Map();
 for(const r of g.sourceRefs||[]){const d=byId.get(r.documentId);if(!d)continue;referenceOnly.set(d.id,d);if(job.kind==='repair'&&d.kind!=='diagnosis'&&d.text.length<45000)docs.set(d.id,d);}
 for(const r of job.related||[]){const d=byId.get(r.documentId);if(d)referenceOnly.set(d.id,d);}
 const unresolved=[];let frontier=[...docs.values()];
 // Expand actual access references rather than adding every system diagnostic chapter.
 for(let depth=0;depth<4;depth++){
  const next=[];for(const d of frontier)for(const id of d.related||[]){const ref=byId.get(id);if(!ref||docs.has(id)||id==='G1693180')continue;
   if((job.kind==='repair'||/^(?:Wheel and Tire$|Jacking and Lifting|Battery Disconnect and Connect|Supplemental Restraint System.*(?:Depowering|Repowering)|Fuel System Pressure Release)/i.test(ref.title))&&(ref.kind==='repair'||/Jacking and Lifting/i.test(ref.title))&&scopeEngines(ref).some(e=>job.engines.includes(e))&&(primary.has(d.id)?job.spans.filter(s=>s.documentId===d.id).map(s=>d.text.slice(s.start,s.end)).join('\n'):d.text).toLowerCase().includes(('refer to: '+ref.title.split(' - ')[0]).toLowerCase())){docs.set(id,ref);next.push(ref);}
   else unresolved.push({from:d.id,documentId:id,title:ref.title,reason:'Reference is outside execution dependency scope; do not invent its instructions.'});
  }frontier=next;
 }
 for(const d of frontier)for(const id of d.related||[])if(!docs.has(id)&&byId.has(id)&&id!=='G1693180')unresolved.push({from:d.id,documentId:id,title:byId.get(id).title,reason:'Deeper dependency not supplied: identify an explicit boundary if essential.'});
 // The two-piston anchor plate reuses the pad procedure's conditional reservoir top-up.
 if(primary.has('G1693782')&&docs.has('G1693786')&&byId.get('G1693782')?.source_hash==='a2e2d71958c3640f11598ec511b30d29824af074f530461d556296db137525f8'&&byId.get('G1693786')?.source_hash==='1822f65a1f429d8809618bd1f816c2f398ccd69bd39b36a1907b6610f6236a96'&&byId.get('G1694687')?.source_hash==='c1909f2c4ff8ca77cb33862bb9d20b51fa06642cb1c6c22c7b1c36f1148188e6'){const spec=byId.get('G1694687'),end=spec.text.indexOf('Torque Specifications');if(end<0)throw Error('Missing verified brake fluid boundary');docs.set(spec.id,spec);dependencySpans.set(spec.id,[{id:'brake-fluid',start:0,end,title:'Specified brake fluid'}]);}
 // Physical repairs and switch access need relevant general startup/support precautions.
 if(job.kind==='repair'||switchAccess||docs.has('G1686507')||docs.has('G1663631'))docs.set('G1693189',byId.get('G1693189'));
 // Battery isolation requires its own applicable chemical/gas precautions.
 if(docs.has('G1692356'))docs.set('G1693181',byId.get('G1693181'));
 const nodes=[];for(const d of docs.values()){
  const spans=primary.has(d.id)?job.spans.filter(s=>s.documentId===d.id):dependencySpans.get(d.id)||[{id:'dependency',start:0,end:d.text.length,title:d.title}];
  for(const s of spans)for(const piece of splitSpan(d.text,s.start,s.end))nodes.push({nodeId:`${d.id}:${s.id}:${piece.start}-${piece.end}`,documentId:d.id,sourceHash:d.source_hash,sectionId:s.id,title:d.title,role:primary.has(d.id)?'primary':'dependency',engines:scopeEngines(d),start:piece.start,end:piece.end,text:piece.text,images:[]});
  // Original images are private review evidence, never copied into publication.
  const images=spanMedia(d,spans).filter(m=>m.width>=150&&m.height>=100).map(m=>({...m,documentId:d.id,sourceHash:d.source_hash}));
  for(let i=0;i<images.length;i+=6)nodes.push({nodeId:`${d.id}:images:${i}-${Math.min(images.length,i+6)}`,documentId:d.id,sourceHash:d.source_hash,sectionId:'illustrations',title:d.title,role:primary.has(d.id)?'primary-image':'dependency-image',engines:scopeEngines(d),text:'Interpret only visible details; associate images with the supplied complete text of this document. Do not infer hidden fasteners, measurements or applicability.',images:images.slice(i,i+6)});
 }

 if(recoveredHeadliner){const d=recoveredHeadliner;nodes.push({nodeId:d.documentId+':text',documentId:d.documentId,sourceHash:d.sourceHash,sectionId:'recovered-pdf-procedure',title:d.title,role:'dependency',engines:job.engines,start:0,end:d.text.length,text:d.text,images:[]});nodes.push({nodeId:d.documentId+':figures',documentId:d.documentId,sourceHash:d.sourceHash,sectionId:'recovered-pdf-figures',title:d.title,role:'dependency-image',engines:job.engines,text:'Review all Headliner - Lowering figures on physical pages2422–2424. Ignore the preceding headliner replacement adhesive text above the heading and the following convertible loadspace heading; neither belongs to this procedure. Original images are private review evidence only.',images:d.images});}
 const diagramFindings=[
  {"documentId":"G1694127","sourceHash":"95ddeeed5fe139646bc257977da2e01da709fcd140ca47ad5b14716b01a6c969","mediaId":"G1694127-m0002","fileHash":"16024507b1ea6c4df86eaa420f2afb624dd60bd4a1e537737e0c3b418047cd6c","observation":"Verified original nested block hierarchy and2015PDFphysical429/E186626: parent step3 states bulb-removal goal; its child first turns holder counterclockwise and extracts it. Remove bulb only after holder extraction. Install replacement bulb into removed holder before returning holder to lamp and turning it clockwise. Do not treat flattened parent-before-child text as chronological action order."},
  {documentId:'G1686507',sourceHash:'05bdc00833f259d6a8ccaacb05f1d7240193618e941b7779ee0612612b765454',mediaId:'G1686507-m0003',fileHash:'eca58ea6a46370bf8aa37a02ba727d63821e2151d74945d35f6fb071ea21f108',observation:'The highlighted central pilot bore has both a wiping/cleaning callout and a lubricant tube callout. Clean this bore before applying the specified thin lubricant film; do not restrict the cleaning instruction to the flat wheel mounting face.'},
  {documentId:'G1693784',sourceHash:'9249ad74482b718dd4a5dd6df7a2f5883b829920530621d8e4bd2f1c1b39a375',mediaId:'G1693784-m0001',fileHash:'861640281be52904844fb3a777dec82f4bd448c9a26c71ff6c7b04cb02e2526f',observation:'In the 2-piston brake-disc access branch, the illustration places a discard-bin symbol and x2 callout at the two caliper assembly mounting bolts. Discard and replace both of these bolts, despite the prose omitting that word. This applies to those assembly mounting bolts at115Nm, not unrelated caliper guide-pin fasteners.'}
 ];
 const observations=diagramFindings.filter(f=>{const d=docs.get(f.documentId),m=d?.media?.find(m=>m.id===f.mediaId);if(d?.source_hash!==f.sourceHash||!m)return false;const file=path.join(root,'data',m.url.replace(/^\//,''));return fs.existsSync(file)&&hash(fs.readFileSync(file))===f.fileHash;});
 const sources=[...new Map([...referenceOnly,...docs]).values()].map(d=>({documentId:d.id,sourceHash:d.source_hash,title:d.title,engines:scopeEngines(d),role:docs.has(d.id)?'supplied-evidence':'reference-only'}));
 const contract={jobId:g.id,title:job.title,applicability:{...g.applicability,engines:job.engines},...(recoveredHeadliner?{externalSources:[{documentId:recoveredHeadliner.documentId,title:recoveredHeadliner.title,sourceHash:recoveredHeadliner.sourceHash,physicalPages:recoveredHeadliner.physicalPages}]}:{}),scopeConstraints:[...(job.scopeConstraints||[]),...(recoveredHeadliner?['The complete recovered 2015 Headliner - Lowering procedure and its figures are supplied as private external evidence. Teach required coupe access and restoration; do not substitute full headliner removal. Cite 2015 Ford Mustang Workshop Manual, Headliner - Lowering, physical pages2422–2424 in prose. This external source has no public DBdocument: do not invent a document link or put its external ID in procedures. Keep all real primary/dependency procedures. Verified illustration E184841 is identical in recovered physical page2424 and G1692603-m0001: the D-pillar/C-pillar names refer to the same triangular upper rear panel and tether, so remove and refit each once, without asking the reader to decide whether another panel exists. The 5.2L branch is coupe-only; do not imply a 5.2L convertible.']:[]),...(fourPistonBleed?['This primary replacement is the four-piston front caliper. The bleeding specification spans include only the fluid, four-piston front bleeder and rear bleeder rows. Preserve LHD/RHD sequence and applicable rear parking-brake cycling. Do not import master-cylinder or HCU replacement operations into this caliper job; do not borrow six-piston specifications.']:[]),...(docs.has('G1693189')?['Select the general safety precautions relevant to this actual task, including startup prevention for underhood work and parking/chock/support/restoration for lifting. Put those actions before the affected work. Do not dump unrelated general warning boilerplate.']:[]),'Sources marked reference-only are known diagnostic or repair destinations, not supplied execution evidence. Use them as next-step links only; do not teach their internal procedures or claim their contents were reviewed.'],coveredSections:job.spans.map(s=>({documentId:s.documentId,sectionId:s.id})),sources,unresolvedDependencies:unresolved,reviewedEvidence:[...(job.evidenceSupplements||[]),...observations,...(fourPistonBleed?[{kind:'source-table-unit-binding',documentId:'G1694687',sourceHash:byId.get('G1694687').source_hash,sectionIds:['bleed-torque-columns','four-piston-front-bleeder','rear-bleeder'],observation:'Read under the preserved Nm / lb-ft / lb-in column headings: the four-piston front caliper bleeder row is 8 Nm (71 lb.in); the rear caliper bleeder row is 11 Nm (97 lb.in). These are exact table-cell/unit bindings, not conversions or values borrowed from the excluded six-piston row.'}]:[])],relatedGuides:job.documents.some(d=>d.id==='G1692537')?[{id:'job-dc7f65eee891660d',title:'SVT Performance Package front hub: separate bolt-on assembly for5.2L'}]:[]};
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
async function imagesFor(packet,folder){const out=[];for(const n of packet)for(const m of n.images){const original=m.privatePath?path.resolve(root,m.privatePath):path.join(root,'data',m.url.replace(/^\//,''));if(m.privatePath&&!original.startsWith(path.join(root,'work')+path.sep))throw Error('Private evidence outside work directory');if(!fs.existsSync(original))throw Error('Missing source image '+m.id);const name=path.join(folder,m.id+'-white-v2.png');if(!fs.existsSync(name))fs.writeFileSync(name,await renderEvidenceImage(original,m.mime));out.push({path:name,documentId:m.documentId,mediaId:m.id,sha256:hash(fs.readFileSync(original)),renderSha256:hash(fs.readFileSync(name)),legend:m.legend||[]});}return out;}
async function call(folder,name,prompt,schema,images=[]){
 fs.mkdirSync(folder,{recursive:true});const output=path.join(folder,name+'.json'),schemaFile=path.join(folder,name+'.schema.json'),promptFile=path.join(folder,name+'.prompt.txt');const callHash=hash(JSON.stringify({prompt,schema,images:images.map(i=>({sha256:i.sha256,renderSha256:i.renderSha256,mediaId:i.mediaId}))}));
 const checkpoint=output+'.checkpoint';if(fs.existsSync(output)&&fs.existsSync(checkpoint)&&fs.readFileSync(checkpoint,'utf8')===callHash)return read(output);
 atomic(schemaFile,schema);fs.writeFileSync(promptFile,prompt);fs.writeFileSync(path.join(folder,'AGENTS.md'),'This is a bounded offline editorial task. Use only supplied evidence and attached images. Do not run tools, browse, read other files, delegate or alter files. Return the requested JSON.');
 const log=fs.openSync(path.join(folder,name+'.log'),'w');
 try{await new Promise((resolve,reject)=>{child=spawn(codex,['exec','--skip-git-repo-check','--ephemeral','--sandbox','read-only','--color','never','--output-schema',schemaFile,'--output-last-message',output,...images.flatMap(i=>['--image',i.path]),'-'],{cwd:folder,env,stdio:['pipe',log,log]});child.stdin.on('error',()=>{});child.stdin.end(prompt);const timeout=setTimeout(()=>{child?.kill('SIGTERM');reject(Error('Codex call exceeded 25-minute limit'));},25*60*1000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timeout);child=null;code===0?resolve():reject(Error('Codex failed; inspect '+name+'.log'));});});}finally{fs.closeSync(log);}
 const result=read(output);fs.writeFileSync(checkpoint,callHash);return result;
}
const ids=opt('--ids','').split(',').filter(Boolean),limit=Number(opt('--limit','0'));let count=0;
const costs=new Map(inventory.map(g=>[g.id,g]));
const selected=base.filter(g=>!ids.length||ids.includes(g.id));
if(!ids.length)selected.sort((a,b)=>costs.get(a.id).packets-costs.get(b.id).packets||costs.get(a.id).sourceCharacters-costs.get(b.id).sourceCharacters);
for(const baseGuide of selected){
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
    errors.push(...reviewCoverageErrors(result,e.packets[i],textContext));
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

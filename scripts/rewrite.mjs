import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import sharp from 'sharp';
import {createAssetQualityStore} from '../server/asset-quality.mjs';
import {documentEvents,selectChunk,validPublishedGuide,resumeCheckpoint} from './rewrite-planning.mjs';
import {editableLeaves,validateEdits,documentEvidence,selectTeachingContext,VALIDATION_VERSION,outputSchema,instructions,EDITORIAL_VERSION} from './rewrite-lib.mjs';
const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const dataDir=path.resolve(process.env.DATA_DIR||'data'),root=path.join(dataDir,'rewrite'),guideDir=path.join(dataDir,'guides');
const assetQuality=createAssetQualityStore({dataDir});
const workers=Math.max(1,Math.min(4,Number(option('--concurrency','3')))),chunkChars=Number(option('--chunk-chars','22000')),batchSize=Number(option('--batch-size','6'));
const limit=Number(option('--limit','0')),maxAttempts=Number(option('--max-attempts','3'));
const firstDocuments=new Set(option('--first','').split(',').filter(Boolean));
const codex=option('--codex','/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex');
fs.mkdirSync(root,{recursive:true});fs.mkdirSync(guideDir,{recursive:true});
const lock=path.join(root,'worker.pid');
if(fs.existsSync(lock)){const pid=Number(fs.readFileSync(lock,'utf8'));try{process.kill(pid,0);throw Error('Rewrite worker already running');}catch(e){if(e.code!=='ESRCH')throw e;}}
fs.writeFileSync(lock,String(process.pid));
const db=new DatabaseSync(path.join(dataDir,'atlas.sqlite'),{readOnly:true});
const schemaPath=path.join(root,'schema.json');
fs.writeFileSync(schemaPath,JSON.stringify({type:'object',additionalProperties:false,required:['guides'],properties:{guides:{type:'array',items:{...outputSchema,required:['documentId',...outputSchema.required],properties:{documentId:{type:'string'},...outputSchema.properties}}}}}));
const stateFile=path.join(root,'state.json');let state={};try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}
const active=new Map(),selected=new Set(),accepted=new Set();let stopping=false,pausedUntil=0,processed=0,terminalState=null;
const startedAt=new Date().toISOString();
const childEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^(?:OPENAI|AZURE_OPENAI|ANTHROPIC|GOOGLE|GEMINI|OPENROUTER|DEEPSEEK|XAI).*API_KEY$/.test(key)));
function atomic(file,value){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file);}
function log(event){console.log(JSON.stringify({time:new Date().toISOString(),...event}));}
function parse(value,fallback=[]){try{return JSON.parse(value);}catch{return fallback;}}
const docs=db.prepare('SELECT * FROM documents').all().map(row=>({...row,blocks:parse(row.blocks),media:parse(row.media),engines:parse(row.engines)}));
const authoredDir=path.resolve('content/guides');
const glossary=JSON.parse(fs.readFileSync('content/glossary.json','utf8')).terms;
const systems=JSON.parse(fs.readFileSync('content/systems.json','utf8')).systems;
const abbreviations=JSON.parse(fs.readFileSync(path.join(dataDir,'abbreviations.json'),'utf8'));
function teachingContext(doc){return selectTeachingContext(doc,{terms:glossary,systems,abbreviations});}
function relatedReferences(doc){const seen=new Set([doc.id]),result=[];for(const id of parse(doc.related)){let row=docs.find(d=>d.id===id);if(!row){const matches=docs.filter(d=>parse(d.source,{}).reference===id),same=matches.filter(d=>d.section_code===doc.section_code);row=same.length===1?same[0]:matches.length===1?matches[0]:null;}if(row&&!seen.has(row.id)){seen.add(row.id);result.push({documentId:row.id,title:row.title,section:row.section_title,engines:row.engines});}}return result;}

for(const doc of docs){
 doc.leaves=editableLeaves(doc.blocks);doc.events=documentEvents(doc.blocks);doc.teachingContext=teachingContext(doc);doc.evidence=documentEvidence(doc,doc.teachingContext);
 for(const dir of [authoredDir,guideDir])try{const g=JSON.parse(fs.readFileSync(path.join(dir,doc.id+'.json')));if(validPublishedGuide(doc,g))accepted.add(doc.id);}catch{}
 const checkpoint=resumeCheckpoint(doc,state[doc.id]);if(checkpoint)state[doc.id]=checkpoint;else delete state[doc.id];
}
function workFor(doc){const done=state[doc.id]?.edits||{};return doc.leaves.filter(leaf=>!done[leaf.id]);}
function progress(){
 atomic(path.join(dataDir,'rewrite-progress.json'),{state:terminalState||(stopping?'stopping':pausedUntil>Date.now()?'cooldown':active.size?'running':'idle'),pid:process.pid,startedAt,updatedAt:new Date().toISOString(),documents:docs.length,complete:accepted.size,pending:docs.length-accepted.size,active:[...active.values()].map(x=>({documents:x.documentIds,pid:x.proc?.pid})),processed,pausedUntil:pausedUntil?new Date(pausedUntil).toISOString():null,method:'Codex CLI; no model API keys; generated guides are not human-reviewed.'});
}
function pickBatch(){
 for(const doc of docs)if(!accepted.has(doc.id))try{const g=JSON.parse(fs.readFileSync(path.join(authoredDir,doc.id+'.json')));if(validPublishedGuide(doc,g))accepted.add(doc.id);}catch{}
 const candidates=docs.filter(doc=>!selected.has(doc.id)&&!accepted.has(doc.id)&&(state[doc.id]?.attempts||0)<maxAttempts);
 const priority=d=>firstDocuments.has(d.id)?-1:d.kind==='wiring'||d.kind==='connector'?3:/overview|component location/i.test(d.title)?0:d.kind==='repair'?1:2;
 candidates.sort((a,b)=>priority(a)-priority(b)||workFor(a).reduce((n,x)=>n+x.text.length,0)-workFor(b).reduce((n,x)=>n+x.text.length,0));
 const batch=[];let totalChars=0,totalImages=0;
 for(const doc of candidates){
  if(batch.length>=batchSize||limit&&processed+selected.size>=limit)break;
  const chunk=selectChunk(doc,workFor(doc),{maxChars:chunkChars,maxImages:12});
  if(batch.length&&(totalChars+chunk.chars>chunkChars||totalImages+chunk.media.length>24))break;
  batch.push(chunk);selected.add(doc.id);totalChars+=chunk.chars;totalImages+=chunk.media.length;
 }
 return batch;
}
async function run(batch){
 const id='batch-'+Date.now()+'-'+batch[0].doc.id,jobDir=path.join(root,'jobs',id);fs.mkdirSync(jobDir,{recursive:true});
 const entry={documentIds:batch.map(x=>x.doc.id),proc:null};active.set(id,entry);
 fs.writeFileSync(path.join(jobDir,'AGENTS.md'),'This is a bounded writing job. Use only supplied evidence. Do not use tools, run commands, browse, read files, or delegate. Return the requested structured prose.');
 const inputs=[];const imageArgs=[];
 for(const {doc,leaves,media:chunkImages} of batch){
  const previous=state[doc.id]||(state[doc.id]={sourceHash:doc.source_hash,edits:{},attempts:0,validationVersion:VALIDATION_VERSION});
  const tableEvidence=[];let tableChars=0;
  for(const block of doc.blocks.filter(b=>b.type==='table')){const size=JSON.stringify(block).length;if(tableChars+size>6000)continue;tableEvidence.push(block);tableChars+=size;}
  const firstIndex=leaves.length?doc.leaves.findIndex(x=>x.id===leaves[0].id):0;
  inputs.push({documentId:doc.id,title:doc.title,section:doc.section_title,kind:doc.kind,engines:doc.engines,firstChunk:Object.keys(previous.edits).length===0,blocks:leaves,contextBefore:doc.leaves.slice(Math.max(0,firstIndex-2),firstIndex),tableEvidence,referenceLabels:doc.kind==='wiring'||doc.kind==='connector'?doc.text.slice(0,12000):undefined,teachingContext:doc.teachingContext,relatedReferences:relatedReferences(doc),illustrationFiles:[],...(previous.error?{previousValidationFeedback:previous.error}: {})});
  for(const media of chunkImages){
   const resolved=assetQuality.resolve(media);
   if(!/^\/media\/[a-f0-9]+\.(?:png|jpe?g|gif|webp|svg)$/.test(resolved.url||''))throw Error('Invalid illustration path for '+doc.id);
   const file=path.join(jobDir,media.id+'-source.png');
   await sharp(path.join(dataDir,resolved.url.slice(1)),{limitInputPixels:150000000}).resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).png().toFile(file);
   imageArgs.push('--image',file);inputs.at(-1).illustrationFiles.push({file:path.basename(file),mediaId:media.id,caption:media.caption,sourceOrder:doc.media.findIndex(m=>m.id===media.id)+1,width:resolved.width,height:resolved.height,quality:resolved.quality||'original'});
  }
 }
 const input={documents:inputs};fs.writeFileSync(path.join(jobDir,'input.json'),JSON.stringify(input));
 const outputFile=path.join(jobDir,'output.json'),logFile=fs.openSync(path.join(jobDir,'codex.log'),'a');
 const proc=spawn(codex,['exec','--skip-git-repo-check','--ephemeral','--sandbox','read-only','--color','never','--output-schema',schemaPath,'--output-last-message',outputFile,...imageArgs,'-'],{cwd:jobDir,env:childEnv,stdio:['pipe',logFile,logFile]});entry.proc=proc;
 log({event:'started',batch:id,documents:entry.documentIds,characters:batch.reduce((n,x)=>n+x.chars,0)});progress();
 proc.stdin.end(instructions+'\n\nBATCH CONTRACT: Produce guides with exactly one result per supplied documentId. Keep every document separate and use only its own evidence. Some documents have zero editable blocks; explain their diagram or reference in introduction, return edits:[], and never invent a procedure. Each attached image is identified by its documentId and mediaId filename; illustrationFiles records the exact source order. Use relatedReferences only for accurate internal document links, preserving the original reference title in the visible label.\n\nSOURCE INPUT:\n'+JSON.stringify(input));
 const code=await new Promise(resolve=>{proc.on('error',()=>resolve(-1));proc.on('exit',resolve);});fs.closeSync(logFile);active.delete(id);processed+=batch.length;
 let outputs,error;
 try{if(code!==0)throw Error('Codex exited '+code);const out=JSON.parse(fs.readFileSync(outputFile,'utf8'));if(!Array.isArray(out.guides)||out.guides.length!==batch.length||new Set(out.guides.map(x=>x.documentId)).size!==batch.length)throw Error('Incomplete or duplicate batch document coverage');outputs=new Map(out.guides.map(x=>[x.documentId,x]));}catch(e){error=e;}
 if(error){
  const logs=fs.readFileSync(path.join(jobDir,'codex.log'),'utf8');
  if(/usage limit|rate.?limit|quota|too many requests/i.test(logs)){pausedUntil=Date.now()+30*60*1000;log({event:'cooldown',reason:'Codex account limit'});}
  else if(/sign in|not authenticated|authentication required|login required/i.test(logs)){stopping=true;terminalState='authentication-required';}
 }
 for(const {doc,leaves} of batch){
  const previous=state[doc.id];
  try{
   if(error)throw error;
   const output=outputs.get(doc.id),checks=validateEdits(leaves,output,{evidence:doc.evidence});if(!checks.passed)throw Error(checks.errors.join('; '));
   if(Object.keys(previous.edits).length===0){if(!output.introduction?.trim())throw Error('Missing teaching introduction');previous.title=output.title;previous.introduction=output.introduction;previous.requirements=output.requirements;}
   for(const edit of output.edits)previous.edits[edit.blockId]=edit;
   previous.attempts=0;delete previous.error;
   if(doc.leaves.every(leaf=>previous.edits[leaf.id])){
    const edits=doc.leaves.map(leaf=>previous.edits[leaf.id]),full=validateEdits(doc.leaves,{edits,title:previous.title,introduction:previous.introduction,requirements:previous.requirements,uncertainties:[]},{evidence:doc.evidence});if(!full.passed)throw Error(full.errors.join('; '));
    atomic(path.join(guideDir,doc.id+'.json'),{documentId:doc.id,sourceHash:doc.source_hash,title:previous.title||doc.title,introduction:previous.introduction,requirements:previous.requirements||[],edits,checkedAt:new Date().toISOString(),model:'Codex configured model',editorialVersion:EDITORIAL_VERSION,status:'complete',checks:full});accepted.add(doc.id);log({event:'published-local',documentId:doc.id,blocks:doc.leaves.length});
   }else log({event:'chunk-accepted',documentId:doc.id,done:Object.keys(previous.edits).length,total:doc.leaves.length});
  }catch(e){if(pausedUntil<=Date.now()&&!stopping)previous.attempts++;previous.error=String(e.message).slice(0,4000);log({event:'needs-review',documentId:doc.id,error:previous.error});}
  selected.delete(doc.id);
 }
 atomic(stateFile,state);progress();
}
process.on('SIGTERM',()=>{stopping=true;for(const entry of active.values())entry.proc?.kill('SIGTERM');});
process.on('SIGINT',()=>{stopping=true;for(const entry of active.values())entry.proc?.kill('SIGTERM');});
try{
 const pending=new Set();
 while(!stopping){
  if(fs.existsSync(path.join(root,'stop-after-current')))stopping=true;
  if(limit&&processed>=limit)stopping=true;
  if(stopping)break;
  if(pausedUntil>Date.now()){progress();await delay(10000);continue;}
  while(active.size<workers&&(!limit||processed+selected.size<limit)){
   const batch=pickBatch();if(!batch.length)break;const promise=run(batch).catch(error=>{stopping=true;terminalState='error';log({event:'worker-error',error:error.message});}).finally(()=>pending.delete(promise));pending.add(promise);
  }
  if(!pending.size)break;
  await Promise.race([...pending,delay(1000)]);
 }
 await Promise.allSettled(pending);terminalState ||=stopping?'stopped':accepted.size===docs.length?'complete':'needs-review';progress();
}finally{db.close();try{fs.unlinkSync(lock);}catch{}}

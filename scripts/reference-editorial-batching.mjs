import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
export function batchSchema(schema,ids){return {type:'object',additionalProperties:false,required:['results'],properties:{results:{type:'array',minItems:ids.length,maxItems:ids.length,items:{type:'object',additionalProperties:false,required:['documentId','output'],properties:{documentId:{type:'string',enum:ids},output:schema}}}}};}
export function splitBatchResults(result,ids){const entries=result?.results;if(!Array.isArray(entries)||entries.length!==ids.length||new Set(entries.map(e=>e.documentId)).size!==ids.length||ids.some(id=>!entries.some(e=>e.documentId===id)))throw Error('Shared-call document coverage mismatch');return new Map(entries.map(e=>[e.documentId,e.output]));}
export function compactSupportingInputs(inputs){
 const shared=new Map();
 const documents=inputs.map(input=>({...input,completeSupportingReferences:(input.completeSupportingReferences||[]).map(source=>{const sharedReferenceKey=source.documentId+':'+digest(JSON.stringify(source));if(!shared.has(sharedReferenceKey))shared.set(sharedReferenceKey,{sharedReferenceKey,...source});return {documentId:source.documentId,sharedReferenceKey};})}));
 return {documents,sharedSupportingReferences:[...shared.values()]};
}
// Shared data is supplied once, but each article retains an explicit source
// allowlist, full unit coverage, and a self-contained original audit packet.
export function createBatchedCaller({rawCall,root,authorSchema,reviewSchema,atomic,log,maxBatchSize=4,maxChars=100000,maxImages=12}){
 const waiting=[],imageHashes=new Map();let busy=false,timer=null,serial=0;
 const imageKey=file=>{if(!imageHashes.has(file))imageHashes.set(file,digest(fs.readFileSync(file)));return imageHashes.get(file);};
 function prepare(records){const input=compactSupportingInputs(records.map(r=>r.input)),images=[],indices=new Map(),imageOrder=[];for(const r of records)for(let i=0;i<r.images.length;i++){const file=r.images[i],key=imageKey(file);if(!indices.has(key)){indices.set(key,images.length+1);images.push(file);}imageOrder.push({index:indices.get(key),documentId:r.input.documentId,localIndex:i+1,file});}input.imageOrder=imageOrder;return {input,images,characters:JSON.stringify(input).length};}
 function schedule(){if(busy||timer||!waiting.length)return;timer=setTimeout(()=>{timer=null;void flush();},250);}
 async function flush(){
  if(busy||!waiting.length)return;busy=true;const kind=waiting[0].kind,batch=[];let prepared;
  try{
   for(let i=0;i<waiting.length&&batch.length<maxBatchSize;){const r=waiting[i];if(r.kind!==kind){i++;continue;}const candidate=prepare([...batch,r]);if(batch.length&&(candidate.characters>maxChars||candidate.images.length>maxImages)){i++;continue;}batch.push(...waiting.splice(i,1));prepared=candidate;}
   const ids=batch.map(r=>r.input.documentId),job=path.join(root,'shared-jobs',Date.now()+'-'+(++serial)+'-'+kind);
   for(const r of batch){atomic(path.join(r.job,'input.json'),r.input);atomic(path.join(r.job,'shared-call.json'),{job,documentId:r.input.documentId,kind});}
   log('shared-call-start',{kind,documents:ids,characters:prepared.characters,images:prepared.images.length,imageAssociations:prepared.input.imageOrder.length,sharedSources:prepared.input.sharedSupportingReferences.length});
   const contract='BATCH CONTRACT: Return exactly one output per documentId. Each document is an independent assignment. Its completeSupportingReferences is an explicit allowlist of sharedReferenceKey values. The full, untruncated source units for those keys appear in top-level sharedSupportingReferences. Use ONLY the shared sources allowed by that document; never borrow other documents’ primary or supporting evidence. Every document must cover all its own unitIds, including permitted supporting units. imageOrder maps each document localIndex to the global attached-image index; identical image bytes may have several explicit associations. Respect each article’s engine/equipment qualifiers even when a general reference is shared.';
   const result=await rawCall(kind,prepared.input,prepared.images,job,batchSchema(kind==='author'?authorSchema:reviewSchema,ids),contract),outputs=splitBatchResults(result,ids);
   for(const r of batch){atomic(path.join(r.job,'output.json'),outputs.get(r.input.documentId));r.resolve(outputs.get(r.input.documentId));}
   log('shared-call-finished',{kind,documents:ids});
  }catch(error){for(const r of batch)r.reject(error);if(!batch.length&&waiting.length)waiting.shift().reject(error);}
  finally{busy=false;schedule();}
 }
 return (kind,input,images,job)=>new Promise((resolve,reject)=>{waiting.push({kind,input,images,job,resolve,reject});schedule();});
}

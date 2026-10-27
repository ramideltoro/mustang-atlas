import fs from 'node:fs';
import path from 'node:path';
import {validateGuide,selectTeachingContext} from './guide-validation.mjs';
export {editableLeaves} from './guide-validation.mjs';
export function acceptedOverlay(document,overlay,options={}){return validateGuide(document,overlay,options).passed;}
export function applyOverlay(document,overlay){const result=structuredClone(document);const edits=new Map(overlay.edits.map(e=>[e.blockId,e]));const visit=items=>{for(const b of items||[]){const edit=edits.get(b.id);if(edit){b.text=edit.text;if(typeof edit.why==='string'&&edit.why.trim())b.why=edit.why;}visit(b.children);visit(b.items);for(const row of b.rows||[])for(const c of row.cells||[])visit(c.blocks);}};visit(result.blocks);
 result.teachingStatus='complete';result.editorial={status:'complete',humanReviewed:overlay.checks?.humanReviewed===true,checkedAt:overlay.checkedAt||null,sourceHash:overlay.sourceHash};
 const review=overlay.referenceReview;
 if(overlay.referenceEditorialVersion==='enthusiast-v2'&&review?.kind==='independent-codex-technical-review'&&review.humanReviewed===false&&Number.isInteger(review.sourceChunkCount)&&review.sourceChunkCount>0&&review.reviewedChunkCount===review.sourceChunkCount&&Number.isInteger(review.sourceUnitCount)&&review.sourceUnitCount>0&&/^[a-f0-9]{64}$/.test(review.fingerprint||''))result.editorial.teachingVersion='enthusiast-v2';
 if(typeof overlay.title==='string'&&overlay.title.trim())result.title=overlay.title;
 if(typeof overlay.introduction==='string')result.introduction=overlay.introduction;
 if(Array.isArray(overlay.requirements))result.requirements=overlay.requirements;
 return result;
}
export function createEditorialStore({dataDir,contentDir}){
 const fileCache=new Map(),validationCache=new Map();
 function read(file){try{const stat=fs.statSync(file);const cached=fileCache.get(file);if(cached?.mtime===stat.mtimeMs&&cached.size===stat.size&&cached.ctime===stat.ctimeMs)return cached.value;const value=JSON.parse(fs.readFileSync(file,'utf8'));fileCache.set(file,{mtime:stat.mtimeMs,size:stat.size,ctime:stat.ctimeMs,value});return value;}catch{return null;}}
 return { get(document){for(const folder of [path.join(contentDir,'guides'),path.join(dataDir,'guides')]){const filename=path.join(folder,document.id+'.json');const overlay=read(filename);if(!overlay)continue;const glossary=read(path.join(contentDir,'glossary.json'))||{};const systems=read(path.join(contentDir,'systems.json'))||{};const abbreviations=read(path.join(dataDir,'abbreviations.json'))||[];const prior=validationCache.get(filename);if(prior&&prior.hash===document.sourceHash&&prior.overlay===overlay&&prior.glossary===glossary&&prior.systems===systems&&prior.abbreviations===abbreviations){if(prior.valid)return overlay;continue;}const curatedContext=selectTeachingContext(document,{terms:glossary.terms||[],systems:systems.systems||[],abbreviations});const valid=acceptedOverlay(document,overlay,{curatedContext});validationCache.set(filename,{hash:document.sourceHash,overlay,glossary,systems,abbreviations,valid});if(valid)return overlay;}return null;},ids(){const ids=new Set();for(const folder of [path.join(dataDir,'guides'),path.join(contentDir,'guides')]){try{for(const file of fs.readdirSync(folder))if(/^[A-Za-z0-9_-]+\.json$/.test(file))ids.add(file.slice(0,-5));}catch{}}return [...ids];}};
}

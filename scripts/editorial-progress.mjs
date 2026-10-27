/** Honest, read-only editorial coverage report. Staged is never called published. */
import fs from 'node:fs';
import path from 'node:path';
const read=(file,fallback={})=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const records=folder=>{try{return fs.readdirSync(folder).filter(f=>f.endsWith('.json')).map(f=>read(path.join(folder,f)));}catch{return [];}};
const care=read('content/maintenance-guides.json').guides||[],workshop=read('content/workshop-guides.json').guides||[];
const careAccepted=records('work/editorial-care/accepted').filter(a=>a.review?.verdict==='pass');
const workshopAccepted=records('work/editorial-workshop/reviewed').filter(a=>a.guide?.authoring?.independentSourceReview===true);
const referenceState=read('work/editorial-references/state.json');
const referenceAccepted=records('work/editorial-references/accepted').filter(a=>referenceState[a.documentId]?.status==='accepted'&&referenceState[a.documentId]?.fingerprint===a.referenceReview?.fingerprint);
const prior=new Set(['wheel-hubs','3-7l-v6-head-gasket','3-7l-v6-timing-chain']);
const report={generatedAt:new Date().toISOString(),method:'Codex authoring and independent automated technical review; not human certification',care:{total:care.length,priorDetailedGuides:care.filter(g=>prior.has(g.id)).length,staged:careAccepted.length,mergedInLocalCatalog:care.filter(g=>g.authoring?.version===2&&g.authoring?.independentTechnicalReview===true).length,progress:read('work/editorial-care/progress.json')},workshop:{total:workshop.length,staged:workshopAccepted.length,mergedInLocalCatalog:workshop.filter(g=>g.authoring?.independentSourceReview===true).length,progress:read('work/editorial-workshop/progress.json')},references:{total:Object.keys(referenceState).length,staged:referenceAccepted.length,mergedInLocalCatalog:records('content/guides').filter(g=>g.referenceEditorialVersion==='enthusiast-v2').length,progress:read('work/editorial-references/progress.json')},systems:{total:read('content/systems.json').systems?.length||0,note:'System introductions are separate from complete article rewrites.'}};
for(const collection of [report.care,report.workshop,report.references]){const pid=collection.progress?.pid;let running=false;if(Number.isInteger(pid)){try{process.kill(pid,0);running=true;}catch{}}collection.workerProcessPresent=running;}
console.log(JSON.stringify(report,null,2));

#!/usr/bin/env node
/** Compare a completed private benchmark. A recommendation never authorizes publication. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarizeRun} from './local-editorial-review.mjs';
export function compare(summary,queue,state){
 const known=queue.jobs.find(j=>j.category==='known-held')?.id;
 const rows=queue.models.map(model=>{
  const slots=summary.slots.filter(s=>s.model===model),approved=slots.filter(s=>s.qualityGate).length;
  const knownHold=slots.find(s=>s.jobId===known)?.disposition==='held-evidence';
  const drafts=Object.values(state.jobs||{}).filter(s=>s.model===model);
  const draftMs=slots.reduce((n,s)=>{const j=drafts.find(j=>j.jobId===s.jobId);return n+(s.elapsedMs?.draft??(j?.startedAt&&j?.finishedAt?Date.parse(j.finishedAt)-Date.parse(j.startedAt):0));},0);
  const reviewMs=slots.reduce((n,s)=>n+(s.elapsedMs?.review||0),0),elapsedMs=draftMs+reviewMs;
  const qualified=summary.benchmarkComplete===true&&approved>=8&&knownHold&&slots.every(s=>!s.qualityGate||!s.unresolvedTechnicalErrors?.length);
  return {model,approved,knownEvidenceGapCorrectlyHeld:knownHold,qualified,elapsedMs,acceptedArticlesPerHour:elapsedMs>0?approved*3600000/elapsedMs:null,measurement:'Observed initial draft wall time (including capacity waits and failures) plus review time; no general speed guarantee'};
 });
 const candidates=rows.filter(r=>r.qualified).sort((a,b)=>(b.acceptedArticlesPerHour||0)-(a.acceptedArticlesPerHour||0));
 return {generatedAt:new Date().toISOString(),benchmarkComplete:summary.benchmarkComplete,models:rows,recommendedModel:candidates[0]?.model||null,rolloutAuthorized:false,publicationAuthorized:false,codexSavings:{targetPercent:50,measuredPercent:null,status:'Requires a complete comparable historical baseline; aggregate old log totals are not per-article billing'},nextAction:!summary.benchmarkComplete?'Continue the fixed pilot and bounded reviews':candidates.length?'Inspect completed technical/voice reviews and compare valid token baselines before rollout':'Stop expansion: neither model met the fixed pilot quality threshold'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const run=path.resolve(process.argv[2]||'work/local-editorial/pilot-20261102'),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
 const report=compare(summarizeRun(run),read(path.join(run,'queue.json')),read(path.join(run,'state.json')));
 fs.writeFileSync(path.join(run,'benchmark-report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2));
}

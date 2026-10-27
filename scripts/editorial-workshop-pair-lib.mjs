import {hash} from './workshop-author-lib.mjs';
import {packNodes,validateCandidate,reviewCoverageErrors} from './editorial-workshop-lib.mjs';
export function buildPair(jobs){
 if(jobs.length!==2||new Set(jobs.map(j=>j.baseGuide.id)).size!==2)throw Error('Exactly two distinct guides required');
 const scope=JSON.stringify(jobs[0].contract.applicability.engines);
 const primary=jobs.map(j=>new Set(j.baseGuide.primaryDocumentIds||[]));
 if([...primary[0]].some(id=>primary[1].has(id)))throw Error('Shared primary procedure needs isolated review');
 const stop=new Set('remove replace refit install check inspect adjust complete setup front rear left right side driver passenger coupe convertible mustang engine with without and the a an on in for to of or its how from'.split(' '));
 const nouns=jobs.map(j=>new Set((j.baseGuide.title||'').toLowerCase().match(/[a-z]{4,}/g)?.filter(w=>!stop.has(w))||[]));
 if([...nouns[0]].filter(w=>nouns[1].has(w)).length>=2)throw Error('Potential same-component variants need isolated review');
 const nodes=new Map();
 for(const j of jobs){
  if(j.baseGuide.taskType!=='repair'||j.packets!==1||j.contract.unresolvedDependencies.length||j.contract.externalSources?.length)throw Error('Pair requires complete bounded repair evidence');
  if(JSON.stringify(j.contract.applicability.engines)!==scope)throw Error('Different applicability families');
  for(const n of j.nodes){if(nodes.has(n.nodeId)&&JSON.stringify(nodes.get(n.nodeId))!==JSON.stringify(n))throw Error('Conflicting source node '+n.nodeId);nodes.set(n.nodeId,n);}
 }
 const evidence=[...nodes.values()];
 if(packNodes(evidence).length!==1||JSON.stringify(evidence).length>45000||evidence.reduce((a,n)=>a+n.images.length,0)>24)throw Error('Combined pair exceeds existing packet bounds');
 return{version:1,jobs:jobs.map(j=>({...j,allowedNodeIds:j.nodes.map(n=>n.nodeId)})),evidence,fingerprint:hash(JSON.stringify(jobs.map(j=>({id:j.baseGuide.id,fingerprint:j.fingerprint,baseHash:j.baseHash}))))};
}
export function keyedResults(rows,ids,key='jobId'){
 if(!Array.isArray(rows)||rows.length!==ids.length)throw Error('Missing or extra batch result');
 const map=new Map();for(const r of rows){if(!ids.includes(r[key])||map.has(r[key]))throw Error('Unknown or duplicate batch ID');map.set(r[key],r);}return map;
}
export function assessPairGuide(candidate,review,job){
 const errors=validateCandidate(candidate,job.contract,job.nodes);
 if(!review||review.jobId!==job.baseGuide.id)errors.push('Missing independent guide review');
 else errors.push(...reviewCoverageErrors(review,job.nodes,[]));
 return{errors,accepted:!errors.length&&candidate?.jobId===job.baseGuide.id&&candidate?.status==='complete'&&review?.verdict==='approve'&&review.coverage.every(c=>['covered','not-applicable'].includes(c.status))};
}

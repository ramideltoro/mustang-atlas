import fs from 'node:fs';

// This local review record contains unresolved source details and is deliberately
// excluded from the public catalog/repository. Stale records fail closed.
export function readWorkshopExceptions(file='data/workshop-source-exceptions.json') {
  if(!fs.existsSync(file))return [];
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.version!==1||!Array.isArray(data.records))throw Error('Invalid private workshop source exceptions');
  return data.records;
}
export function applyWorkshopExceptions(jobs,records,byId){
  const excluded=[];
  for(const record of records){
    const doc=byId.get(record.documentId),job=jobs.find(j=>j.id===record.jobId);
    if(!doc||doc.source_hash!==record.sourceHash||!job)throw Error('Stale workshop source exception '+record.documentId);
    if(record.kind==='engine-scope'){
      if(!record.supportedEngines?.length||!record.unsupportedApplications?.length||!record.publicationConstraint)throw Error('Incomplete engine scope exception '+doc.id);
      job.scopeConstraints=[...(job.scopeConstraints||[]),{documentId:doc.id,task:job.title,completionBoundary:record.publicationConstraint}];
      continue;
    }
    const supported=record.supported||[],unsupported=record.unsupported||[],all=[...supported,...unsupported].sort((a,b)=>a.start-b.start);
    if(!supported.length||!unsupported.length||!record.publicationConstraint||!record.proposedTitle||all.some(s=>!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end<=s.start||s.end>doc.text.length||!s.scope)||unsupported.some(s=>!s.reason))throw Error('Incomplete workshop source exception '+doc.id);
    for(let i=1;i<all.length;i++)if(all[i].start!==all[i-1].end)throw Error('Overlapping or missing exception ranges '+doc.id);
    const span=job.spans.find(s=>s.documentId===doc.id&&s.start===all[0].start&&s.end===all.at(-1).end);
    if(!span)throw Error('Source exception no longer matches complete planned span '+doc.id);
    const spans=supported.map((s,i)=>({documentId:doc.id,id:span.id+'-supported-'+(i+1),title:s.scope,start:s.start,end:s.end}));
    job.spans=job.spans.flatMap(s=>s===span?spans:[s]);
    job.title=record.proposedTitle;
    job.scopeConstraints=[...(job.scopeConstraints||[]),{documentId:doc.id,task:record.proposedTitle,completionBoundary:record.publicationConstraint}];
    for(const [i,s]of unsupported.entries())excluded.push({documentId:doc.id,sourceHash:doc.source_hash,id:span.id+'-unsupported-'+(i+1),title:s.scope,start:s.start,end:s.end,status:'unsupported',reason:s.reason});
  }
  return excluded;
}

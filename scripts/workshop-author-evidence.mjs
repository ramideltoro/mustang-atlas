import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
export function readWorkshopEvidence(file='content/workshop-evidence.json') {
  if (!fs.existsSync(file)) return [];
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.version!==1||!Array.isArray(data.documents))throw Error('Invalid workshop evidence catalog');
  return data.documents;
}

// Supplemental evidence is an explicit, reviewed bridge to another original
// article or an inspected image. Stale hashes invalidate the whole record.
export function verifiedWorkshopEvidence(records,byId,{dataDir='data'}={}) {
  const accepted=new Map();
  for(const record of records){
    const doc=byId.get(record.documentId);
    if(!doc||doc.source_hash!==record.sourceHash)continue;
    if((record.additionalSources||[]).some(ref=>byId.get(ref.documentId)?.source_hash!==ref.sourceHash))continue;
    let valid=true;
    for(const item of record.imageEvidence||[]){
      const owner=item.documentId&&item.documentId!==doc.id?byId.get(item.documentId):doc;
      if(!owner||(owner!==doc&&!(record.additionalSources||[]).some(ref=>ref.documentId===owner.id&&ref.sourceHash===owner.source_hash))){valid=false;break;}
      const media=owner.media.find(m=>m.id===item.mediaId);
      if(!media||!/^\/media\/[a-f0-9]+\.(?:png|jpe?g|gif|webp|svg)$/.test(media.url)||!item.transcription){valid=false;break;}
      const file=path.join(dataDir,media.url.slice(1));
      if(!fs.existsSync(file)||digest(fs.readFileSync(file))!==item.fileHash){valid=false;break;}
    }
    if((record.preferredMediaIds||[]).some(id=>!doc.media.some(m=>m.id===id)))valid=false;
    if(valid)accepted.set(record.documentId,record);
  }
  return accepted;
}

export function validCuratedJob(guide,job){
  const coverage=guide.authoring?.reviewedCoverage;
  if(!coverage||coverage.fingerprint!==job.fingerprint)return false;
  const expected=job.spans.map(s=>({documentId:s.documentId,sourceHash:job.documents.find(d=>d.id===s.documentId).source_hash,id:s.id,start:s.start,end:s.end}));
  return JSON.stringify(coverage.sections)===JSON.stringify(expected)
    &&job.documents.every(d=>guide.sourceRefs?.some(r=>r.documentId===d.id&&r.sourceHash===d.source_hash))
    &&JSON.stringify([...(guide.applicability?.engines||[])].sort())===JSON.stringify([...job.engines].sort());
}

// A shared diagnostic chapter can illustrate several different jobs. Preserve
// the reviewed per-guide choice after applying the chapter's general image.
export function applyGuideMediaSelections(guide,byId){
  for(const selected of guide.authoring?.mediaSelections||[]){
    const doc=byId.get(selected.documentId);
    if(!doc||doc.source_hash!==selected.sourceHash||!guide.sourceRefs?.some(r=>r.documentId===doc.id&&r.sourceHash===selected.sourceHash)||!doc.media.some(m=>m.id===selected.mediaId)||!guide.procedures?.some(p=>p.documentId===doc.id))throw Error('Invalid reviewed guide image '+guide.id);
    for(const ref of guide.procedures)if(ref.documentId===doc.id)ref.mediaId=selected.mediaId;
    if(guide.hero?.documentId===doc.id)guide.hero={...guide.hero,mediaId:selected.mediaId};
  }
  return guide;
}

import {reusableCoverage} from './workshop-author-reuse.mjs';
import crypto from 'node:crypto';
import {readWorkshopEvidence,verifiedWorkshopEvidence} from './workshop-author-evidence.mjs';
import {documentApplicability,isPublicDocument,ENGINE_OPTIONS} from '../server/catalog.mjs';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
export const VERSION=1;
export const parse=(v,f=[])=>{try{return typeof v==='string'?JSON.parse(v):v??f}catch{return f}};
export const phase=d=>d.source_path?.split('/').at(-2)||d.kind;
export const scopeEngines=d=>{if(d.authoringEngines)return d.authoringEngines;if(['307-02','307-05'].includes(d.section_code)||['G1687288','G1701833','G1687295','G1687296'].includes(d.id))return ['2.3L','3.7L','5.0L'];if(/Vehicles With:\s*SVT Performance Package/i.test(`${d.title} ${d.section_title}`))return ['5.2L'];const e=documentApplicability(d,'all').engines;return e.length?e:[...ENGINE_OPTIONS]};
export function normalizeJobTitle(title){return title.trim().replace(/\s+-\s+(?:2\.3L|3\.7L|5\.0L|5\.2L).*$/i,'').replace(/\s+/g,' ');}
export function jobKey(d){
 const name=normalizeJobTitle(d.title).toLowerCase(),gearbox=d.section_title.match(/\b(?:MT82|3160|6R80)\b/i)?.[0]||'';
 const major=/^(?:engine|cylinder head(?: lh| rh)?|transmission)$/.test(name);
 return[d.system_id,d.section_code.replace(/[A-Z]$/,''),gearbox,phase(d)==='Overhaul'?'repair':d.kind,name,...(major?[d.section_code]:[])].join('|');
}
export function isPointer(d){return d.kind==='diagnosis'&&d.text.length<900&&!/Clean and inspect|\bTorque:|\bPINPOINT TEST\b/i.test(d.text);}
export const guideId=key=>'job-'+hash(key).slice(0,16);
// A span is complete evidence with exact offsets in the stored text, never a
// silently truncated excerpt. Large chapters split only at named test headings.
export function diagnosticSpans(d,{maxChars=35000}={}){
 if(d.kind!=='diagnosis'||d.text.length<=50000)return[{id:'complete',title:d.title,start:0,end:d.text.length}];
 const matches=[...d.text.matchAll(/^PINPOINT TEST [A-Z0-9]+:[^\n]*(?:\n(?!\n|Normal Operation|Introduction|Diagnostic|Possible|Refer|REFER|\b[A-Z]+\d+\s)[^\n]{0,200})?/gmi)].filter((m,i,a)=>!i||m.index>a[i-1].index+100);
 if(!matches.length)return[{id:'complete',title:d.title,start:0,end:d.text.length}];
 const units=[{id:'initial-inspection',title:'Initial inspection, symptom and diagnostic-code charts',start:0,end:matches[0].index},...matches.map((m,i)=>({id:'test-'+m[0].match(/^PINPOINT TEST ([A-Z0-9]+)/i)[1].toLowerCase(),title:m[0].replace(/\s+/g,' ').trim(),start:m.index,end:matches[i+1]?.index??d.text.length}))].filter(s=>s.end>s.start);
 const packets=[];let packet=[];
 for(const s of units){const size=packet.length?s.end-packet[0].start:0;if(packet.length&&(size>maxChars||packet.length>=4)){packets.push(packet);packet=[];}packet.push(s);}if(packet.length)packets.push(packet);
 return packets.map(p=>({id:p.map(s=>s.id).join('_'),title:p.map(s=>s.title).join(' · '),start:p[0].start,end:p.at(-1).end,subsections:p}));
}
export function buildWorkshopPlan(allDocs,{existingGuides=[],evidenceSupplements=readWorkshopEvidence()}={}){
 const publicDocs=allDocs.filter(isPublicDocument).map(d=>({...d,engines:parse(d.engines),related:parse(d.related),blocks:parse(d.blocks),media:parse(d.media),source:parse(d.source,{})}));
 const byId=new Map(publicDocs.map(d=>[d.id,d]));
 const supplements=verifiedWorkshopEvidence(evidenceSupplements,byId);
 function resolve(ref,from){if(byId.has(ref))return byId.get(ref);const all=publicDocs.filter(d=>d.source.reference===ref),same=all.filter(d=>d.section_code===from.section_code);return same.length===1?same[0]:all.length===1?all[0]:null;}
 const appendices=publicDocs.filter(d=>/^wiring-(?:005-00[1-9]|149-0(?:0[1-9]|1[0-2]))$/.test(d.id));
 const docs=publicDocs.filter(d=>['repair','diagnosis'].includes(d.kind)||phase(d)==='Overhaul'||appendices.includes(d));
 const reserved=new Set(['G1804267','G2394879',...appendices.map(d=>d.id)]);
 const pointers=docs.filter(isPointer).map(d=>({document:d,destinations:d.related.map(id=>resolve(id,d)).filter(d=>d&&['repair','diagnosis'].includes(d.kind)&&!isPointer(d)).map(d=>d.id),reason:/Interactive Diagnostics|VIN required/.test(d.text)?'The source requires an external VIN-specific interactive diagnostic routine.':/PC\/ED/.test(d.text)?'The page directs diagnosis to linked local engine diagnostics and/or external PC/ED tests; no local test sequence is provided on this page.':'This page is a referral to a substantive local diagnostic article.'}));
 const reused=docs.map(d=>reusableCoverage(d,existingGuides,scopeEngines(d))).filter(Boolean),reuseByDoc=new Map(reused.map(r=>[r.documentId,r]));
 const grouped=new Map();for(const original of docs.filter(d=>!reserved.has(d.id)&&!isPointer(d))){const reuse=reuseByDoc.get(original.id),remaining=scopeEngines(original).filter(e=>!reuse?.engines.includes(e));if(!remaining.length)continue;const d=reuse?{...original,authoringEngines:remaining}:original;const key=jobKey(d);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(d);}
 const jobs=[];
 function add(key,ds,spans){const engines=[...new Set(ds.flatMap(scopeEngines))].sort((a,b)=>ENGINE_OPTIONS.indexOf(a)-ENGINE_OPTIONS.indexOf(b));const phases=[...new Set(ds.map(phase))];jobs.push({id:guideId(key),key,systemId:ds[0].system_id,kind:ds[0].kind==='diagnosis'?'diagnosis':'repair',title:normalizeJobTitle(ds[0].title),engines,documents:ds,spans,phases,taskType:ds[0].kind==='diagnosis'?'diagnostics':phases.some(p=>/Disassembly|Assembly|Overhaul/.test(p)&&!/Removal/.test(p))?'overhaul':'repair'});}
 for(const[key,ds]of grouped){
  const size=ds.reduce((n,d)=>n+d.text.length,0);
  if(ds[0].kind==='diagnosis'&&size>60000){for(const d of ds)for(const span of diagnosticSpans(d))add(key+'|'+d.id+'|'+span.id,[d],[{documentId:d.id,...span}]);}
  else add(key,ds,ds.map(d=>({documentId:d.id,id:'complete',title:d.title,start:0,end:d.text.length})));
 }
 for(const j of jobs){
  j.evidenceSupplements=j.documents.map(d=>supplements.get(d.id)).filter(Boolean);
  const reviewedAdditionalIds=[...new Set(j.evidenceSupplements.flatMap(s=>(s.additionalSources||[]).map(r=>r.documentId)))];
  const related=[...new Set([...j.documents.flatMap(d=>d.related.map(id=>resolve(id,d)?.id)).filter(Boolean),...reviewedAdditionalIds])].map(id=>byId.get(id)).filter(d=>scopeEngines(d).some(e=>j.engines.includes(e)));
  // Local operation evidence for the actual section helps explain components,
  // but is not itself marked as repair/diagnosis task coverage.
  const delegated= j.documents.some(d=>d.text.length<600&&/Refer to:/i.test(d.text))?related.filter(d=>d.kind==='repair'&&d.text.length<30000).slice(0,2):[];
  const overviews=publicDocs.filter(d=>d.kind==='overview'&&scopeEngines(d).some(e=>j.engines.includes(e))&&j.documents.some(p=>p.section_code===d.section_code)&&/overview|system operation|component description/i.test(d.title)).sort((a,b)=>a.text.length-b.text.length).slice(0,2);
  const required=reviewedAdditionalIds.map(id=>byId.get(id));
  j.contextDocs=[...required,...[...new Map([...delegated,...overviews,...related.filter(d=>d.kind==='overview')].map(d=>[d.id,d])).values()].filter(d=>!reviewedAdditionalIds.includes(d.id)&&(d.text.length<15000||delegated.includes(d))).slice(0,Math.max(0,3-required.length))];
  j.related=related.map(d=>({documentId:d.id,title:d.title,phase:phase(d),engines:scopeEngines(d),section:d.section_title}));
  j.fingerprint=hash(JSON.stringify({version:VERSION,key:j.key,engines:j.engines,sources:[...j.documents,...j.contextDocs].map(d=>[d.id,d.source_hash]),spans:j.spans,...(j.evidenceSupplements.length?{evidenceSupplements:j.evidenceSupplements}:{})}));
 }
 return{jobs,documents:docs,pointers,reused,reserved:[...reserved],publicDocs,byId};
}

import {detectEngines} from './taxonomy.mjs';
export const ENGINE_OPTIONS=['2.3L','3.7L','5.0L','5.2L'];
export function isPublicDocument(row){return !/^\s*(?:overview\s*[-–—:]?\s*)?about\s+(?:this|the)\s+(?:(?:service|workshop)\s+)?manual\s*$/i.test(row?.title||'');}
export function engineFilter(value){if(value===undefined||value===''||String(value).toLowerCase()==='all')return 'all';const engine=String(value).toUpperCase();if(!ENGINE_OPTIONS.includes(engine))throw Object.assign(new Error('Unsupported engine filter.'),{status:400});return engine;}
const array=value=>{if(Array.isArray(value))return value;try{return JSON.parse(value||'[]');}catch{return [];}};
// The 2.3L label is a full-sheet header outside the component/branch boxes on
// wiring 033-002. Bind the visual finding to the exact reviewed drawing.
const reviewedApplications={'wiring-033-002':{hash:'7de1c56382d2c220ab5cd07a83d5857bd07178510db14f767b5df160dbdc0864',engines:['2.3L']}};
export function documentApplicability(row,selected='all'){
 // Titles and section metadata are application evidence. Body text and related
 // article titles contain cross-variant references, so never use them as tags.
 const title=row.title||'',section=row.section_title??row.section?.title??'';
 const headingEngines=detectEngines(`${title} ${section}`);
 // Application is documented by the engine-specific transmission procedures:
 // 6R80 G1692044/46/48; MT82 G1687341/G1695873/G1695875; 3160 G1809309.
 // Do not extend the MT82 section label to 308-01/02: those shared clutch
 // chapters also contain explicitly titled 5.2L procedures.
 const code=row.section_code??row.section?.code;
 let sectionEngines=[];
 if((code==='307-01'||code==='30')&&/\b6R80\b/i.test(section))sectionEngines=['2.3L','3.7L','5.0L'];
 if(['308-03A','308-06A'].includes(code)&&/\bMT82\b/i.test(section))sectionEngines=['2.3L','3.7L','5.0L'];
 if(['308-03B','308-06B'].includes(code)&&/\b(?:TR[- ]?)?3160\b/i.test(section))sectionEngines=['5.2L'];
 const reviewed=reviewedApplications[row.id];const reviewedEngines=reviewed&&reviewed.hash===(row.source_hash??row.sourceHash)?reviewed.engines:[];
 const engines=ENGINE_OPTIONS.filter(e=>(headingEngines.length?headingEngines:reviewedEngines.length?reviewedEngines:sectionEngines.length?sectionEngines:array(row.engines)).includes(e));
 return {engines,scope:engines.length?'specific':'shared-or-unspecified',selectedEngine:selected,matchesSelectedEngine:selected==='all'||!engines.length||engines.includes(selected)};
}
export function operationFor(row){const folder=String(row.source_path||'').split('/').at(-2)||'';return /^(?:Description and Operation|Diagnosis and Testing|Removal(?: and Installation)?|Installation|Disassembly(?: and Assembly(?: of Subassemblies)?)?|Assembly|Overhaul|General Procedures|Specifications)$/i.test(folder)?folder:null;}
export function sectionFor(row){return {id:row.section_code||row.section_title,code:row.section_code||'',title:row.section_title||'General information'};}
export function selectThumbnail(document,resolve=m=>m){
 const assets=array(document.media),candidates=[];const positions=new Map();let n=0;
 function walk(blocks,table=false){for(const b of blocks||[]){if(b.mediaId&&!positions.has(b.mediaId))positions.set(b.mediaId,{index:n++,table});walk(b.children,table);walk(b.items,table);for(const r of b.rows||[])for(const c of r.cells||[])walk(c.blocks,true);}}
 walk(array(document.blocks));
 for(const original of assets){const width=Number(original.width),height=Number(original.height);const caption=String(original.caption||'');const pos=positions.get(original.id);if(!pos)continue;
  const vectorReference=original.mime==='image/svg+xml'&&['connector','wiring'].includes(document.kind)&&width>=24&&height>=24;
  if((!vectorReference&&(width<180||height<120||width*height<45000))||width/height>7||height/width>7||/\b(?:icon|logo|bullet|arrow|special tool)\b/i.test(caption))continue;
  let score=Math.log(width*height)+(!pos.table?4:0)-pos.index*0.012;
  if(/\b(?:component|exploded|assembly|overview|location)\b/i.test(caption))score+=3;
  candidates.push({original,score});
 }
 candidates.sort((a,b)=>b.score-a.score);if(!candidates.length)return null;
 const m=resolve(candidates[0].original);return {...m,documentId:document.id,kind:document.kind==='wiring'?'wiring-diagram':document.kind==='connector'?'connector-view':'article-illustration'};
}
export function stripPrivateMetadata(value){
 if(Array.isArray(value))return value.map(stripPrivateMetadata);if(!value||typeof value!=='object')return value;
 const out={};for(const[k,v]of Object.entries(value)){if(k==='editorial'){if(v?.kind)out.editorial={kind:v.kind};continue;}if(['source','sourceHash','sourceHashes','sourceBlocks','sourcePath','source_path','pdfUrl','pdf_file','sourceUrl','checkedAt','humanReviewed'].includes(k))continue;out[k]=stripPrivateMetadata(v);}return out;
}

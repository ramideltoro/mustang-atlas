// Evidence selection is deliberately stricter than search: an adjacent topic
// may be useful to a reader without being evidence for how this component works.
const genericWords = new Set(['arm','body','charging','clutch','control','controls','module','system','component','location','description','operation','overview','connector','sensor','circuit','engine','transmission','pump','gear','bearing','shaft','switch','bracket','actuator','unit','relay','valve','motor','filter','cable','safety','precautions']);
const sectionCode = doc => doc.section_code || doc.section?.code || '';
const sectionTitle = doc => doc.section_title || doc.section?.title || '';
const systemId = doc => doc.system_id || doc.systemId || '';
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const contains = (haystack,needle) => !!needle && (' '+haystack+' ').includes(' '+needle+' ');
function componentName(doc) {
  let value=doc.title || '';
  if(doc.kind==='connector')value=value.replace(/^C[\dA-Z]+\s*[—–-]\s*/i,'');
  value=value.replace(/\s+[—–-]\s+(?:Overview|Component Location|System Operation(?: and Component Description)?|Component Description)$/i,'');
  value=value.replace(/\([^)]*\)/g,' ');
  return normalize(value);
}
function engines(doc) {
  let values=doc.engines;
  if(typeof values==='string')try{values=JSON.parse(values);}catch{values=[];}
  if(Array.isArray(values)&&values.length)return values.map(v=>String(v).toUpperCase());
  return [...new Set((sectionTitle(doc)+' '+doc.title).match(/\b(?:2\.3|3\.7|5\.0|5\.2)L\b/gi)||[])].map(v=>v.toUpperCase());
}
function transmission(doc) {
  const value=sectionTitle(doc);
  return {type:/automatic transmission/i.test(value)?'automatic':/manual transmission/i.test(value)?'manual':null,family:value.match(/\b(?:MT82|6R80|3160)\b/i)?.[0]?.toUpperCase() || null};
}
function compatible(candidate,documents) {
  const candidateEngines=engines(candidate),candidateTransmission=transmission(candidate);
  return documents.every(doc=>{
    const docEngines=engines(doc),docTransmission=transmission(doc);
    if(candidateEngines.length&&(!docEngines.length||docEngines.some(e=>!candidateEngines.includes(e))))return false;
    if(candidateTransmission.type&&docTransmission.type&&candidateTransmission.type!==docTransmission.type)return false;
    if(candidateTransmission.family&&docTransmission.family&&candidateTransmission.family!==docTransmission.family)return false;
    return true;
  });
}
function sameSection(a,b) {
  const code=sectionCode(a);
  if(code&&code===sectionCode(b))return true;
  const title=sectionTitle(a);
  return !!title&&title!=='Connector views'&&normalize(title)===normalize(sectionTitle(b));
}
function fullComponentMatch(name,candidate) {
  const candidateName=componentName(candidate);
  const tokens=name.split(' ').filter(Boolean);
  // A full distinctive one-word part name (e.g. horn) can match an overview
  // title, but a lone generic word may never pull evidence from another section.
  if(!tokens.length||tokens.length<3&&tokens.every(t=>genericWords.has(t)))return 0;
  if(name===candidateName)return 40;
  if(tokens.length<2)return 0;
  if(contains(candidateName,name))return 30;
  return 0;
}
function sharedWords(a,b) {
  const left=new Set(a.split(' ').filter(t=>!genericWords.has(t)&&t.length>2));
  const right=new Set(b.split(' '));
  return [...left].filter(t=>right.has(t)).length;
}

export function selectContextOverviews(documents,allDocuments) {
  if(!Array.isArray(documents)||!documents.length)return [];
  const ownIds=new Set(documents.map(d=>d.id));
  const names=[...new Set(documents.map(componentName))];
  // A connector's catalog category can be electrical even when it belongs to
  // another system. An exact component-title match establishes its real source
  // section; incidental mentions in unrelated overview prose do not.
  const anchors=documents.some(d=>d.kind==='connector')?allDocuments.filter(candidate=>candidate.kind!=='connector'&&candidate.kind!=='wiring'
    &&names.includes(componentName(candidate))&&compatible(candidate,documents)):[];
  return allDocuments.filter(candidate=>candidate.kind==='overview'&&!ownIds.has(candidate.id)&&compatible(candidate,documents))
    .map(candidate=>{
      const same=documents.some(doc=>sameSection(doc,candidate));
      const anchored=anchors.some(anchor=>sameSection(anchor,candidate));
      const full=Math.max(0,...names.map(name=>fullComponentMatch(name,candidate)));
      if(!same&&!anchored&&!full)return null;
      // Source section identity is stronger than a cross-section name match.
      const descriptive=/System Operation|Component Description/i.test(candidate.title)?3:/Overview/i.test(candidate.title)?2:0;
      const overlap=Math.max(0,...names.map(name=>sharedWords(name,componentName(candidate))));
      return {candidate,score:(same?100:anchored?80:0)+full+Math.min(overlap,8)+descriptive};
    }).filter(Boolean).sort((a,b)=>b.score-a.score||a.candidate.id.localeCompare(b.candidate.id)).slice(0,2).map(x=>x.candidate);
}

function permittedTerm(term,documents) {
  return documents.every(doc=>{
    const section=sectionTitle(doc).toLowerCase();
    if(Array.isArray(term.matchCategories)&&!term.matchCategories.includes(systemId(doc)))return false;
    if(Array.isArray(term.matchSectionContains)&&!term.matchSectionContains.some(s=>section.includes(s.toLowerCase())))return false;
    if(Array.isArray(term.excludeSectionContains)&&term.excludeSectionContains.some(s=>section.includes(s.toLowerCase())))return false;
    return true;
  });
}
export function selectContextTerms(documents,glossary) {
  if(!Array.isArray(documents)||!documents.length)return [];
  const names=documents.map(componentName);
  return glossary.filter(term=>permittedTerm(term,documents)).map(term=>{
    const aliases=[term.name,...(term.aliases||[])].map(normalize).filter(Boolean);
    let score=0;
    for(const alias of aliases){
      const tokens=alias.split(' ');
      // Canonical one-word names can be meaningful in their authored scope.
      // Shortened generic aliases cannot stand in for a longer component name.
      if(tokens.length===1&&genericWords.has(alias)&&alias!==normalize(term.name))continue;
      for(const name of names){if(contains(name,alias))score=Math.max(score,alias.length+(name===alias?100:0));}
    }
    return {term,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.term.id.localeCompare(b.term.id)).slice(0,6).map(x=>x.term);
}

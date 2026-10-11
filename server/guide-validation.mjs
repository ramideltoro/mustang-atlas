export const EDITORIAL_VERSION = 1;
export const VALIDATION_VERSION = 2;
export function editableLeaves(blocks) {
 const result=[];const visit=items=>{for(const block of items||[]){
  if(block.id&&typeof block.text==='string'&&block.text.trim()&&['heading','paragraph','safety','step','list-item'].includes(block.type))result.push({id:block.id,type:block.type,text:block.text,...(block.severity?{severity:block.severity}:{}),...(block.number?{number:block.number}:{})});
  visit(block.children);for(const item of block.items||[]){if(item.id&&item.text?.trim())result.push({id:item.id,type:'list-item',text:item.text});visit(item.children);}for(const row of block.rows||[])for(const cell of row.cells||[])visit(cell.blocks);
 }};visit(blocks);return result;
}
// Link targets identify documents; their digits are not repair specifications.
export const visibleText=text=>String(text||'').replace(/−/g,'-').replace(/(!?\[[^\]]*\])\([^\s)]+(?:\s+"[^"]*")?\)/g,'$1');
export const numericValues=text=>new Set(visibleText(text).match(/(?<![\p{L}\p{N}])[-+]\d+(?:[.,]\d+)*|\d+(?:[.,]\d+)*/gu)||[]);
const identifiers=text=>new Set(visibleText(text).match(/\b(?:[A-Z]{1,6}\d[A-Z0-9-]*|\d{2,4}-\d{2,4}[A-Z0-9-]*|[A-Z]{2,8}-[A-Z0-9-]+)\b/g)||[]);
const unitPatterns=[
 ['n-m',String.raw`(?:N\s*[.·-]?\s*m|newton[ -]?met(?:er|re)s?)`],
 ['lb-ft',String.raw`(?:(?:lb(?:f)?\.?|pounds?)\s*[.·-]?\s*(?:ft\.?|feet|foot)|(?:ft\.?|feet|foot)\s*[.·-]?\s*(?:lb(?:f)?\.?|pounds?))`],
 ['lb-in',String.raw`(?:(?:lb(?:f)?\.?|pounds?)\s*[.·-]?\s*(?:in\.?|inches|inch)|(?:in\.?|inches|inch)\s*[.·-]?\s*(?:lb(?:f)?\.?|pounds?))`],
 ['celsius',String.raw`(?:°\s*C|degrees?\s*(?:C|Celsius)|deg\.?\s*C)`],['fahrenheit',String.raw`(?:°\s*F|degrees?\s*(?:F|Fahrenheit)|deg\.?\s*F)`],
 ['km/h',String.raw`(?:km\s*/\s*h|kph|kilomet(?:er|re)s?\s+per\s+hour)`],['mph',String.raw`(?:mph|miles?\s+per\s+hour)`],
 ['psi','psi'],['kpa','kPa'],['mpa','MPa'],['bar','bar'],['rpm',String.raw`(?:rpm|r\s*/\s*min)`],
 ['mm',String.raw`(?:mm|millimet(?:er|re)s?)`],['cm',String.raw`(?:cm|centimet(?:er|re)s?)`],['inch',String.raw`(?:inches|inch|in\.?)(?=\s*(?:[),.;:]|$)|\s+(?:diameter|long|wide))`],['feet',String.raw`(?:ft\.?|feet|foot)`],
 ['litre',String.raw`(?:L|lit(?:er|re)s?)`],['ml',String.raw`(?:ml|millilit(?:er|re)s?)`],['quart',String.raw`(?:qt\.?|quarts?)`],['gallon',String.raw`(?:gal\.?|gallons?)`],['kg',String.raw`(?:kg|kilograms?)`],
 ['mV','mV'],['volt',String.raw`(?:V|volts?)`],['mA','mA'],['amp',String.raw`(?:A|amps?|amperes?)`],['ohm',String.raw`(?:Ω|ohms?)`],['hz','Hz'],
 ['minute',String.raw`(?:minutes?|mins?\.?)`],['second',String.raw`(?:seconds?|secs?\.?)`],['hour',String.raw`(?:hours?|hrs?\.?)`],['percent',String.raw`(?:%|percent)`],['degree',String.raw`(?:°|degrees?|deg\.?)`]
];
const quantityPatterns=unitPatterns.map(([unit,pattern])=>[unit,new RegExp(String.raw`(?<![\p{L}\p{N}])([-+]?\d+(?:[.,]\d+)*)\s*(?:-\s*)?(${pattern})(?![\p{L}\p{N}])`,'giu')]);
export function quantities(text){const result=new Set();const visible=visibleText(text);const spans=[];for(const [unit,pattern] of quantityPatterns){for(const m of visible.matchAll(pattern)){const start=m.index,end=start+m[0].length;if(spans.some(([a,b])=>start>=a&&end<=b))continue;spans.push([start,end]);result.add(m[1]+' '+unit);}}return result;}
function collectVisible(value,output){if(typeof value==='string')output.push(value);else if(Array.isArray(value))for(const v of value)collectVisible(v,output);else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))if(!['id','documentId','sourceHash','sourceRefs','mediaRefs','documentIds','reference','url','pdfUrl','mediaId','aliases','file'].includes(key))collectVisible(v,output);}
export function documentEvidence(document,curatedContext=null){const text=[];for(const value of [document.title,document.section?.title||document.section_title,document.engines,document.blocks,curatedContext])collectVisible(value,text);return text.join('\n');}
export function selectTeachingContext(doc,{terms=[],systems=[],abbreviations=[]}={}){
 const category=doc.systemId||doc.system_id,section=(doc.section?.title||doc.section_title||'').toLowerCase();const sample=(doc.title+' '+documentEvidence(doc)).toLowerCase();
 const selected=terms.filter(term=>(!term.matchCategories?.length||term.matchCategories.includes(category))&&(!term.matchSectionContains?.length||term.matchSectionContains.some(s=>section.includes(s.toLowerCase())))&&!(term.excludeSectionContains||[]).some(s=>section.includes(s.toLowerCase()))&&[term.name,...(term.aliases||[])].some(alias=>alias.length>3&&sample.includes(alias.toLowerCase()))).slice(0,14).map(({name,aliases,definition,details,sourceRefs})=>({name,aliases,definition,details,sourceRefs}));
 const system=systems.find(s=>s.id===category);return {terms:selected,abbreviations:abbreviations.filter(a=>a.documentIds?.includes(doc.id)).map(({name,definition})=>({name,definition})),system:system?{introduction:system.introduction,howItWorks:system.howItWorks,sourceRefs:system.sourceRefs}:null};
}
const claimIndex=evidence=>({numbers:numericValues(evidence),quantities:quantities(evidence)});
function novelClaims(text,index,prefix,errors){const allowed=index.numbers,allowedQuantities=index.quantities;for(const n of numericValues(text))if(!allowed.has(n))errors.push(prefix+': new numeric value '+n);for(const q of quantities(text))if(!allowedQuantities.has(q))errors.push(prefix+': unsupported quantity or unit '+q);}
export function validateEdits(leaves,output,{evidence=leaves.map(l=>l.text).join('\n'),checkMetadata=true}={}){
 const errors=[],evidenceIndex=claimIndex(evidence);if(!output||!Array.isArray(output.edits))return {passed:false,errors:['Missing edits'],validationVersion:VALIDATION_VERSION};
 if(output.uncertainties?.length)errors.push(...output.uncertainties.map(x=>'Needs review: '+x));const expected=new Map(leaves.map(l=>[l.id,l])),seen=new Set();
 for(const edit of output.edits){const source=expected.get(edit.blockId);if(!source){errors.push('Unknown block '+edit.blockId);continue;}if(seen.has(edit.blockId))errors.push('Duplicate block '+edit.blockId);seen.add(edit.blockId);if(typeof edit.text!=='string'||!edit.text.trim()){errors.push('Empty block '+edit.blockId);continue;}
  const have=numericValues(edit.text),haveQ=quantities(edit.text);for(const n of numericValues(source.text))if(!have.has(n))errors.push(edit.blockId+': missing numeric value '+n);for(const q of quantities(source.text))if(!haveQ.has(q))errors.push(edit.blockId+': missing quantity or changed unit '+q);
  novelClaims(edit.text,claimIndex(source.text),edit.blockId,errors);
  for(const id of identifiers(source.text))if(!visibleText(edit.text).includes(id))errors.push(edit.blockId+': missing identifier '+id);
  if(source.type!=='heading'&&(source.text.length>90||source.text.length>25&&/\b(remove|install|disconnect|check|tighten|loosen|measure|inspect|replace|ensure|attach|apply|clean)\b/i.test(source.text))&&edit.text.trim()===source.text.trim())errors.push(edit.blockId+': unchanged source prose');
  if(source.text.length>180&&edit.text.length<source.text.length*.5)errors.push(edit.blockId+': rewrite too short to retain the source detail');
  if(typeof edit.why!=='string')errors.push(edit.blockId+': missing explanation field');novelClaims(edit.why,evidenceIndex,edit.blockId+' explanation',errors);
 }
 for(const leaf of leaves)if(!seen.has(leaf.id))errors.push('Missing block '+leaf.id);
 if(checkMetadata){for(const key of ['title','introduction'])if(typeof output[key]==='string')novelClaims(output[key],evidenceIndex,key,errors);for(const group of output.requirements||[])for(const item of group.items||[])novelClaims((item.name||'')+' '+(item.detail||''),evidenceIndex,'Requirement',errors);}
 return {passed:errors.length===0,errors,expectedBlocks:leaves.length,receivedBlocks:seen.size,humanReviewed:false,editorialVersion:EDITORIAL_VERSION,validationVersion:VALIDATION_VERSION};
}
export function validateGuide(document,guide,{curatedContext=null}={}){
 if(!guide||guide.documentId!==document.id||guide.sourceHash!==(document.sourceHash||document.source_hash)||guide.status!=='complete'||guide.checks?.passed!==true)return {passed:false,errors:['Guide identity, source hash or publication status does not match'],validationVersion:VALIDATION_VERSION};
 return validateEdits(editableLeaves(document.blocks),guide,{evidence:documentEvidence(document,curatedContext)});
}

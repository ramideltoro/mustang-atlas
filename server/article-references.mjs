import {documentApplicability,operationFor,isPublicDocument} from './catalog.mjs';
const normal=text=>String(text||'').toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim();
export function neutralCopy(text){return String(text||'').replace(/(?:The original table is retained below so you can compare it with the )?\[(?:Compare [^\]]+|source PDF|reference)\]\(\/source\/[^)]+\)\.?/gi,'').replace(/\[([^\]]+)\]\(\/source\/[^)]+\)/gi,(_,label)=>/^Compare /i.test(label)?'Compare the illustrations below':'illustrations in this article').replace(/\bSource wording clarification\b/gi,'Wording clarification').replace(/\b(?:Ford(?:'s)?\s+)?(?:workshop|service)\s+manual(?:s)?\b/gi,'repair instructions').replace(/\boriginal\s+(?:source|PDF|manual)\b/gi,'reference').replace(/\bsource\s+PDF\b/gi,'reference').replace(/\bthe manual(?:'s)?\b(?!\s+(?:transmission|climate|control|clutch|shift|mode|lever|operation|procedure|adjustment|release|steering|brake|handling|test|seat|window|gearbox)\b)/gi,m=>m.endsWith("'s")?'the reference’s':'the reference').replace(/\bthis manual\b(?!\s+(?:transmission|climate|control|clutch|shift|mode|lever|operation|procedure|adjustment|release|steering|brake|handling|test|seat|window|gearbox)\b)/gi,'this reference').replace(/\bsupplied (?:source|manual)(?:['’]s)?\b/gi,'reference').replace(/\bmanual (says|shows|describes|explains|lists|specifies)\b/gi,'reference $1').replace(/\bsource view\b/gi,'reference view').replace(/\boriginal electrical wiring diagram\b/gi,'Electrical wiring diagram');}
export function createReferenceResolver(rows){
 rows=rows.filter(isPublicDocument);
 const ids=new Map(rows.map(r=>[r.id,r]));const refs=new Map(),titles=new Map();for(const r of rows){let source={};try{source=JSON.parse(r.source||'{}');}catch{}for(const[key,map]of[[source.reference,refs],[normal(r.title),titles]])if(key){if(!map.has(key))map.set(key,[]);map.get(key).push(r);}}
 function compatible(candidate,doc){const a=documentApplicability(candidate).engines,b=documentApplicability(doc).engines;return !a.length||!b.length||a.some(e=>b.includes(e));}
 function byId(id,doc){const exact=ids.get(id);if(exact&&exact.id!==doc.id&&compatible(exact,doc))return exact;const options=(refs.get(id)||[]).filter(r=>r.id!==doc.id&&compatible(r,doc));const same=options.filter(r=>r.section_code===(doc.section_code??doc.section?.code));return same.length===1?same[0]:options.length===1?options[0]:null;}
 function resolve(title,metadata,doc){const key=normal(title);let options=(titles.get(key)||[]).filter(r=>r.id!==doc.id&&compatible(r,doc));const code=metadata.match(/\b\d{3}-\d{2}[A-Z]?\b/)?.[0];if(code)options=options.filter(r=>r.section_code===code);const phase=metadata.split(',').at(-1)?.trim();if(phase&&options.some(r=>normal(operationFor(r))===normal(phase)))options=options.filter(r=>normal(operationFor(r))===normal(phase));
  const related=typeof doc.related==='string'?JSON.parse(doc.related):doc.related||[];const linked=new Set(related.map(id=>byId(id,doc)?.id).filter(Boolean));const direct=options.filter(r=>linked.has(r.id));if(direct.length===1)return direct[0];if(options.length===1)return options[0];const same=options.filter(r=>r.section_code===(doc.section_code??doc.section?.code));return same.length===1?same[0]:null;
 }
 function cleanText(input,doc){let text=neutralCopy(input).replace(/\bor(?=REFER\s+to\s*:)/gi,'or ');const pattern=/\bREFER\s+to\s*:\s*/gi;let out='',cursor=0,match;const references=[];
  while((match=pattern.exec(text))){if(match.index<cursor)continue;out+=text.slice(cursor,match.index);const start=pattern.lastIndex,tail=text.slice(start);const meta=/\(\s*\d{3}-\d{2}[A-Z]?\b/.exec(tail);let end,title,metadata='';
   if(meta&&meta.index<400&&!/\n\s*REFER\s+to/i.test(tail.slice(0,meta.index))){title=tail.slice(0,meta.index).trim();let depth=0,i=start+meta.index;for(;i<text.length;i++){if(text[i]==='(')depth++;if(text[i]===')'&&--depth===0){i++;break;}}end=i;metadata=text.slice(start+meta.index+1,end-1);if(text[end]==='.')end++;}
   else{const line=tail.split('\n')[0];const boundary=line.search(/[.;](?=\s|$)/);const clause=boundary>=0?line.slice(0,boundary+1):line;title=clause.replace(/[.;]\s*$/,'').trim();end=start+clause.length;}
   const target=resolve(title,metadata,doc);if(target){const label=neutralCopy(target.title).replace(/[\[\]]/g,'');out+=`See [${label}](#/document/${target.id}).`;references.push({documentId:target.id,title:label,href:`#/document/${target.id}`,kind:target.kind});}
   cursor=end;pattern.lastIndex=end;
  }
  out+=text.slice(cursor);out=out.replace(/(See \[[^\]]+\]\(#\/document\/[A-Za-z0-9_-]+\)\.)(?:\s*\1)+/g,'$1').replace(/\bFor ([^\n]+),\s*See /g,'For $1, see ').replace(/[ \t]+\n/g,'\n').trim();
  // A pure introductory referral has no independent action when its destination
  // is unavailable. Preserve imperative and diagnostic content in mixed blocks.
  if(!references.length&&/^For [^.!?]+,\s*$/.test(out))out='';
  return {text:out,references};
 }
 function blocks(input,doc){
  const result=[];for(const original of input||[]){const b=structuredClone(original);if(typeof b.text==='string'){const cleaned=cleanText(b.text,doc);b.text=cleaned.text;if(cleaned.references.length)b.references=cleaned.references;}if(b.why)b.why=neutralCopy(b.why);if(b.children)b.children=blocks(b.children,doc);if(b.items)b.items=blocks(b.items,doc);for(const row of b.rows||[])for(const cell of row.cells||[]){if(cell.text)cell.text=cleanText(cell.text,doc).text;if(cell.blocks)cell.blocks=blocks(cell.blocks,doc);}
   if(['paragraph','heading','missing-media'].includes(b.type)&&!b.text&&!b.children?.length)continue;result.push(b);
  }
  return result.filter((b,i)=>{if(b.type!=='heading')return true;let j=i+1;while(j<result.length&&result[j].type==='paragraph'&&/^See \[|^For .+, see \[/i.test(result[j].text))j++;const next=result[j];if(next?.type==='heading'&&normal(next.text)===normal(b.text)&&(next.level||2)<=(b.level||2))return false;
   // Only remove an empty heading when its entire original section consisted
   // of referral paragraphs. A standalone technical heading is still content.
   const sourceIndex=(input||[]).findIndex(v=>v.id===b.id);const tail=(input||[]).slice(sourceIndex+1);const boundary=tail.findIndex(v=>v.type==='heading'&&(v.level||2)<=(b.level||2));const section=boundary<0?tail:tail.slice(0,boundary);const referralsOnly=section.length>0&&section.every(v=>v.type==='paragraph'&&/^(?:For [^.!?]+,\s*)?REFER\s+to\s*:/i.test(v.text||''));if(referralsOnly&&(!next||next.type==='heading')&&j===i+1)return false;return true;});
 }
 function cleanObject(value){if(typeof value==='string')return neutralCopy(value).replace(/\[([^\]]+)\]\(#\/document\/([A-Za-z0-9_-]+)\)/g,(whole,label,id)=>ids.has(id)?whole:label);if(Array.isArray(value))return value.map(cleanObject);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/^(url|href|id|documentId|sourceHash)$/.test(k)?v:cleanObject(v)]));return value;}
 return {byId,resolve,cleanText,blocks,cleanObject};
}

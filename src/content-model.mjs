import {marked} from 'marked';
export function listItems(data){return Array.isArray(data)?data:data?.items||[];}
export function readableTitle(value){
  const parts=String(value||'').split(/\s*>\s*/).filter(Boolean),last=parts.at(-1)||'';
  if(parts.length<2)return last;
  if(/^overview$/i.test(last))return parts.at(-2).replace(/\s*[-–—:]\s*overview$/i,'');
  return /^(removal|installation|assembly|disassembly|inspection|adjustment)$/i.test(last)?`${parts.at(-2)} · ${last}`:last;
}
export function safeHref(value){return /^(?:https?:\/\/|#\/|\/(?!\/))/.test(String(value||''))?value:null;}
export function sourceHref(source){return (source?.documentId?'#/document/'+encodeURIComponent(source.documentId):null)||source?.url||source?.pdfUrl||(Number(source?.page)>0?'/source/manual.pdf#page='+Number(source.page):null);}
export function categoryName(value){return String(value||'Reference').replace(/[-_]/g,' ').replace(/\b\w/g,char=>char.toUpperCase());}
function escape(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function normalized(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();}
function contextMatches(term,context){
  const title=normalized(context?.title),category=normalized(context?.system||context?.category);
  if(term.matchCategories?.length&&!term.matchCategories.some(item=>normalized(item)===category))return false;
  if(term.matchSectionContains?.length&&!term.matchSectionContains.some(item=>title.includes(normalized(item))))return false;
  if(term.excludeSectionContains?.some(item=>title.includes(normalized(item))))return false;
  return true;
}
export function createTermMatcher(terms=[],context={}){
  const aliases=new Map(),caseSensitiveAliases=new Map();
  for(const term of terms){for(const raw of [term.name,term.title,...(term.aliases||[])]){const alias=normalized(raw),acronym=/^[A-Z][A-Z0-9/&.-]{1,11}(?:s)?$/.test(String(raw||''));if(alias.length<3&&!acronym)continue;if(acronym){if(!caseSensitiveAliases.has(alias))caseSensitiveAliases.set(alias,new Set());caseSensitiveAliases.get(alias).add(raw);}const found=aliases.get(alias);aliases.set(alias,found&&found.id!==term.id?{ambiguous:true}:term);}}
  const keys=[...aliases.keys()].sort((a,b)=>b.length-a.length);
  if(!keys.length)return text=>[{text:String(text||'')}];
  const pattern=new RegExp(keys.map(key=>escape(key).replace(/ /g,'\\s+')).join('|'),'giu');
  return (text,seen=new Set())=>{
    const parts=[];let end=0;pattern.lastIndex=0;
    for(const match of String(text).matchAll(pattern)){
      const start=match.index,finish=start+match[0].length;
      if(/[\p{L}\p{N}_]/u.test(text[start-1]||'')||/[\p{L}\p{N}_]/u.test(text[finish]||''))continue;
      const key=normalized(match[0]),term=aliases.get(key);
      // A product prefix such as VC in VC-3-B is part of one identifier,
      // not an occurrence of an unrelated glossary abbreviation.
      if(/^[A-Z0-9]{1,12}$/.test(match[0])&&/^(?:-[A-Z0-9]+)+\b/.test(text.slice(finish)))continue;
      if(caseSensitiveAliases.has(key)&&!caseSensitiveAliases.get(key).has(match[0]))continue;
      if(!term||term.ambiguous||(term.editorial?.kind==='source-expansion'&&match[0]!==match[0].toUpperCase())||term.hasExplanation===false||!contextMatches(term,context)||seen.has(term.id))continue;
      if(start>end)parts.push({text:text.slice(end,start)});
      parts.push({text:match[0],term});seen.add(term.id);end=finish;
    }
    if(end<text.length)parts.push({text:text.slice(end)});
    return parts;
  };
}
export function callout(value){
  const match=String(value||'').match(/^(?:\[!(WARNING|CAUTION|NOTICE|NOTE|TIP|IMPORTANT|EXPLANATION)\]|(?:\*\*)?(WARNING|CAUTION|NOTICE|NOTE|TIP|IMPORTANT|EXPLANATION)(?:\*\*)?\s*:\s*(?:\*\*)?)\s*/i);
  return match?{kind:(match[1]||match[2]).toLowerCase(),body:String(value).slice(match[0].length)}:null;
}
export function mediaItems(value){return (value||[]).filter(item=>safeHref(item.url||item.src)&&Number(item.width||1)>0&&Number(item.height||1)>0);}
export function uniqueSources(values=[]){const seen=new Set();return values.filter(source=>{const key=sourceHref(source);if(!key||seen.has(key))return false;seen.add(key);return true;});}

export function hasBlockContent(block){
 if(!block)return false;
 if(String(block.text??'').replace(/[\s\u200b\ufeff]/g,'')||String(block.why??'').trim())return true;
 if(block.type==='media'&&block.mediaId||block.type==='missing-media')return true;
 return (block.children||[]).some(hasBlockContent)||(block.textBlocks||[]).some(hasBlockContent)||(block.items||[]).some(hasBlockContent)||(block.blocks||[]).some(hasBlockContent)||(block.rows||[]).some(row=>(row.cells||[]).some(hasBlockContent));
}
// The exporter emits a numbered marker and its drawing as adjacent blocks.
// Keep their original order and IDs, but present the drawing inside that step.
export function normalizeReadingBlocks(blocks=[]){
 const result=[];
 for(let index=0;index<blocks.length;index++){
  const block=blocks[index],next={...block};
  if(block.children)next.children=normalizeReadingBlocks(block.children);
  if(block.textBlocks)next.textBlocks=normalizeReadingBlocks(block.textBlocks);
  if(block.items)next.items=block.items.map((item,n)=>({...item,number:block.ordered?(item.number??((Number(block.start)||1)+n)):item.number,children:normalizeReadingBlocks(item.children||[])})).filter(hasBlockContent);
  if(block.rows)next.rows=block.rows.map(row=>({...row,cells:row.cells.map(cell=>({...cell,blocks:normalizeReadingBlocks(cell.blocks||[])}))}));
  if(block.type==='step'){
   const figures=[];
   while(['media','missing-media'].includes(blocks[index+1]?.type))figures.push({...blocks[++index]});
   if(figures.length)next.children=[...(next.children||[]),...figures];
   if(!hasBlockContent(next))continue;
  }
  if(block.type==='list'&&!hasBlockContent(next))continue;
  result.push(next);
 }
 let currentType='';
 return result.map((block,index)=>{
  if(block.type!=='heading')return block;
  let explicitType='';
  for(let n=index+1;n<result.length&&!['heading','step'].includes(result[n].type);n++){
   const match=String(result[n].text||'').trim().match(/^(?:NOTE:\s*)?(Type\s+[A-Za-z0-9-]+)\s*$/i);
   if(match)explicitType=match[1];
  }
  if(explicitType)currentType=explicitType;
  else if(!/^(?:connect|disconnect)$/i.test(block.text.trim()))currentType='';
  return {...block,...(currentType&&/^(?:connect|disconnect)$/i.test(block.text.trim())?{displayText:`${block.text.trim()} · ${currentType}`}:{})};
 });
}
export function sectionTone(text){const value=String(text||'').toLowerCase();if(/^(?:disconnect|removal|disassembly)\b/.test(value))return 'amber';if(/^(?:connect|installation|assembly|finish|check your work)\b/.test(value))return 'green';if(/diagnos|inspect|test|troubleshoot/.test(value))return 'violet';return 'blue';}
export function readingOutline(blocks=[]){const result=[];function visit(items){for(const block of items||[]){if(block.type==='heading'&&String(block.text||'').trim())result.push({id:'block-'+block.id,title:block.displayText||block.text,level:Math.max(2,Math.min(4,Number(block.level)||2)),tone:sectionTone(block.displayText||block.text)});visit(block.textBlocks);visit(block.children);for(const item of block.items||[])visit(item.children);for(const row of block.rows||[])for(const cell of row.cells||[])visit(cell.blocks);}}visit(blocks);return result;}

/** Highlight intact material statements; never guess or rewrite a part number. */
export function materialSegments(value){
 const text=String(value||''),lines=text.match(/[^\n]*(?:\n|$)/g)?.filter(Boolean)||[],result=[];
 const productLine=line=>/^\s*(?:\/\s*)?\(?[A-Z][A-Z0-9]{1,}(?:-[A-Z0-9]+)+\)?[.,]?\s*$/.test(line.trim());
 for(let index=0;index<lines.length;index++){
  let value=lines[index],material=/\bMotorcraft(?:®)?/i.test(value);
  if(material)while(index+1<lines.length&&productLine(lines[index+1]))value+=lines[++index];
  const previous=result.at(-1);
  if(previous&&previous.material===material)previous.text+=value;
  else result.push({text:value,material});
 }
 return result;
}

/** Only authored guide fields opt into block Markdown. Everything other than
 * explicit tables/lists remains literal text, including units and HTML. */
export function guideTextBlocks(value,id='guide-text'){
 const tokens=marked.lexer(String(value||''));
 if(!tokens.some(token=>['table','list','heading'].includes(token.type)))return null;
 let sequence=0;
 const nextId=()=>`${id}-text-${++sequence}`;
 function convert(items){
  const blocks=[];let plain='';
  const flush=()=>{if(plain.trim())blocks.push({id:nextId(),type:'paragraph',text:plain.trim()});plain='';};
  for(const token of items){
   if(token.type==='table'){
    flush();
    const row=(cells,header)=>({cells:cells.map(cell=>({text:cell.text,header,colSpan:1,rowSpan:1,blocks:[]}))});
    blocks.push({id:nextId(),type:'table',rows:[row(token.header,true),...token.rows.map(cells=>row(cells,false))]});
   }else if(token.type==='heading'){
    flush();blocks.push({id:nextId(),type:'heading',level:Math.max(2,Math.min(4,token.depth)),text:token.text});
   }else if(token.type==='list'){
    flush();
    blocks.push({id:nextId(),type:'list',ordered:token.ordered,start:token.start,items:token.items.map(item=>({id:nextId(),type:'list-item',text:'',number:token.ordered?Number(item.raw.match(/^\s*(\d+)[.)]/)?.[1]||token.start):undefined,children:convert(item.tokens)}))});
   }else plain+=token.raw??token.text??'';
  }
  flush();return blocks;
 }
 return convert(tokens);
}

const connectorLayoutFields=new Set(['Box','Cols','Title Mnemonic']);
const connectorPinHeaders=new Set(['Cavity','Circuit Number','Color','Gauge','Function','Qualifier','Used','Terminal Part Number']);
function wiringLabelTableId(blocks,document){
 // parseWiring emits exactly one SVG followed by its searchable text runs.
 // Match that explicit parser structure rather than interpreting cell content
 // or an optional ECAD title, which component-location sheets do not have.
 if(document.kind!=='wiring'||!/^wiring-\d+-\d+$/.test(document.id||'')||blocks?.length!==2||document.media?.length!==1)return null;
 const [image,labels]=blocks,media=document.media[0],id=document.id;
 if(image.type!=='media'||image.id!==`${id}-b00001`||image.mediaId!==`${id}-m0001`||media.id!==image.mediaId||media.mime!=='image/svg+xml')return null;
 if(labels.type!=='table'||labels.id!==`${id}-b00002`||labels.caption||!labels.rows?.length)return null;
 const plainRows=labels.rows.every(row=>row.cells?.length===1&&typeof row.cells[0].text==='string'&&!row.cells[0].header&&!row.cells[0].blocks?.length&&(row.cells[0].colSpan||1)===1&&(row.cells[0].rowSpan||1)===1);
 return plainRows?labels.id:null;
}
export function readerBlocks(blocks,document={},view='guide'){
 if(!document)return blocks||[];
 if(view==='source')return blocks;
 const authored=document.teachingStatus==='complete';
 const labelsId=wiringLabelTableId(blocks,document);
 function field(item,id){const next={...item};if(authored&&item.text&&item.type!=='heading'){const text=item.type==='safety'?(callout(item.text)?.body||item.text):item.text;const rich=guideTextBlocks(text,item.id||id);if(rich)next.textBlocks=rich;}return next;}
 function visit(items){return (items||[]).map((block,index)=>{
  const next=field(block,`block-${index}`);
  if(block.children)next.children=visit(block.children);
  if(block.items)next.items=block.items.map((item,n)=>({...field(item,`${block.id}-item-${n}`),children:visit(item.children)}));
  if(block.rows)next.rows=block.rows.map((row,r)=>({...row,cells:row.cells.map((cell,c)=>({...field(cell,`${block.id}-cell-${r}-${c}`),blocks:visit(cell.blocks)}))}));
  return next;
 });}
 return normalizeReadingBlocks(visit(blocks)).map(block=>{
  if(block.type!=='table')return block;
  if(block.id===labelsId)return {...block,diagramLabels:true};
  if(document.kind!=='connector')return block;
  let rows=block.rows||[];
  const keys=rows.map(row=>row.cells?.length===2&&row.cells[0].header?row.cells[0].text:null);
  if(keys.includes('Box')&&keys.includes('CNumber'))rows=rows.filter(row=>!connectorLayoutFields.has(row.cells?.[0]?.text));
  const first=rows[0]?.cells||[];
  if(first.length>=5&&first[0].text==='Cavity'&&first.some(cell=>cell.text==='Circuit Number')&&first.every(cell=>connectorPinHeaders.has(cell.text))){
   const columns=first.map(cell=>cell.text.toLowerCase().replace(/\s+/g,'-'));
   rows=rows.map((row,index)=>({...row,cells:row.cells.map((cell,column)=>({...cell,header:index===0?true:cell.header,columnKey:columns[column]}))}));
   return {...block,rows,connectorPins:true};
  }
  return {...block,rows};
 });
}
export function documentTitle(document){
 const title=readableTitle(document?.title);
 if(document?.kind!=='connector')return title;
 // Humanize known words only: preserve arbitrary connector IDs and acronyms.
 const words=new Set('AIR CONDITIONING CLUTCH AND FIELD COIL CONNECTOR SENSOR SWITCH CONTROL MODULE FRONT REAR LEFT RIGHT ENGINE MOTOR POSITION TEMPERATURE PRESSURE WHEEL SPEED BRAKE TRANSMISSION POWER STEERING COLUMN DOOR LAMP HEADLAMP FOG LIGHT FUEL PUMP HEATED MIRROR SEAT SOLENOID VALVE INJECTOR IGNITION ACTUATOR ASSEMBLY HARNESS RELAY COMPRESSOR COOLANT BATTERY GROUND AUDIO SPEAKER RADIO ANTENNA DECKLID LOCK RELEASE INTERIOR EXTERIOR ELECTRONIC ELECTRIC PASSENGER DRIVER SIDE'.split(' '));
 return title.replace(/\b[A-Z]+\b/g,word=>words.has(word)?word[0]+word.slice(1).toLowerCase():word);
}

/** Recognize explicit Markdown references while preserving every other source
 * character. In particular, source unit asterisks, raw HTML and code stay text. */
export function annotateInlineSource(value,matcher,seen=new Set()){
 const text=String(value||'');
 return marked.Lexer.lexInline(text).flatMap(token=>{
  const raw=token.raw??token.text??'';
  if(token.type==='link'&&raw.startsWith('[')){
   const href=safeHref(token.href);
   return href?[{text:token.text,href}]:[{text:raw}];
  }
  // Don't activate Markdown-looking text inside code, HTML, or images.
  if(['codespan','html','image'].includes(token.type))return [{text:raw}];
  const parts=matcher?.(raw,seen);
  return parts?.length?parts:[{text:raw}];
 });
}

// Annotation owns its occurrence set. React can render the resulting tree more
// than once without consuming matches or changing which words are interactive.
export function annotateSourceTerms(blocks,matcher){
 let seen=new Set();
 const parts=text=>annotateInlineSource(text,matcher,seen);
 function field(item){
  if(item.textBlocks)return {...item,textBlocks:visit(item.textBlocks)};
  if(item.text==null)return {...item};
  const text=item.type==='safety'?(callout(item.text)?.body||item.text):item.text,segments=materialSegments(text);
  if(segments.some(segment=>segment.material)){
   const highlighted=segments.map(segment=>({...segment,termParts:parts(segment.text)}));
   return {...item,materialSegments:highlighted,termParts:highlighted.flatMap(segment=>segment.termParts)};
  }
  return {...item,termParts:parts(text)};
 }
 function visit(items){return (items||[]).map(block=>{
  if(block.type==='heading')seen=new Set();
  const next=field(block);
  if(block.children)next.children=visit(block.children);
  if(block.items)next.items=block.items.map(item=>({...field(item),children:visit(item.children)}));
  if(block.rows)next.rows=block.rows.map(row=>({...row,cells:row.cells.map(cell=>({...field(cell),blocks:visit(cell.blocks)}))}));
  return next;
 });}
 return visit(blocks);
}
export function annotateMarkdownTerms(tokens,matcher,lexer){
 let seen=new Set();
 const hasContent=token=>Boolean(String(token.text||'').replace(/[\s\u200b\ufeff]/g,'')||token.type==='image'&&token.href||(token.tokens||[]).some(hasContent)||(token.items||[]).some(hasContent)||(token.header||[]).some(hasContent)||(token.rows||[]).some(row=>row.some(hasContent)));
 function visit(items,linked=false){return (items||[]).map(token=>{
  const next={...token};
  if(['paragraph','text'].includes(token.type)&&/\bMotorcraft(?:®)?/i.test(token.text||''))next.atlasMaterial=true;
  if(token.type==='heading')seen=new Set();
  if(token.type==='code'||token.type==='codespan'||token.type==='image')return next;
  if(token.type==='blockquote'){
   const notice=callout(token.text);
   if(notice){next.atlasCallout=notice;next.tokens=visit(lexer(notice.body));return next;}
  }
  const withinLink=linked||token.type==='link';
  if(token.tokens)next.tokens=visit(token.tokens,withinLink);
  else if(token.type==='text'&&!withinLink)next.termParts=matcher?matcher(String(token.text||''),seen):[{text:token.text||''}];
  if(token.items)next.items=token.items.map((item,index)=>({...item,atlasNumber:token.ordered?Number(item.raw?.match(/^\s*(\d+)[.)]/)?.[1]??(Number(token.start)||1)+index):undefined,tokens:visit(item.tokens,withinLink)})).filter(hasContent);
  if(token.header)next.header=token.header.map(cell=>({...cell,tokens:visit(cell.tokens,withinLink)}));
  if(token.rows)next.rows=token.rows.map(row=>row.map(cell=>({...cell,tokens:visit(cell.tokens,withinLink)})));
  return next;
 });}
 return visit(tokens);
}

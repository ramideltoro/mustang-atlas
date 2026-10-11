import { load } from 'cheerio';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { classifySystem, detectEngines } from './taxonomy.mjs';
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const normalize = value => String(value||'').replace(/\u00a0/g,' ').replace(/[ \t\r\f]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
export function tocCatalog(toc) {
 const out=[]; const clean=s=>s.replace(/[\\/\u2013\u2014]/g,'-');
 function walk(obj,parts=[]){for(const [name,value] of Object.entries(obj)){const next=[...parts,name];if(typeof value==='string')out.push({id:/^[A-Za-z0-9_-]+$/.test(value)?value:`reference-${hash(value).slice(0,12)}`,reference:value,path:next.map(clean).join('/'),title:name});else walk(value,next);}}
 walk(toc);return out;
}
async function rasterDataUri(value) {
 const match=value.match(/^data:(image\/(?:png|jpeg|gif|webp))?;base64,([\s\S]+)$/i);
 if(!match)return null;
 const encoded=match[2].replace(/\s/g,'');
 // Buffer's decoder tolerates invalid characters; reject those before decoding.
 if(encoded.length>90_000_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return null;
 const bytes=Buffer.from(encoded,'base64');
 const canonical=bytes.toString('base64');
 if(canonical.replace(/=+$/,'')!==encoded.replace(/=+$/,'')||(encoded.includes('=')&&canonical!==encoded))return null;
 let mime=null;
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
 else if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)mime='image/jpeg';
 else if(['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString('ascii')))mime='image/gif';
 else if(bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP')mime='image/webp';
 if(!mime||(match[1]&&match[1].toLowerCase()!==mime))return null;
 try{
  // Validate the complete raster, not just its header. Keep the original bytes.
  await sharp(bytes,{limitInputPixels:150000000,failOn:'warning'}).raw().toBuffer();
  return `data:${mime};base64,${bytes.toString('base64')}`;
 }catch{return null;}
}
const localSvgUrls=value=>value.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gis,(full,quote,reference)=>/^#[\w.:-]+$/.test(reference.trim())?full:'none');
const svgLocalName=element=>element.name?.split(':').at(-1).toLowerCase();
const activeSvgElements=new Set(['script','foreignobject','iframe','object','embed','animate','set','animatemotion','animatetransform']);
export async function sanitizeSvg(raw) {
 const $=load(raw,{xml:true});$('*').filter((_,el)=>activeSvgElements.has(svgLocalName(el))).remove();
 $('*').filter((_,el)=>svgLocalName(el)==='style').each((_,el)=>{$(el).text(localSvgUrls($(el).text().replace(/@import[^;]+;?/gi,'')));});
 for(const el of $('*').toArray())for(const [key,value] of Object.entries(el.attribs||{})){
  if(/^on/i.test(key)||/expression|@import/i.test(value)){$(el).removeAttr(key);continue;}
  if(/^(?:href|xlink:href)$/i.test(key)&&!value.startsWith('#')){
   const normalized=await rasterDataUri(value);
   if(normalized&&svgLocalName(el)==='image')$(el).attr(key,normalized);else $(el).removeAttr(key);
  }else $(el).attr(key,localSvgUrls(value));
 }
 return $.xml();
}
export async function saveAsset(bytes,mime,dataDir) {
 let ext = {'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/svg+xml':'svg'}[mime];
 if(!ext)throw new Error(`Unsupported image media type ${mime}`);
 if(ext==='svg')bytes=Buffer.from(await sanitizeSvg(bytes.toString()));
 const filename=`${hash(bytes)}.${ext}`;const dir=path.join(dataDir,'media');await fs.mkdir(dir,{recursive:true});
 try{await fs.writeFile(path.join(dir,filename),bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 let width=null,height=null;try{const info=await sharp(bytes,{limitInputPixels:150000000}).metadata();width=info.width;height=info.height;}catch{}
 return {url:`/media/${filename}`,mime,width,height};
}
const blockTags=new Set(['p','div','section','article','main','center','h1','h2','h3','h4','h5','h6','ol','ul','li','table','dl','dt','dd','blockquote','pre','hr','img']);
export async function parseHtml(raw,{id,relativePath,dataDir,title:tocTitle}) {
 const $=load(raw);const meta=name=>$(`meta[name="${name}"]`).attr('content')||'';
 const reference=meta('tps_procfilename')||id;
 const revision=meta('tps_lastupdated')||normalize($('a.bookinfosmall').text()).match(/Procedure revision date:\s*(.+)/i)?.[1]||null;
 $('body > table').each((_,el)=>{if($(el).find('a.bookinfosmall').length)$(el).remove();});
 const title=meta('tps_proctitle')||tocTitle||normalize($('h1').first().text())||path.basename(relativePath,'.html');
 const sectionTitle=meta('tps_section_title')||(relativePath.includes('Connector Views')?'Connector views':relativePath.split('/').find(p=>/^\d{3}-\d{2}/.test(p))||'General information');
 const sectionCode=meta('tps_sectionnumber')||sectionTitle.match(/^\d{3}-\d{2}[A-Z]?/)?.[0]||'';
 const subtype=meta('tps_ss_title')||relativePath.split('/').at(-2)||'';
 const kind=relativePath.includes('Connector Views')?'connector':/Diagnosis|Testing/i.test(subtype)?'diagnosis':/Removal|Installation|Assembly|Disassembly|General Procedures/i.test(subtype)?'repair':/Specification/i.test(title)?'specifications':/Description|Operation/i.test(subtype)?'overview':'general';
 const engines=detectEngines(`${sectionTitle} ${title}`);
 const related=[...new Set($('a[data-for]').map((_,e)=>$(e).attr('data-for')).get().filter(v=>/^G\d+$/.test(v)))];
 const abbreviations=[];$('abbr[title]').each((_,el)=>{const name=normalize($(el).text()),definition=normalize($(el).attr('title'));if(name&&definition)abbreviations.push({name,definition});});
 $('script,style,noscript,iframe,object,embed,link,meta,.show-vin').remove();
 $('h1').each((_,el)=>{if(normalize($(el).text())===title)$(el).remove();});
 // Hide controls, not their associated captions or explanatory text.
 $('select').each((_,el)=>{$(el).replaceWith($('<span></span>').text($(el).find('option').map((_,option)=>normalize($(option).text())).get().join(' / ')));});
 $('input,button,textarea').remove();
 const images=$('img').toArray();const media=[];const warnings=[];const imageMap=new Map();
 for(let start=0;start<images.length;start+=12){await Promise.all(images.slice(start,start+12).map(async(el,index)=>{
  const position=start+index;const src=$(el).attr('src')||'';const match=src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if(!match){imageMap.set(el,{missing:true,text:normalize($(el).attr('alt'))||'An image reference is missing from the supplied source.'});warnings.push({type:'missing-image',index:position,reference:src.slice(0,160)});return;}
  try{const asset=await saveAsset(Buffer.from(match[2].replace(/\s/g,''),'base64'),match[1].toLowerCase(),dataDir);
   const legend=$(el).closest('table').find('td[bgcolor][title]').map((_,cell)=>({color:$(cell).attr('bgcolor'),label:$(cell).attr('title')})).get();
   const item={id:`${id}-m${String(position+1).padStart(4,'0')}`,...asset,caption:normalize($(el).attr('alt'))||null,...(legend.length?{legend}: {})};media[position]=item;imageMap.set(el,item);
  }catch(error){warnings.push({type:'image-error',index:position,error:error.message});throw error;}
 }));}
 let sequence=0;const make=(type,properties={})=>({id:`${id}-b${String(++sequence).padStart(5,'0')}`,type,...properties});
 const inline=el=>{if(el.type==='text')return el.data;if(el.type!=='tag')return '';if(el.name==='br')return '\n';if(el.name==='img')return '';return (el.children||[]).map(inline).join('');};
 function paragraph(text){text=normalize(text);if(!text)return null;const safety=text.match(/^(WARNING|NOTICE|CAUTION|NOTE)\s*:/i);return safety?make('safety',{severity:safety[1].toLowerCase(),text}):make('paragraph',{text});}
 function children(nodes){const result=[];let buffer='';const flush=()=>{const b=paragraph(buffer);if(b)result.push(b);buffer='';};for(const el of nodes||[]){if(el.type==='text'){buffer+=el.data;continue;}if(el.type!=='tag')continue;if(!blockTags.has(el.name)&&!$(el).find('img,table,ol,ul,p,div,section').length){buffer+=inline(el);continue;}flush();result.push(...element(el));}flush();return result;}
 function item(li,type,number){const blocks=children(li.children);const first=blocks[0];let text='';if(first?.type==='paragraph'){text=first.text;blocks.shift();}return make(type,{...(number!==undefined?{number}:{}),text,children:blocks});}
 function element(el){
  if(el.name==='img'){const m=imageMap.get(el);return m?[m.missing?make('missing-media',{text:m.text}):make('media',{mediaId:m.id})]:[];}
  if(/^h[1-6]$/.test(el.name))return normalize(inline(el))?[make('heading',{level:Number(el.name[1]),text:normalize(inline(el))})]:[];
  if(el.name==='ol'||el.name==='ul'){
   const result=[];let number=parseInt($(el).attr('start')||'1',10)||1;let items=[];
   const flush=()=>{if(items.length){result.push(make('list',{ordered:false,start:1,items}));items=[];}};
   for(const child of el.children||[]){if(child.type==='tag'&&child.name==='li'){
    if(el.name==='ol'){const explicit=parseInt($(child).attr('value'),10);if(Number.isFinite(explicit))number=explicit;result.push(item(child,'step',number++));}
    else items.push(item(child,'list-item'));
   }else{const extra=children([child]);if(extra.length){flush();result.push(...extra);}}}flush();return result;
  }
  if(el.name==='table'){
   const contentText=normalize(inline(el));
   if(!contentText){return $(el).find('img').toArray().flatMap(element);}
   const captions=$(el).children('caption').toArray().flatMap(c=>{const text=normalize(inline(c));return text?[make('heading',{level:3,text})]:[];});
   const rows=[];$(el).children('thead,tbody,tfoot,tr').each((_,group)=>{const trs=group.name==='tr'?[group]:$(group).children('tr').toArray();for(const tr of trs){const cells=$(tr).children('th,td').toArray().map(cell=>{
    const cellText=normalize(inline(cell));
    const hasStructures=$(cell).find('img,table,ol,ul').length>0||(/^(WARNING|NOTICE|CAUTION|NOTE)\s*:/i.test(cellText))||cellText.length>180||($(cell).find('p,div').length>0&&cellText.length>80);
    return {text:hasStructures?'':normalize(inline(cell)),colSpan:Math.max(1,parseInt($(cell).attr('colspan'),10)||1),rowSpan:Math.max(1,parseInt($(cell).attr('rowspan'),10)||1),header:cell.name==='th',blocks:hasStructures?children(cell.children):[]};
   });if(cells.length)rows.push({cells});}});return rows.length?[...captions,make('table',{rows})]:children(el.children);
  }
  if(el.name==='p'){
   if($(el).find('img,table,ol,ul').length)return children(el.children);
   const text=normalize(inline(el));if(!text)return [];
   const onlyBold=$(el).children().length===1&&['b','strong'].includes($(el).children()[0]?.name);
   if(onlyBold&&text.length<140&&!/^(warning|notice|caution|note)\s*:/i.test(text)&&!/[.!?]$/.test(text))return [make('heading',{level:2,text})];
   return [paragraph(text)];
  }
  if(el.name==='hr')return [];
  return children(el.children);
 }
 const blocks=children($('body')[0]?.children||$.root()[0].children);
 const text=blockText(blocks);
 return {id,title,systemId:classifySystem(sectionCode+' '+sectionTitle,title,kind),section:{code:sectionCode,title:sectionTitle},kind,engines,summary:normalize(text).replace(/\n/g,' ').slice(0,240),sourceHash:hash(raw),blocks,media:media.filter(Boolean),related,source:{reference,pdfUrl:null,revision,...(relativePath.includes('Torque Wrench Calculators/')?{calculatorType:path.basename(relativePath,'.html')}: {})},text,abbreviations,warnings,sourceImageCount:images.length};
}
export function blockText(blocks){const out=[];for(const b of blocks||[]){if(b.text)out.push(b.text);if(b.children)out.push(blockText(b.children));if(b.items)out.push(blockText(b.items));for(const row of b.rows||[])for(const c of row.cells||[]){if(c.text)out.push(c.text);if(c.blocks)out.push(blockText(c.blocks));}}return out.filter(Boolean).join('\n');}
export async function parseWiring(raw,{id,relativePath,dataDir}){
 const $=load(raw,{xml:true});const section=relativePath.split('/').at(-2);const page=Number($('PageNumber').text())||Number(path.basename(relativePath,'.svg'));const reference=$('title').first().text();const title=`${section} — diagram ${page}`;
 const asset=await saveAsset(Buffer.from(raw),'image/svg+xml',dataDir);const media=[{id:`${id}-m0001`,...asset,caption:title}];const labels=normalize($('text').map((_,el)=>$(el).text()).get().join('\n'));
 return {id,title,systemId:classifySystem(section,title,'wiring'),section:{code:$('CellNumber').text(),title:section},kind:'wiring',engines:detectEngines(section),summary:`Original electrical wiring diagram for ${section}.`,sourceHash:hash(raw),blocks:[{id:`${id}-b00001`,type:'media',mediaId:media[0].id},...(labels?[{id:`${id}-b00002`,type:'table',rows:labels.split('\n').map(text=>({cells:[{text,colSpan:1,rowSpan:1,header:false,blocks:[]}]}))}]:[])],media,related:[...new Set($('a[name]').map((_,e)=>`connector-${$(e).attr('name')}`).get())],source:{reference,pdfUrl:null,revision:null},text:labels,warnings:[],abbreviations:[],sourceImageCount:1};
}

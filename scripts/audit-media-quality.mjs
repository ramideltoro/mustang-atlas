import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {load} from 'cheerio';
import sharp from 'sharp';
import {digest,isLargerOriginal} from './upgrade-media-lib.mjs';
import {sanitizeSvg} from '../server/parser.mjs';
import {createAssetQualityStore} from '../server/asset-quality.mjs';

const href=($,element)=>$(element).attr('xlink:href')||$(element).attr('href')||'';
const geometry=($,element)=>Object.fromEntries(['x','y','width','height','viewBox','transform','preserveAspectRatio'].map(key=>[key,$(element).attr(key)||null]));

export async function auditSvgRepair({bytes,oldBytes,rawSource}) {
 const repaired=load(bytes.toString(),{xml:true}),old=load(oldBytes.toString(),{xml:true});
 if(repaired('svg').length!==1||old('svg').length!==1)throw Error('Expected a single SVG root');
 // Re-sanitization performs full raster decoding and rejects active content,
 // external references, noncanonical data URIs and mismatched MIME signatures.
 if(await sanitizeSvg(bytes.toString())!==bytes.toString())throw Error('Restored SVG is not safely normalized');
 if(JSON.stringify(geometry(repaired,repaired('svg')[0]))!==JSON.stringify(geometry(old,old('svg')[0])))throw Error('Restored SVG root geometry changed');
 const oldImages=old('image').toArray(),images=repaired('image').toArray();
 if(images.length!==oldImages.length||!images.length)throw Error('Restored image count differs from original SVG');
 const seen=new Set();let restoredImages=0;
 for(const image of images){
  const id=repaired(image).attr('id'),matches=oldImages.filter(el=>old(el).attr('id')===id);
  if(!id||seen.has(id)||matches.length!==1)throw Error('Ambiguous restored image identity');seen.add(id);
  const before=matches[0],uri=href(repaired,image),oldUri=href(old,before);
  if(!/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(uri))throw Error('Restored image must contain a normalized raster payload');
  if(JSON.stringify(geometry(repaired,image))!==JSON.stringify(geometry(old,before)))throw Error('Embedded image geometry changed');
  if(oldUri&&uri!==oldUri)throw Error('Previously available embedded image changed');
  if(!oldUri)restoredImages++;
 }
 if(!restoredImages)throw Error('Marked SVG repair restores no missing image');
 if(rawSource){
  if(await sanitizeSvg(rawSource.toString())!==bytes.toString())throw Error('Restored SVG differs from sanitized original source');
  const source=load(rawSource.toString(),{xml:true}),sourceImages=source('image').toArray();
  if(sourceImages.length!==images.length)throw Error('Source embedded image count differs');
  for(const image of images){
   const id=repaired(image).attr('id'),matches=sourceImages.filter(el=>source(el).attr('id')===id);
   if(matches.length!==1)throw Error('Restored image missing from original source');
   const original=matches[0],uri=href(source,original);
   if(!/^data:(?:image\/(?:png|jpeg|gif|webp))?;base64,/i.test(uri))throw Error('Original image is not embedded raster data');
   if(!Buffer.from(uri.slice(uri.indexOf(',')+1),'base64').equals(Buffer.from(href(repaired,image).split(',')[1],'base64')))throw Error('Original embedded raster bytes changed');
   if(JSON.stringify(geometry(source,original))!==JSON.stringify(geometry(repaired,image)))throw Error('Original image placement changed');
  }
 }
 return {restoredImages,sourceVerified:!!rawSource};
}

export async function auditMediaQuality({dataDir=process.env.DATA_DIR||'data',sourceDir=process.env.MANUAL_SOURCE_DIR}={}){
 const data=path.resolve(dataDir),sourceRoot=sourceDir?path.resolve(sourceDir):null;
 const map=JSON.parse(fs.readFileSync(path.join(data,'media-quality.json')));
 if(map.version!==1||!map.assets||Array.isArray(map.assets)||typeof map.assets!=='object')throw Error('Invalid media-quality map');
 const db=new DatabaseSync(path.join(data,'atlas.sqlite'),{readOnly:true});
 const docs=db.prepare('SELECT id,source_path,source_hash,blocks,media FROM documents').all().map(d=>({...d,media:JSON.parse(d.media)}));db.close();
 const byId=new Map(docs.map(d=>[d.id,d])),originals=new Map(docs.flatMap(d=>d.media).map(m=>[m.url,m]));
 const resolver=createAssetQualityStore({dataDir:data}),queue=Object.entries(map.assets),issues=[],comparisons=[],restored=[];
 async function thumbnail(bytes){return sharp(bytes).flatten({background:'#fff'}).resize(128,128,{fit:'fill'}).removeAlpha().toColourspace('srgb').raw().toBuffer();}
 async function worker(){while(queue.length){const [url,asset]=queue.shift();try{
  const old=originals.get(url);if(!old)throw Error('Unknown catalog image');
  // Use the actual presentation resolver before opening any map-provided path.
  const resolved=resolver.resolve(old);
  if(resolved===old||resolved.url!==asset.url)throw Error('Override is rejected by the media resolver');
  const bytes=fs.readFileSync(path.join(data,asset.url.slice(1))),oldBytes=fs.readFileSync(path.join(data,url.slice(1)));
  const meta=await sharp(bytes,{limitInputPixels:150000000}).metadata();
  if(digest(bytes)!==path.basename(asset.url).split('.')[0])throw Error('Asset hash differs from filename');
  if(digest(oldBytes)!==path.basename(url).split('.')[0])throw Error('Original asset hash differs from filename');
  if(meta.width!==asset.width||meta.height!==asset.height)throw Error('Asset dimensions differ from metadata');
  if(asset.sourceKind==='svg-embedded-raster-repair'){
   const document=byId.get(asset.sourceDocumentId);
   if(!document||!document.media.some(m=>m.url===url)||document.source_hash!==asset.sourceHash)throw Error('SVG repair provenance differs from catalog');
   let rawSource;
   if(sourceRoot){
    const sourcePath=path.resolve(sourceRoot,document.source_path);
    if(!sourcePath.startsWith(sourceRoot+path.sep))throw Error('Source path escapes manual directory');
    rawSource=fs.readFileSync(sourcePath);
    if(digest(JSON.stringify({rawHash:digest(rawSource),blocks:JSON.parse(document.blocks),media:document.media}))!==document.source_hash)throw Error('Original source identity differs from catalog');
   }
   const check=await auditSvgRepair({bytes,oldBytes,rawSource});
   restored.push({originalUrl:url,url:asset.url,documentId:document.id,...check});
  }else{
   if(!isLargerOriginal(old,meta))throw Error('Image dimensions do not support upgrade');
   const a=await thumbnail(oldBytes),b=await thumbnail(bytes);
   if(a.length!==b.length)throw Error('Pixel channel mismatch');
   let sum=0;for(let i=0;i<a.length;i++)sum+=(a[i]-b[i])**2;
   comparisons.push({originalUrl:url,url:asset.url,rmse:Math.sqrt(sum/a.length),width:asset.width,height:asset.height});
   // Pixel differences rank human inspection; JPEG resampling is not a content validator.
  }
 }catch(error){issues.push({originalUrl:url,error:error.message});}}}
 await Promise.all(Array.from({length:3},worker));
 comparisons.sort((a,b)=>b.rmse-a.rmse);
 const allMedia=docs.flatMap(d=>d.media),unresolved=[...originals.values()].filter(m=>m.mime!=='image/svg+xml'&&!map.assets[m.url]);
 return {checkedAt:new Date().toISOString(),catalogImages:originals.size,upgradedAssets:Object.keys(map.assets).length,largerOriginalAssets:comparisons.length,restoredSvgAssets:restored.length,restoredEmbeddedImages:restored.reduce((n,r)=>n+r.restoredImages,0),sourceVerifiedSvgAssets:restored.filter(r=>r.sourceVerified).length,upgradedPlacements:allMedia.filter(m=>map.assets[m.url]).length,vectorAssets:[...originals.values()].filter(m=>m.mime==='image/svg+xml').length,unresolvedRasterAssets:unresolved.length,issues,restoredSvgs:restored,highestDifferences:comparisons.slice(0,12),unresolved:unresolved.map(m=>({...m,documents:docs.filter(d=>d.media.some(x=>x.url===m.url)).map(d=>d.id)}))};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const index=process.argv.indexOf('--source'),sourceDir=index===-1?process.env.MANUAL_SOURCE_DIR:process.argv[index+1];
 if(index!==-1&&(!sourceDir||sourceDir.startsWith('--')))throw Error('--source requires the original manual directory');
 const result=await auditMediaQuality({sourceDir});
 fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/media-quality-audit.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,issues:result.issues.slice(0,10),issueCount:result.issues.length,restoredSvgs:undefined,highestDifferences:result.highestDifferences.slice(0,3),unresolved:undefined},null,2));
 if(result.issues.length)process.exitCode=1;
}

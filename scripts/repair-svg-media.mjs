import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {load} from 'cheerio';
import sharp from 'sharp';
import {openDb} from '../server/db.mjs';
import {hash,sanitizeSvg,saveAsset} from '../server/parser.mjs';

const href=($,element)=>$(element).attr('xlink:href')||$(element).attr('href')||'';
const embeddedImages=$=>$('image').toArray().filter(element=>/^data:/i.test(href($,element)));
const geometry=($,element)=>Object.fromEntries(['x','y','width','height','viewBox','transform','preserveAspectRatio'].map(key=>[key,$(element).attr(key)||null]));

// This writes new content-addressed files and a proposal only. The catalog,
// source PDFs, editorial hashes, and live media map are deliberately read-only.
export async function proposeSvgRepairs({sourceDir,dataDir='data',output='work/media-quality-svg-repairs.json',previewDir='work/svg-repair-previews'}={}){
 if(!sourceDir)throw new Error('A source directory is required.');
 sourceDir=path.resolve(sourceDir);dataDir=path.resolve(dataDir);output=path.resolve(output);previewDir=path.resolve(previewDir);
 if(output===path.join(dataDir,'media-quality.json'))throw new Error('Write a separate proposal; do not replace the live quality map.');
 const db=openDb({dataDir,readOnly:true});let rows;
 try{rows=db.prepare("SELECT id,source_path,source_hash,blocks,media FROM documents WHERE kind='wiring' ORDER BY id").all();}finally{db.close();}
 const proposal={version:1,assets:{},audit:{scannedDocuments:rows.length,affectedDocuments:0,restoredEmbeddedImages:0,documents:[]}};
 await fs.mkdir(previewDir,{recursive:true});
 for(const row of rows){
  const sourcePath=path.resolve(sourceDir,row.source_path);
  if(!sourcePath.startsWith(sourceDir+path.sep))throw new Error(`Source path escapes supplied directory: ${row.id}`);
  const raw=await fs.readFile(sourcePath),source=load(raw.toString(),{xml:true});
  const affected=source('image').toArray().filter(element=>/^data:;base64,/i.test(href(source,element)));
  if(!affected.length)continue;
  const media=JSON.parse(row.media),blocks=JSON.parse(row.blocks),rawHash=hash(raw);
  const sourceIdentity=hash(JSON.stringify({rawHash,blocks,media}));
  if(sourceIdentity!==row.source_hash)throw new Error(`Source identity differs from catalog: ${row.id}`);
  if(media.length!==1||media[0].mime!=='image/svg+xml'||!/^\/media\/[a-f0-9]{64}\.svg$/.test(media[0].url))throw new Error(`Unexpected SVG catalog layout: ${row.id}`);
  const original=media[0],oldBytes=await fs.readFile(path.join(dataDir,original.url.slice(1))),old=load(oldBytes.toString(),{xml:true});
  if(original.url!==`/media/${hash(oldBytes)}.svg`)throw new Error(`Catalog asset hash mismatch: ${row.id}`);
  const sanitized=await sanitizeSvg(raw.toString()),repaired=load(sanitized,{xml:true});
  if(JSON.stringify(geometry(source,source('svg')[0]))!==JSON.stringify(geometry(repaired,repaired('svg')[0])))throw new Error(`Root SVG geometry changed: ${row.id}`);
  const images=[];
  for(const element of affected){
   const id=source(element).attr('id');
   const matches=repaired('image').toArray().filter(item=>repaired(item).attr('id')===id);
   if(!id||matches.length!==1)throw new Error(`Ambiguous restored image identity: ${row.id}`);
   const replacement=matches[0],before=Buffer.from(href(source,element).split(',')[1],'base64'),uri=href(repaired,replacement);
   if(!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(uri))throw new Error(`Raster normalization failed: ${row.id}/${id}`);
   const after=Buffer.from(uri.split(',')[1],'base64');
   if(!before.equals(after))throw new Error(`Embedded raster bytes changed: ${row.id}/${id}`);
   if(JSON.stringify(geometry(source,element))!==JSON.stringify(geometry(repaired,replacement)))throw new Error(`Embedded image geometry changed: ${row.id}/${id}`);
   const decoded=await sharp(after,{limitInputPixels:150000000,failOn:'warning'}).metadata();
   images.push({id,bytes:after.length,sha256:hash(after),mime:uri.slice(5,uri.indexOf(';')),width:decoded.width,height:decoded.height,exactBytes:true,geometryUnchanged:true});
  }
  const sourceImageCount=embeddedImages(source).length,repairedImageCount=embeddedImages(repaired).length;
  if(sourceImageCount!==repairedImageCount)throw new Error(`Embedded image count differs: ${row.id}`);
  const asset=await saveAsset(Buffer.from(sanitized),'image/svg+xml',dataDir);
  if(asset.url!==`/media/${hash(sanitized)}.svg`)throw new Error(`Sanitization is not idempotent: ${row.id}`);
  if(asset.width!==original.width||asset.height!==original.height)throw new Error(`Catalog geometry differs: ${row.id}`);
  proposal.assets[original.url]={...asset,sourceWidth:original.width,sourceHeight:original.height,sourceKind:'svg-embedded-raster-repair',sourceDocumentId:row.id,sourceHash:row.source_hash};
  const record={documentId:row.id,sourcePath:row.source_path,sourceHash:row.source_hash,rawHash,sourceHashMatches:true,originalUrl:original.url,repairedUrl:asset.url,sourceEmbeddedImageCount:sourceImageCount,previouslyServedEmbeddedImageCount:embeddedImages(old).length,repairedEmbeddedImageCount:repairedImageCount,width:asset.width,height:asset.height,dimensionsUnchanged:true,images};
  if(['wiring-151-006','wiring-151-026'].includes(row.id)){
   record.previews={before:path.join(previewDir,`${row.id}-before.png`),after:path.join(previewDir,`${row.id}-restored.png`)};
   await sharp(oldBytes,{density:144,limitInputPixels:150000000}).flatten({background:'white'}).png().toFile(record.previews.before);
   await sharp(Buffer.from(sanitized),{density:144,limitInputPixels:150000000}).flatten({background:'white'}).png().toFile(record.previews.after);
  }
  proposal.audit.documents.push(record);proposal.audit.affectedDocuments++;proposal.audit.restoredEmbeddedImages+=images.length;
 }
 await fs.mkdir(path.dirname(output),{recursive:true});
 await fs.writeFile(output+'.tmp',JSON.stringify(proposal,null,2));await fs.rename(output+'.tmp',output);
 return proposal;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
 const output=option('--output','work/media-quality-svg-repairs.json');
 const result=await proposeSvgRepairs({sourceDir:option('--source'),dataDir:option('--data','data'),output,previewDir:option('--previews','work/svg-repair-previews')});
 console.log(JSON.stringify({output,scanned:result.audit.scannedDocuments,affected:result.audit.affectedDocuments,restoredImages:result.audit.restoredEmbeddedImages,assets:Object.keys(result.assets).length,previews:result.audit.documents.flatMap(item=>item.previews?[item.previews]:[])}));
}

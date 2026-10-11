import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { openDb, setMeta } from '../server/db.mjs';
import { parsePdfReference } from '../server/pdf-reference.mjs';
import { parseHtml, parseWiring, tocCatalog, hash } from '../server/parser.mjs';
const arg=name=>process.argv[process.argv.indexOf(name)+1];
export async function ingest({sourceDir,dataDir}){
 await fsp.mkdir(dataDir,{recursive:true});await fsp.mkdir(path.join(dataDir,'source'),{recursive:true});
 const toc=tocCatalog(JSON.parse(await fsp.readFile(path.join(sourceDir,'toc.json'),'utf8')));const byPath=new Map(toc.map(row=>[row.path,row]));
 const files=fs.readdirSync(sourceDir,{recursive:true}).filter(p=>/\.(html|svg|pdf)$/.test(p)).sort();
 const entries=files.filter(p=>(p.endsWith('.html')&&!['cover.html','index.html'].includes(p))||p.endsWith('.svg')||p.endsWith('.pdf')&&!files.includes(p.replace(/\.pdf$/,'.html'))&&!files.includes(p.replace(/\.pdf$/,'.svg')));
 const db=openDb({dataDir});const manifest={version:1,startedAt:new Date().toISOString(),expected:entries.length,status:'processing',documents:[],errors:[],warnings:[],counts:{documents:0,workshop:0,wiring:0,connectors:0,media:0,sourceImages:0,pdfs:0}};
 const abbreviations=new Map();const seen=new Set();
 const save=db.prepare('INSERT OR REPLACE INTO documents(id,title,system_id,section_code,section_title,kind,engines,summary,source_hash,blocks,media,related,source,text,pdf_file,source_path) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const relativePath of entries){try{
  const ext=path.extname(relativePath);const stem=relativePath.slice(0,-ext.length);const tocEntry=byPath.get(stem);let id=tocEntry?.id;
  if(id&&seen.has(id))id += '-'+hash(relativePath).slice(0,8);
  const raw=await fsp.readFile(path.join(sourceDir,relativePath));let doc;
  if(ext==='.svg'){
   const $=load(raw.toString(),{xml:true});id=`wiring-${$('CellNumber').text().padStart(3,'0')}-${String(Number($('PageNumber').text())||Number(path.basename(stem))).padStart(3,'0')}`;
   doc=await parseWiring(raw.toString(),{id,relativePath,dataDir});
  }else if(ext==='.html'){
   if(relativePath.includes('Connector Views/')){const match=path.basename(stem).match(/ - ([A-Z0-9_-]+)$/);id=`connector-${match?.[1]||hash(relativePath).slice(0,12)}`;}
   id ||= `reference-${hash(relativePath).slice(0,12)}`;
   doc=await parseHtml(raw.toString(),{id,relativePath,dataDir,title:tocEntry?.title});
  }else{
   id ||= `reference-${hash(relativePath).slice(0,12)}`;
   const title=tocEntry?.title||path.basename(stem);
   doc=await parsePdfReference(raw,{id,title,dataDir,reference:tocEntry?.reference||id});
  }
  doc.sourceHash=hash(JSON.stringify({rawHash:doc.sourceHash,blocks:doc.blocks,media:doc.media}));
  if(seen.has(id))throw new Error(`Duplicate canonical id ${id}`);seen.add(id);
  const pdfSource=path.join(sourceDir,stem+'.pdf');let pdfFile=null;
  if(fs.existsSync(pdfSource)){pdfFile=id+'.pdf';await fsp.copyFile(pdfSource,path.join(dataDir,'source',pdfFile));doc.source.pdfUrl=`/source/${encodeURIComponent(id)}.pdf`;manifest.counts.pdfs++;}
  db.exec('BEGIN');try{save.run(id,doc.title,doc.systemId,doc.section.code,doc.section.title,doc.kind,JSON.stringify(doc.engines),doc.summary,doc.sourceHash,JSON.stringify(doc.blocks),JSON.stringify(doc.media),JSON.stringify(doc.related),JSON.stringify(doc.source),doc.text,pdfFile,relativePath);db.prepare('DELETE FROM document_search WHERE id=?').run(id);db.prepare('INSERT INTO document_search(id,title,section,text) VALUES(?,?,?,?)').run(id,doc.title,doc.section.title,doc.text);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  manifest.documents.push({id,path:relativePath,title:doc.title,kind:doc.kind,systemId:doc.systemId,sourceHash:doc.sourceHash,reference:doc.source.reference,blocks:doc.blocks.length,media:doc.media.length,pdf:!!pdfFile});
  manifest.counts.documents++;manifest.counts[doc.kind==='wiring'?'wiring':doc.kind==='connector'?'connectors':'workshop']++;manifest.counts.media+=doc.media.length;manifest.counts.sourceImages+=doc.sourceImageCount;
  for(const a of doc.abbreviations){const key=a.name.toLowerCase()+'|'+a.definition.toLowerCase();if(!abbreviations.has(key))abbreviations.set(key,{...a,documentIds:[]});const a2=abbreviations.get(key);if(a2.documentIds.length<20&&!a2.documentIds.includes(id))a2.documentIds.push(id);}
  manifest.warnings.push(...doc.warnings.map(w=>({documentId:id,...w})));
  if(manifest.counts.documents%50===0){setMeta(db,'ingestion',manifest.counts);process.stdout.write(JSON.stringify({processed:manifest.counts.documents,total:entries.length,media:manifest.counts.media})+'\n');await fsp.writeFile(path.join(dataDir,'catalog-manifest.json'),JSON.stringify(manifest,null,2));}
 }catch(error){manifest.errors.push({path:relativePath,error:error.message});process.stderr.write(`Ingest error ${relativePath}: ${error.message}\n`);}}
 manifest.status=manifest.errors.length?'incomplete':'complete';manifest.finishedAt=new Date().toISOString();
 setMeta(db,'ingestion',{...manifest.counts,expected:entries.length,status:manifest.status,errors:manifest.errors.length});setMeta(db,'abbreviations',[...abbreviations.values()]);
 await fsp.writeFile(path.join(dataDir,'catalog-manifest.json'),JSON.stringify(manifest,null,2));await fsp.writeFile(path.join(dataDir,'abbreviations.json'),JSON.stringify([...abbreviations.values()],null,2));db.close();return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sourceDir=arg('--source'),dataDir=arg('--data')||path.resolve('data');if(!sourceDir||sourceDir.startsWith('--'))throw new Error('Usage: node scripts/ingest.mjs --source /path/to/manual [--data data]');
 const manifest=await ingest({sourceDir:path.resolve(sourceDir),dataDir:path.resolve(dataDir)});console.log(JSON.stringify({status:manifest.status,counts:manifest.counts,errors:manifest.errors.length,warnings:manifest.warnings.length}));if(manifest.errors.length)process.exitCode=1;
}

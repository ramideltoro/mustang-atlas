import fs from 'node:fs';
import path from 'node:path';
import {openDb,DEFAULT_DATA_DIR} from '../server/db.mjs';
const dataDir=process.env.DATA_DIR||DEFAULT_DATA_DIR;const db=openDb({dataDir,readOnly:true});const manifest=JSON.parse(fs.readFileSync(path.join(dataDir,'catalog-manifest.json')));const problems=[];let documents=0,placements=0,pdfs=0;const unique=new Set();
function walk(blocks,ids=[],media=[]){for(const b of blocks){ids.push(b.id);if(b.mediaId)media.push(b.mediaId);walk(b.children||[],ids,media);walk(b.items||[],ids,media);for(const r of b.rows||[])for(const c of r.cells||[])walk(c.blocks||[],ids,media);}return {ids,media};}
for(const row of db.prepare('SELECT * FROM documents').iterate()){
 documents++;const assets=JSON.parse(row.media);const blocks=walk(JSON.parse(row.blocks));if(new Set(blocks.ids).size!==blocks.ids.length)problems.push(row.id+': duplicate block id');
 const expected=assets.map(m=>m.id).sort();if(JSON.stringify(blocks.media.toSorted())!==JSON.stringify(expected))problems.push(row.id+': media placement mismatch');
 for(const asset of assets){if(!/^\/media\/[a-f0-9]{64}\.(png|jpg|gif|webp|svg)$/.test(asset.url))problems.push(row.id+': invalid media URL');else{const file=path.join(dataDir,asset.url);if(!fs.existsSync(file))problems.push(row.id+': missing media file');unique.add(asset.url);}}placements+=assets.length;
 if(row.pdf_file){pdfs++;const file=path.join(dataDir,'source',row.pdf_file);if(!fs.existsSync(file)||fs.readFileSync(file).subarray(0,5).toString()!=='%PDF-')problems.push(row.id+': missing or invalid PDF');}
}
if(documents!==manifest.documents.length)problems.push('Manifest document count differs from catalog');if(documents!==manifest.expected)problems.push('Incomplete corpus');if(manifest.errors.length)problems.push(...manifest.errors.map(e=>e.error));
console.log(JSON.stringify({documents,pdfs,mediaPlacements:placements,uniqueMedia:unique.size,expectedDocuments:manifest.expected,problems},null,2));db.close();if(problems.length)process.exitCode=1;

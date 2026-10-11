import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {documentApplicability,isPublicDocument,engineFilter,selectThumbnail,stripPrivateMetadata} from '../server/catalog.mjs';
import {createReferenceResolver,neutralCopy} from '../server/article-references.mjs';
import {openDb} from '../server/db.mjs';
import {createApp} from '../server/index.mjs';
const row=(id,title,phase,extra={})=>({id,title,section_code:'307-01',section_title:'Automatic Transmission — 6R80',engines:'[]',related:'[]',source:'{}',kind:phase==='Description and Operation'?'overview':'repair',source_path:`307-01/${phase}/${title}.html`,...extra});
test('applicability uses article metadata without importing engine mentions from referrals or prose',()=>{
 assert.deepEqual(documentApplicability({title:'Oil pan',section_title:'Engine - 5.2L',engines:'[]',text:'Refer to Engine 3.7L.'},'3.7L').engines,['5.2L']);
 assert.equal(documentApplicability({title:'Transmission',section_title:'6R80',engines:'[]',text:'Refer to 5.0L removal.'},'2.3L').matchesSelectedEngine,true);
 assert.equal(documentApplicability({title:'Shared service',engines:'["3.7L","5.0L"]'},'5.2L').matchesSelectedEngine,false);
 assert.equal(engineFilter('all'),'all');assert.equal(engineFilter('5.2l'),'5.2L');assert.throws(()=>engineFilter('V8'));
});
test('transmission-specific sections follow documented applications without narrowing the shared clutch chapters',()=>{
 for(const [section_code,section_title]of [['307-01','Automatic Transmission - 6R80'],['308-03A','Manual Transmission - MT82'],['308-06A','Manual Transmission External Controls - MT82']])assert.deepEqual(documentApplicability({title:'Overview',section_code,section_title}).engines,['2.3L','3.7L','5.0L']);
 assert.deepEqual(documentApplicability({title:'Transmission',section_code:'308-03B',section_title:'Manual Transmission - 3160'}).engines,['5.2L']);
 assert.deepEqual(documentApplicability({title:'Clutch overview',section_code:'308-01',section_title:'Clutch - MT82'}).engines,[]);
 assert.deepEqual(documentApplicability({title:'Clutch Disc - 5.2L',section_code:'308-01',section_title:'Clutch - MT82'}).engines,['5.2L']);
});
test('exporter-only manual overviews cannot become public reference destinations',()=>{
 assert.equal(isPublicDocument({title:'About this Manual'}),false);assert.equal(isPublicDocument({title:'Manual Transmission - Overview'}),true);
 const origin=row('G0','Seal','Removal');const hidden=row('G1693180','About this Manual','Description and Operation');const r=createReferenceResolver([origin,hidden]);assert.equal(r.byId(hidden.id,origin),null);assert.equal(r.resolve(hidden.title,'',origin),null);assert.equal(r.cleanObject('[About this Manual](#/document/G1693180)'),'About this reference');
});
test('references distinguish an overview from same-named repair articles and collapse empty duplicate headings',()=>{
 const origin=row('G1686450','Direct Clutch Assembly','Diagnosis and Testing',{kind:'diagnosis',related:'["G1686434","G2","G3"]'});
 const resolver=createReferenceResolver([origin,row('G1686434','Direct Clutch Assembly','Description and Operation'),row('G2','Valve Body','Overhaul'),row('G3','Valve Body','Removal and Installation')]);
 const blocks=resolver.blocks([{id:'h1',type:'heading',level:2,text:'Direct Clutch'},{id:'p',type:'paragraph',text:'For direct (3,5,R) clutch operation,\nREFER to: Direct Clutch Assembly (307-01 Automatic Transmission - 6R80, Description and Operation).'},{id:'h2',type:'heading',level:2,text:'Direct Clutch'},{id:'t',type:'table',rows:[{cells:[{text:'Remove 2 bolts. REFER to: Valve Body (307-01 Automatic Transmission - 6R80, Removal and Installation).',blocks:[]}]}]}],origin);
 assert.deepEqual(blocks.filter(b=>b.type==='heading').map(b=>b.id),['h2']);assert.match(blocks[0].text,/direct \(3,5,R\).*\]\(#\/document\/G1686434\)/);assert.doesNotMatch(blocks[0].text,/REFER/);assert.match(blocks.at(-1).rows[0].cells[0].text,/Remove 2 bolts.*#\/document\/G3/);
 const text=resolver.cleanText('WARNING: Support the transmission.\nREFER to: Missing article (307-01 Transmission, Overhaul).',origin).text;assert.equal(text,'WARNING: Support the transmission.');
 assert.equal(resolver.cleanText('Remove 2 bolts. REFER to: Missing article. Tighten to 40 Nm.',origin).text,'Remove 2 bolts.  Tighten to 40 Nm.');
 assert.equal(resolver.cleanText('For further information,\nREFER to: Missing article (307-01 Transmission, Overhaul).',origin).text,'');
 assert.deepEqual(resolver.blocks([{id:'h',type:'heading',level:3,text:'Required pressure: 20 kPa'}],origin),[{id:'h',type:'heading',level:3,text:'Required pressure: 20 kPa'}]);
});
test('reference candidates cannot cross engine variants or resolve ambiguous same-name operations arbitrarily',()=>{
 const origin=row('G0','Seal','Removal',{section_code:'303-01B',section_title:'Engine - 3.7L',engines:'["3.7L"]'});
 const resolver=createReferenceResolver([origin,row('G1','Oil Pump','Removal',{section_code:'303-01B',engines:'["5.0L"]'}),row('G2','Cover','Removal',{section_code:'303-01B'}),row('G3','Cover','Installation',{section_code:'303-01B'})]);
 assert.equal(resolver.resolve('Oil Pump','303-01B, Removal',origin),null);assert.equal(resolver.resolve('Cover','303-01B',origin),null);
});
test('thumbnails use substantive media placed in the same article and preserve quality upgrades',()=>{
 const doc={id:'G1',kind:'repair',media:[{id:'icon',url:'/media/icon.png',width:99,height:99},{id:'diagram',url:'/media/a.jpg',width:580,height:400},{id:'unplaced',url:'/media/other.jpg',width:2000,height:1000}],blocks:[{type:'media',mediaId:'icon'},{type:'media',mediaId:'diagram'}]};
 const thumb=selectThumbnail(doc,m=>({...m,url:'/media/native.jpg',width:1900,height:1310}));assert.equal(thumb.id,'diagram');assert.equal(thumb.documentId,'G1');assert.equal(thumb.url,'/media/native.jpg');assert.equal(thumb.kind,'article-illustration');
 assert.equal(selectThumbnail({...doc,blocks:[{type:'media',mediaId:'icon'}]}),null);
 const face={...doc,id:'connector-C1',kind:'connector',media:[{id:'face',url:'/media/face.svg',mime:'image/svg+xml',width:49,height:52}],blocks:[{type:'media',mediaId:'face'}]};assert.equal(selectThumbnail(face).id,'face');assert.equal(selectThumbnail({...face,kind:'repair'}),null);
});
test('public copy removes provenance interfaces while preserving manual-transmission terminology and glossary kinds',()=>{
 assert.equal(neutralCopy('Use the service manual for the manual transmission.'),'Use the repair instructions for the manual transmission.');
 assert.equal(neutralCopy('Install the belt. [Compare the original wording and illustrations](/source/G1.pdf).'),'Install the belt. ');
 assert.equal(neutralCopy('Keep this warning. The original table is retained below so you can compare it with the [source PDF](/source/G1.pdf).'),'Keep this warning. ');
 const result=stripPrivateMetadata({source:{pdfUrl:'/source/G.pdf'},sourceHash:'x',sourceBlocks:[],editorial:{kind:'source-expansion',humanReviewed:false},sourceRefs:[{documentId:'G',pdfUrl:'/source/G.pdf'}]});
 assert.deepEqual(result,{editorial:{kind:'source-expansion'},sourceRefs:[{documentId:'G'}]});
});
test('engine selection stays consistent across search, subsections, related links and glossary references',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-catalog-')),contentDir=path.join(dir,'content');await fs.mkdir(contentDir);const db=openDb({dataDir:dir});
 for(const[id,engine]of[['G1','3.7L'],['G2','5.2L'],['G3',null]]){
  const blocks=[{id:id+'-b1',type:'paragraph',text:'Use the service manual to inspect the pump.'}];
  db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'Pump','engine','303-01'+(engine||''),engine?'Engine - '+engine:'Shared checks','repair','[]','Pump service','hash',JSON.stringify(blocks),'[]','["G1","G2","G3"]',JSON.stringify({reference:id,pdfUrl:'/source/'+id+'.pdf'}),'Pump repair',id+'.pdf','Engine/Removal/Pump.html');db.prepare('INSERT INTO document_search VALUES(?,?,?,?)').run(id,'Pump','Engine','Pump repair');
 }
 db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('G1693180','About this Manual','engine','100-00','General Information','overview','[]','About this Manual','hash','[]','[]','[]','{}','Pump information','hidden.pdf','General/About.html');db.prepare('INSERT INTO document_search VALUES(?,?,?,?)').run('G1693180','About this Manual','General','Pump information');
 await fs.writeFile(path.join(contentDir,'glossary.json'),JSON.stringify({terms:[{id:'pump',name:'Pump',definition:'See the service manual.',sourceRefs:[{documentId:'G1'},{documentId:'G2'}]}]}));
 const app=createApp({dataDir:dir,contentDir,db});const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
 try{
  const list=await(await fetch(base+'/api/v1/documents?q=pump&engine=3.7L')).json();assert.deepEqual(list.items.map(i=>i.id),['G1','G3']);
  assert.equal((await(await fetch(base+'/api/v1/stats')).json()).documents,3);assert.equal((await fetch(base+'/api/v1/documents/G1693180')).status,404);assert.equal((await fetch(base+'/api/v1/documents/G1693180/parts')).status,404);
  const systems=await(await fetch(base+'/api/v1/systems?engine=3.7L')).json();const engine=systems.items.find(s=>s.id==='engine');assert.equal(engine.documentCount,2);assert.equal(engine.sections.reduce((n,s)=>n+s.count,0),2);assert.ok(!engine.sections.some(s=>s.title.includes('5.2L')));
  const detail=await(await fetch(base+'/api/v1/documents/G3?engine=3.7L&source=1')).json();assert.deepEqual(detail.related.map(r=>r.id),['G1']);assert.ok(!detail.source&&!detail.sourceBlocks&&!detail.sourceHash);assert.doesNotMatch(JSON.stringify(detail),/service manual|\/source\//i);
  const mismatch=await(await fetch(base+'/api/v1/documents/G2?engine=3.7L')).json();assert.equal(mismatch.applicability.matchesSelectedEngine,false);
  const allBefore=await(await fetch(base+'/api/v1/documents/G3?engine=all')).json();
  await fetch(base+'/api/v1/documents/G3?engine=3.7L');
  const allAfter=await(await fetch(base+'/api/v1/documents/G3?engine=all')).json();assert.deepEqual(allAfter.related,allBefore.related);assert.deepEqual(allAfter.parts,allBefore.parts);
  const term=await(await fetch(base+'/api/v1/glossary/pump?engine=3.7L')).json();assert.deepEqual(term.sourceRefs.map(r=>r.documentId),['G1']);assert.equal(term.definition,'See the repair instructions.');assert.equal((await fetch(base+'/source/G1.pdf')).status,404);
 }finally{await new Promise(r=>server.close(r));db.close();await fs.rm(dir,{recursive:true,force:true});}
});

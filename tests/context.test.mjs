import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {openDb} from '../server/db.mjs';
import {createApp} from '../server/index.mjs';
import {createLearningContextCatalog} from '../server/learning-context.mjs';

const hash='a'.repeat(64);
const topic={id:'steering-column-controls',title:'How the steering column controls connect',summary:'The steering column control module connects the steering wheel controls to the vehicle.',sections:[{id:'role',title:'What this connector does',body:'C226A is a connector for the steering column control module. Its pin drawing identifies the terminals used by the listed circuits.'}],relatedTermIds:['steering-column'],sourceDocumentIds:['G1']};
function content(){return {version:1,topics:[structuredClone(topic)],documents:{'connector-C226A':{topicId:topic.id,sourceHash:hash,summary:'C226A connects the steering column control module to the listed vehicle circuits.'},G1:{topicId:topic.id,sourceHash:hash}}};}
async function fixture(){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-context-')),contentDir=path.join(dir,'content');
  await fs.mkdir(contentDir);const db=openDb({dataDir:dir});
  for(const [id,title,kind] of [['connector-C226A','C226A','connector'],['G1','Steering column control module','overview']]){
    const blocks=[{id:id+'-b1',type:'paragraph',text:'Inspect the connector.'}];
    db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,title,'steering','211-05','Steering Wheel and Column Electrical Components',kind,'[]','Exporter labels',''+hash,JSON.stringify(blocks),'[]','[]',JSON.stringify({reference:id,pdfUrl:null}),'Inspect the connector.',null,'private/'+id+'.html');
    db.prepare('INSERT INTO document_search VALUES(?,?,?,?)').run(id,title,'Steering','Inspect the connector.');
  }
  await fs.writeFile(path.join(contentDir,'glossary.json'),JSON.stringify({terms:[{id:'steering-column',name:'Steering column',definition:'Supports the steering wheel.'}],abbreviations:[{name:'SCCM',ambiguous:false,variants:[{expansion:'Steering column control module'}]}]}));
  const save=async value=>{const file=path.join(contentDir,'topic-contexts.json');await fs.writeFile(file+'.tmp',JSON.stringify(value));await fs.rename(file+'.tmp',file);};
  const cleanup=async()=>{db.close();await fs.rm(dir,{recursive:true,force:true});};
  return {dir,contentDir,db,save,cleanup};
}

test('context catalog binds each document to its source and resolves exact source and glossary references',async()=>{
  const f=await fixture();try{
    await f.save(content());const catalog=createLearningContextCatalog(f.db,{contentDir:f.contentDir});
    const context=catalog.get({id:'connector-C226A',sourceHash:hash});
    assert.equal(context.status,'complete');assert.equal(context.version,1);
    assert.match(context.summary,/C226A connects/);assert.equal(catalog.get('G1').summary,topic.summary);
    assert.deepEqual(context.sourceRefs,[{documentId:'G1',title:'Steering column control module',kind:'overview'}]);
    assert.deepEqual(context.relatedTerms,[{id:'steering-column',name:'Steering column'}]);
    assert.ok(!JSON.stringify(context).includes('private/'));
    assert.equal(catalog.get({id:'connector-C226A',sourceHash:'old'}),null);
    context.sections[0].body='Mutation';assert.notEqual(catalog.get('connector-C226A').sections[0].body,'Mutation');
    assert.deepEqual(catalog.stats(),{contextualizedDocuments:2,contextualizationStatus:'complete'});
    assert.deepEqual(catalog.report().missingDocumentIds,[]);assert.deepEqual(catalog.report().errors,[]);
    const next=content();next.topics[0].relatedTermIds=['abbr-'+Buffer.from('SCCM').toString('hex')];await f.save(next);
    assert.equal(catalog.get('G1').relatedTerms[0].name,'SCCM');
  }finally{await f.cleanup();}
});

test('context rejects stale hashes, unknown evidence, ambiguous IDs and unsafe or oversized text without suppressing the source API',async()=>{
  const f=await fixture();try{
    const catalog=createLearningContextCatalog(f.db,{contentDir:f.contentDir});
    assert.equal(catalog.get('G1'),null);assert.equal(catalog.stats().contextualizedDocuments,0);
    const stale=content();stale.documents['connector-C226A'].sourceHash='old';await f.save(stale);
    assert.equal(catalog.get('connector-C226A'),null);assert.equal(catalog.stats().contextualizedDocuments,1);
    assert.ok(catalog.report().errors.some(e=>e.reason==='stale-source-hash'));
    for(const change of [
      c=>c.topics[0].sourceDocumentIds=['missing'],
      c=>c.topics[0].relatedTermIds=['missing'],
      c=>c.topics[0].sections[0].body='<script>alert(1)</script>',
      c=>c.topics[0].summary='Read [more](javascript:alert(1)).',
      c=>c.topics[0].summary='Read https://untrusted.invalid/context',
      c=>c.topics[0].summary='x'.repeat(2001),
      c=>c.topics[0].sections.push({...c.topics[0].sections[0]}),
      c=>c.topics.push({...c.topics[0]}),
      c=>c.topics[0].id='../unsafe',
      c=>c.documents['connector-C226A'].summary='<img src=x onerror=bad()>',
    ]){
      const c=content();change(c);await f.save(c);assert.equal(catalog.get('connector-C226A'),null);assert.ok(catalog.report().errors.length>0);
    }
    await f.save(content());assert.equal(catalog.stats().contextualizedDocuments,2);
    await fs.writeFile(path.join(f.contentDir,'topic-contexts.json'),'{broken');assert.equal(catalog.get('G1'),null);
    await fs.rm(path.join(f.contentDir,'topic-contexts.json'));assert.equal(catalog.get('G1'),null);
  }finally{await f.cleanup();}
});

test('API separates context coverage from rewrites, keeps provenance private and prefers an accepted guide introduction in lists',async()=>{
  const f=await fixture();const app=createApp({dataDir:f.dir,contentDir:f.contentDir,db:f.db});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base=`http://127.0.0.1:${server.address().port}`;
  try{
    let stats=await(await fetch(base+'/api/v1/stats')).json();assert.equal(stats.contextualizedDocuments,0);
    await f.save(content());
    stats=await(await fetch(base+'/api/v1/stats')).json();assert.equal(stats.contextualizedDocuments,2);assert.equal(stats.contextualizationStatus,'complete');assert.equal(stats.rewrittenDocuments,0);assert.equal(stats.teachingStatus,'in_progress');
    const doc=await(await fetch(base+'/api/v1/documents/connector-C226A?source=1')).json();assert.equal(doc.learningStatus,'complete');assert.equal(doc.learningContext.status,'complete');assert.equal(doc.teachingStatus,'source');assert.equal(doc.sourceBlocks,undefined);assert.equal(doc.source,undefined);assert.equal(doc.blocks[0].text,'Inspect the connector.');
    let list=await(await fetch(base+'/api/v1/documents')).json();assert.match(list.items.find(d=>d.id==='connector-C226A').summary,/C226A connects/);
    await fs.mkdir(path.join(f.dir,'guides'));await fs.writeFile(path.join(f.dir,'guides','connector-C226A.json'),JSON.stringify({documentId:'connector-C226A',sourceHash:hash,status:'complete',checks:{passed:true},introduction:'Inspect the connector.',edits:[{blockId:'connector-C226A-b1',text:'Inspect the connector.',why:''}]}));
    list=await(await fetch(base+'/api/v1/documents')).json();assert.equal(list.items.find(d=>d.id==='connector-C226A').summary,'Inspect the connector.');assert.equal(list.items.find(d=>d.id==='connector-C226A').teachingStatus,'complete');
    const invalid=content();invalid.documents['connector-C226A'].sourceHash='stale';await f.save(invalid);
    const fallback=await(await fetch(base+'/api/v1/documents/connector-C226A')).json();assert.equal(fallback.learningStatus,'pending');assert.equal(fallback.learningContext,undefined);assert.equal(fallback.teachingStatus,'complete');
    stats=await(await fetch(base+'/api/v1/stats')).json();assert.equal(stats.contextualizedDocuments,1);assert.equal(stats.contextualizationStatus,'in_progress');
  }finally{await new Promise(resolve=>server.close(resolve));await f.cleanup();}
});

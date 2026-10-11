import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openDb} from '../server/db.mjs';
import {createApp} from '../server/index.mjs';

test('maintenance detail and endpoint share scoped guidance without private evidence fields',async()=>{
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-maintenance-api-'));
 const contentDir=path.join(dataDir,'content');await fs.mkdir(contentDir);
 const db=openDb({dataDir});
 for(const [id,title,engines] of [['G1','Engine Air Filter',['3.7L']],['G2','Front Stabilizer Bar Bushing',[]],['G3','Powertrain Control Module',[]]]){
  db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,title,'engine','303-12','Air intake','repair',JSON.stringify(engines),'Component care','reviewed-hash','[]','[]','[]','{}','Care for this component',null,id+'.html');
  db.prepare('INSERT INTO document_search VALUES(?,?,?,?)').run(id,title,'Air intake','Care for this component');
 }
 const baseRule={id:'air-filter',title:'Air filter care',kind:'scheduled',what:'Replace the filter.',when:'Use the verified interval.',why:'Keep dust out of the engine.',applicability:{years:[2015],engines:['2.3L','3.7L','5.0L']},evidence:['ford-schedule'],sourceRefs:[{documentId:'G1',sourceHash:'reviewed-hash'}],matches:{documentIds:['G1','G2']}};
 await fs.writeFile(path.join(contentDir,'maintenance.json'),JSON.stringify({rules:[baseRule],evidence:{'ford-schedule':{title:'Ford scheduled maintenance',url:'https://www.fordservicecontent.com/maintenance'}}}));
 const app=createApp({db,dataDir,contentDir});const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
 try{
  const detail=await(await fetch(base+'/api/v1/documents/G1?engine=3.7L')).json();
  const endpoint=await(await fetch(base+'/api/v1/documents/G1/maintenance?engine=3.7L')).json();
  assert.deepEqual(detail.maintenance,endpoint.maintenance);assert.equal(endpoint.documentId,'G1');
  assert.deepEqual(endpoint.maintenance.items[0].applicability.engines,['3.7L']);
  assert.doesNotMatch(JSON.stringify(endpoint),/reviewed-hash|sourceHash|sourceRefs/);
  assert.equal((await(await fetch(base+'/api/v1/documents/G1?engine=5.0L')).json()).maintenance,null);
  assert.equal((await(await fetch(base+'/api/v1/documents/G2/maintenance?engine=5.2L')).json()).maintenance,null,'a shared article must not extend a base-engine interval to Shelby');
  assert.deepEqual((await(await fetch(base+'/api/v1/documents/G2/maintenance')).json()).maintenance.items[0].applicability.engines,['2.3L','3.7L','5.0L']);
  assert.equal((await(await fetch(base+'/api/v1/documents/G3/maintenance')).json()).maintenance,null,'no filler section for components without guidance');
  assert.equal((await fetch(base+'/api/v1/documents/missing/maintenance')).status,404);
  assert.equal((await fetch(base+'/api/v1/documents/G1/maintenance?year=garbage')).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();await fs.rm(dataDir,{recursive:true,force:true});}
});

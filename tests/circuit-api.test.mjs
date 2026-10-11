import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openDb} from '../server/db.mjs';
import {createApp} from '../server/index.mjs';

test('circuit API resolves the same context as article detail and respects reviewed engine applicability',async()=>{
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-circuit-api-'));const contentDir=path.join(dataDir,'content');await fs.mkdir(contentDir);await fs.mkdir(path.join(dataDir,'media'));const db=openDb({dataDir});
 const svgFile='a'.repeat(64)+'.svg';await fs.writeFile(path.join(dataDir,'media',svgFile),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="CIRC_CBK03A"><text>CBK03</text><text>BU</text></g><g id="COMP_1~0~Active grille shutter"><text id="CONN_C1651_3">3</text></g></svg>');
 const hash='7de1c56382d2c220ab5cd07a83d5857bd07178510db14f767b5df160dbdc0864';
 for(const [id,kind,blocks,media]of[
  ['wiring-033-002','wiring',[{id:'wiring-033-002-b1',type:'media',mediaId:'diagram'}],[{id:'diagram',url:'/media/'+svgFile,mime:'image/svg+xml',width:100,height:100}]],
  ['connector-C1651','connector',[{id:'connector-C1651-b1',type:'table',rows:[['Cavity','Circuit Number','Function','Color'],['3','CBK03','FUSED POWER','BU']].map(row=>({cells:row.map(text=>({text,blocks:[]}))}))}],[]]
 ]){db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'Active grille shutter','electrical','033','Active grille shutter',kind,'[]','Circuit reference',hash,JSON.stringify(blocks),JSON.stringify(media),'[]','{}','Active grille shutter',null,id+'.svg');db.prepare('INSERT INTO document_search VALUES(?,?,?,?)').run(id,'Active grille shutter','Electrical','Active grille shutter');}
 const app=createApp({db,dataDir,contentDir});const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
 try{
  const detail=await(await fetch(base+'/api/v1/documents/wiring-033-002?engine=2.3L')).json();const circuit=await(await fetch(base+'/api/v1/documents/wiring-033-002/circuit-context?engine=2.3L')).json();assert.equal(circuit.mode,'terminal-map');assert.deepEqual(circuit.circuits,detail.circuitContext.circuits);assert.equal(circuit.circuits[0].id,'CBK03');assert.equal(circuit.circuits[0].terminals[0].documentId,'connector-C1651');assert.deepEqual(circuit.applicability.engines,['2.3L']);assert.equal(circuit.coverage.topologyVerified,false);assert.ok(!circuit.sourceHash);
  const filtered=await(await fetch(base+'/api/v1/documents?engine=5.0L')).json();assert.deepEqual(filtered.items.map(d=>d.id),['connector-C1651']);const mismatch=await(await fetch(base+'/api/v1/documents/wiring-033-002?engine=5.0L')).json();assert.equal(mismatch.applicability.matchesSelectedEngine,false);
  assert.equal((await fetch(base+'/api/v1/documents/connector-C1651/circuit-context')).status,404);assert.equal((await fetch(base+'/api/v1/documents/missing/circuit-context')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();await fs.rm(dataDir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createAssetQualityStore} from '../server/asset-quality.mjs';
import {openDb} from '../server/db.mjs';
import {createApp} from '../server/index.mjs';

const originalUrl = '/media/' + 'a'.repeat(64) + '.jpg';
const nativeUrl = '/media/' + 'b'.repeat(64) + '.jpg';
const media = {id:'G1-m0001',url:originalUrl,mime:'image/jpeg',width:580,height:381,caption:'Original drawing',legend:[{color:'Blue',label:'Target component'}]};
const upgrade = {url:nativeUrl,mime:'image/jpeg',width:1902,height:1250,sourceWidth:580,sourceHeight:381,sourceUrl:'https://private-source.invalid/original'};
const saveMap = (dir,asset=upgrade) => fs.writeFile(path.join(dir,'media-quality.json'),JSON.stringify({version:1,assets:{[originalUrl]:asset}}));

test('asset overrides preserve source identity, reload on file changes, and fail safely for unsafe or missing assets',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-quality-'));
  try{
    await fs.mkdir(path.join(dir,'media'));
    const store=createAssetQualityStore({dataDir:dir});
    assert.equal(store.resolve(media),media);
    await saveMap(dir);
    assert.equal(store.resolve(media),media,'a missing native image keeps the original');
    await fs.writeFile(path.join(dir,nativeUrl.slice(1)),'image fixture');
    const resolved=store.resolve(media);
    assert.equal(resolved.url,nativeUrl);
    assert.equal(resolved.originalUrl,originalUrl);
    assert.equal(resolved.id,media.id);
    assert.equal(resolved.quality,'native-source');
    assert.deepEqual(resolved.legend,media.legend);
    assert.equal(resolved.sourceWidth,580);
    assert.equal(media.url,originalUrl,'resolution never mutates the catalog object');
    assert.ok(!('sourceUrl' in resolved),'private fetch provenance is not exposed');
    for(const change of [{url:'/media/../../credentials.env'},{url:'https://outside.invalid/image.jpg'},{url:'/media/'+ 'b'.repeat(64)+'.jpg?token=secret'},{mime:'text/html'},{width:579},{sourceWidth:400},{height:NaN}]){
      await saveMap(dir,{...upgrade,...change});
      assert.equal(store.resolve(media),media,JSON.stringify(change));
    }
    await saveMap(dir);
    assert.equal(store.resolveAll([media])[0].width,1902,'a valid replacement is picked up without restart');
    await fs.writeFile(path.join(dir,'media-quality.json'),'{broken');
    assert.equal(store.resolve(media),media);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('document and glossary APIs resolve the same native image without changing blocks, accepted guide hash or contextual metadata',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-quality-api-'));
  const content=path.join(dir,'content');
  await fs.mkdir(content);await fs.mkdir(path.join(dir,'media'));await fs.mkdir(path.join(dir,'guides'));
  await fs.writeFile(path.join(dir,nativeUrl.slice(1)),'image fixture');
  const db=openDb({dataDir:dir});
  const blocks=[{id:'G1-b1',type:'paragraph',text:'Remove 2 bolts.'},{id:'G1-b2',type:'media',mediaId:media.id}];
  db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('G1','Drive Pinion','driveline','205-02','Rear Drive Axle/Differential','repair','["5.0L"]','Pinion service','stable-hash',JSON.stringify(blocks),JSON.stringify([media]),'[]','{"reference":"G1","pdfUrl":null}', 'Remove 2 bolts.',null,'private/G1.html');
  await fs.writeFile(path.join(content,'glossary.json'),JSON.stringify({terms:[{id:'pinion',name:'Pinion',definition:'The gear driving the ring gear.',mediaRefs:[{documentId:'G1',mediaId:media.id,caption:'Glossary context'}]}]}));
  await fs.writeFile(path.join(dir,'guides','G1.json'),JSON.stringify({documentId:'G1',sourceHash:'stable-hash',status:'complete',checks:{passed:true},edits:[{blockId:'G1-b1',text:'Take out the 2 bolts.',why:''}]}));
  const app=createApp({dataDir:dir,contentDir:content,db});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const before=await(await fetch(base+'/api/v1/documents/G1')).json();
    assert.equal(before.media[0].url,originalUrl);
    await saveMap(dir);
    const doc=await(await fetch(base+'/api/v1/documents/G1?source=1')).json();
    const term=await(await fetch(base+'/api/v1/glossary/pinion')).json();
    assert.equal(doc.media[0].url,nativeUrl);assert.equal(term.media[0].url,nativeUrl);
    assert.equal(doc.media[0].width,1902);assert.equal(term.media[0].width,1902);
    assert.equal(doc.teachingStatus,'complete');assert.equal(doc.sourceHash,'stable-hash');
    assert.deepEqual(doc.sourceBlocks,blocks);assert.equal(doc.blocks[1].mediaId,media.id);
    assert.equal(doc.media[0].caption,'Original drawing');assert.equal(term.media[0].caption,'Glossary context');
    assert.equal(term.media[0].documentId,'G1');assert.deepEqual(term.media[0].engines,['5.0L']);
    assert.ok(!JSON.stringify(doc).includes('private-source'));assert.ok(!JSON.stringify(term).includes('private-source'));
    assert.equal(JSON.parse(db.prepare('SELECT media FROM documents WHERE id=?').get('G1').media)[0].url,originalUrl);
  }finally{await new Promise(resolve=>server.close(resolve));db.close();await fs.rm(dir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createIllustratedStepCatalog} from '../server/illustrated-steps.mjs';

test('reviewed captions require exact article, blank step and adjacent media identities; authored instructions win', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-caption-'));
 const original = {id:'G1',sourceHash:'exact',blocks:[{id:'step',type:'step',number:3,text:'',children:[]},{id:'picture',type:'media',mediaId:'m1'}],media:[{id:'m1',url:'/media/original.jpg'}]};
 try {
  fs.writeFileSync(path.join(dir,'illustrated-steps.json'),JSON.stringify({documents:[{documentId:'G1',sourceHash:'exact',steps:[{blockId:'step',mediaId:'m1',mediaUrl:'/media/original.jpg',text:'Release the illustrated clip.'}]}]}));
  const catalog=createIllustratedStepCatalog({contentDir:dir});
  const result=catalog.apply(structuredClone(original), original);
  assert.equal(result.blocks[0].text,'Release the illustrated clip.');
  assert.equal(result.blocks[0].number,3);
  assert.deepEqual(result.blocks[1],original.blocks[1]);
  assert.equal(original.blocks[0].text,'');
  for (const changed of [{...original,sourceHash:'changed'},{...original,media:[{id:'m1',url:'/media/changed.jpg'}]},{...original,blocks:[original.blocks[0],{type:'paragraph',text:'Different action'},original.blocks[1]]}]) assert.equal(catalog.apply(structuredClone(changed),changed).blocks[0].text,'');
  const authored=structuredClone(original);authored.blocks[0].text='Accepted authored instruction.';
  assert.equal(catalog.apply(authored,original).blocks[0].text,'Accepted authored instruction.');
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

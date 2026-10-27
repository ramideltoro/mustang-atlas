import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {hasWorkshopSupervision as ready} from '../scripts/editorial-workshop-readiness.mjs';
test('publication requires exact separately approved guide bytes and identity',()=>{
 const guide={id:'a',steps:['one']};
 const guideHash=crypto.createHash('sha256').update(JSON.stringify(guide)).digest('hex');
 const map={a:{approved:true,guideHash}};
 assert.equal(ready(guide,[]),false);
 assert.equal(ready(guide,[{a:{guideHash}}]),false);
 assert.equal(ready(guide,[{},map]),true);
 assert.equal(ready({...guide,steps:['changed']},[map]),false);
 assert.equal(ready({...guide,id:'b'},[map]),false);
});

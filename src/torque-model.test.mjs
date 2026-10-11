import test from 'node:test';import assert from 'node:assert/strict';
import {calculateTorque,uncorrected} from './torque-model.mjs';
test('adapter correction preserves lever-arm direction and mixed units',()=>{
 const common={torque:120,length:12,adapter:4};
 assert.deepEqual(calculateTorque({type:'180degstraight',...common}),{lbft:90,lbin:1080,nm:122});
 assert.deepEqual(calculateTorque({type:'0degstraightwext',...common}),{lbft:180,lbin:2160,nm:244});
 assert.deepEqual(calculateTorque({type:'180degcrow',...common,length:304.8,lengthUnit:'mm'}),{lbft:90,lbin:1080,nm:122});
 assert.throws(()=>calculateTorque({type:'0degstraightwext',...common,adapter:12}),/shorter/);
 assert.throws(()=>calculateTorque({type:'180degstraight',...common,torque:-2}),/positive/);
});
test('half-moon restricts the source calibration combinations',()=>{
 assert.throws(()=>calculateTorque({type:'180degmoonleft',torque:18,length:9.5,brandIndex:1}),/supported/);
 assert.throws(()=>calculateTorque({type:'180degmoonleft',torque:23,length:9.5,brandIndex:0}),/supported/);
 for(const type of ['180degmoonleft','180degmoonright'])for(const torque of [18,23,46])assert.ok(calculateTorque({type,torque,length:14.5,brandIndex:0}).lbft>0);
 for(const type of uncorrected)assert.equal(calculateTorque({type}),null);
});

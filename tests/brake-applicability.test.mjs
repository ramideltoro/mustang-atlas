import test from 'node:test';
import assert from 'node:assert/strict';
import {documentApplicability} from '../server/catalog.mjs';
import {factoryBrakeEngines} from '../server/brake-applicability.mjs';
import {scopeEngines} from '../scripts/workshop-author-plan.mjs';
const row=(title,section_code='206-03',extra={})=>({title,section_code,section_title:section_code==='206-03'?'Front Disc Brake':'Rear Disc Brake',engines:[],...extra});
test('explicit factory front calipers and pads share one engine scope in API and authoring',()=>{
 for(const[n,engines]of [[2,['2.3L','3.7L']],[4,['2.3L','5.0L']],[6,['5.0L']]])for(const part of ['Brake Caliper','Brake Pads']){
  const d=row(`${part} - Vehicles With: ${n}-Piston Brake Caliper`);
  assert.deepEqual(documentApplicability(d).engines,engines);assert.deepEqual(scopeEngines(d),engines);
  for(const e of ['2.3L','3.7L','5.0L','5.2L'])assert.equal(documentApplicability(d,e).matchesSelectedEngine,engines.includes(e));
 }
});
test('rear counts, shared diagnostics and incidental references do not inherit front-package rules',()=>{
 for(const d of [row('Brake Caliper - Vehicles With: 4-Piston Brake Caliper','206-04'),row('Front Disc Brake'),row('Brake Pads','206-03',{text:'Refer to: Vehicles With: 6-Piston Brake Caliper'}),row('Brake Caliper - Vehicles With: 4-Piston Brake Caliper','206-00')])assert.deepEqual(factoryBrakeEngines(d),[]);
 assert.deepEqual(documentApplicability(row('Front Disc Brake')).engines,[]);
 const rear=row('Brake Caliper - Vehicles With: SVT Performance Package','206-04');assert.deepEqual(documentApplicability(rear).engines,['5.2L']);assert.deepEqual(scopeEngines(rear),['5.2L']);
});
test('reviewed base brake procedures require their exact source identity and retain narrower two-piston anchor scope',()=>{
 const d=row('Brake Disc','206-03',{id:'G1693784',source_hash:'9249ad74482b718dd4a5dd6df7a2f5883b829920530621d8e4bd2f1c1b39a375'});
 assert.deepEqual(documentApplicability(d).engines,['2.3L','3.7L','5.0L']);assert.deepEqual(scopeEngines(d),['2.3L','3.7L','5.0L']);assert.equal(documentApplicability(d,'5.2L').matchesSelectedEngine,false);
 assert.deepEqual(documentApplicability({...d,source_hash:'changed'}).engines,[]);assert.deepEqual(documentApplicability({...d,id:'unreviewed'}).engines,[]);
 assert.deepEqual(factoryBrakeEngines(row('Brake Caliper Anchor Plate','206-03',{id:'G1693782',sourceHash:'a2e2d71958c3640f11598ec511b30d29824af074f530461d556296db137525f8'})),['2.3L','3.7L']);
});
test('caliper-lever parking cable work excludes the separate SVT shoe mechanism',()=>{
 for(const[id,hash]of [['G1693766','410254a1c802fdd37039dcd58279738294ca4addc027f71d57605deb3901cfc6'],['G1694515','433cf243530c97af0172233162e999c7dad493c911f2bb9aeef66e79e7bd5c7a'],['G1694516','c040cbee9cf70d59aab23e55556d86e108cb3a742053a5864eb7fec7ff6ee2c0']]){
  const d=row('Parking Brake Cable','206-05',{id,source_hash:hash});
  assert.deepEqual(scopeEngines(d),['2.3L','3.7L','5.0L']);assert.equal(documentApplicability(d,'5.2L').matchesSelectedEngine,false);assert.deepEqual(factoryBrakeEngines({...d,source_hash:'changed'}),[]);
 }
 const svt=row('Parking Brake Cable Adjustment - Vehicles With: SVT Performance Package','206-05');assert.deepEqual(scopeEngines(svt),['5.2L']);
 assert.deepEqual(factoryBrakeEngines(row('Parking Brake Control','206-05')),[]);
});

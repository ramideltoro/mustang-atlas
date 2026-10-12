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

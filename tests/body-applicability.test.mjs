import test from 'node:test';
import assert from 'node:assert/strict';
import {documentApplicability} from '../server/catalog.mjs';
import {scopeEngines} from '../scripts/workshop-author-plan.mjs';
const base=['2.3L','3.7L','5.0L'];
test('convertible-only workshop, connector and circuit metadata excludes factory Shelby',()=>{
 for(const row of [
  {title:'Convertible Top Motor',section_title:'Convertible Top'},
  {title:'Tonneau Cover Sensor',section_title:'Convertible Top'},
  {title:'Loadspace Trim Panel - Convertible',section_title:'Interior Trim and Ornamentation'},
  {title:'Rear Seatbelt Retractor - Convertible',section_title:'Seatbelt Systems'},
  {title:'High Mounted Stoplamp - Convertible'},
  {title:'Pinpoint Test - DTC: AN, Convertible'},
  {title:'C4830 — CONVERTIBLE TOP MOTOR 1',kind:'connector'},
  {title:'Convertible Top — diagram 1',section_title:'Convertible Top',kind:'wiring'},
 ]){assert.deepEqual(documentApplicability(row).engines,base);assert.equal(documentApplicability(row,'5.2L').matchesSelectedEngine,false);for(const e of base)assert.equal(documentApplicability(row,e).matchesSelectedEngine,true);}
});
test('reviewed generic speaker titles retain exact convertible source scope in API and authoring',()=>{
 for(const[id,source_hash]of [
  ['G1694055','7dca6aa392209b0dad45f1a69e14d2d7b28e90ce7fdfc7b24b45bacfbf9211e5'],
  ['G1693903','7d0e1aa3a8e989bd1df222dbf8f4bc257359c7fa54c50429a8da1ff327462ac9'],
 ]){
  const row={id,source_hash,title:'Rear Quarter Panel Speaker',section_title:'Information and Entertainment System'};
  assert.deepEqual(documentApplicability(row).engines,base);
  assert.deepEqual(scopeEngines(row),base);
  assert.equal(documentApplicability(row,'5.2L').matchesSelectedEngine,false);
  assert.equal(documentApplicability({...row,source_hash:'changed'},'5.2L').matchesSelectedEngine,true);
 }
 assert.equal(documentApplicability({title:'Front Door Speaker',text:'Refer to convertible trim.'},'5.2L').matchesSelectedEngine,true);
});
test('mixed body and incidental references stay shared; explicit compatible engine remains narrow',()=>{
 for(const row of [
  {title:'Body trim - Coupe or Convertible'},
  {title:'Front Seat',text:'Remove convertible trim; coupe differs.',related:[{title:'Convertible Top'}]},
  {title:'Catalytic Converter'},
  {title:'Torque Converter'},
  {title:'Rear Seatbelt Retractor - Coupe'},
 ])assert.equal(documentApplicability(row,'5.2L').matchesSelectedEngine,true);
 assert.deepEqual(documentApplicability({title:'Convertible component - 5.0L'}).engines,['5.0L']);
 assert.equal(documentApplicability({title:'Convertible component - 5.2L'},'5.2L').matchesSelectedEngine,false);
});

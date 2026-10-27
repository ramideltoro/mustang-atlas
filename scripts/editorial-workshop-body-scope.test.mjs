import test from 'node:test';import assert from 'node:assert/strict';
import{documentApplicability}from '../server/catalog.mjs';import{reviewedBodyApplications}from '../server/reviewed-body-applications.mjs';
const pairs=[
 ['Fender Splash Shield',['G1693247'],['G1944325']],
 ['Hood',['G1693249'],['G1943335']],
 ['Front Bumper Cover',['G1694220','G1694213'],['G1794166','G1794161']],
 ['Rear Bumper Cover',['G1694221','G1694215'],['G1794167','G1794162']],
 ['Front Bumper',['G1694212'],['G1794160']],
];
for(const[title,standard,svt]of pairs)test(title+': reviewed physical variants do not share engine filters',()=>{
 for(const[id,expected]of[...standard.map(id=>[id,['2.3L','3.7L','5.0L']]),...svt.map(id=>[id,['5.2L']])]){
  const mapping=reviewedBodyApplications[id];assert.ok(mapping,id+' mapping missing');const row={id,title:svt.includes(id)?title+' - Vehicles With: SVT Performance Package':title,section_code:'501-19',section_title:'Body panels',source_hash:mapping.hash,engines:'[]'};
  assert.deepEqual(documentApplicability(row).engines,expected,id);for(const e of ['2.3L','3.7L','5.0L','5.2L'])assert.equal(documentApplicability(row,e).matchesSelectedEngine,expected.includes(e),id+' '+e);
  assert.deepEqual(documentApplicability({...row,source_hash:'different-revision'}).engines,[],id+' must not inherit stale source review');assert.deepEqual(documentApplicability({...row,id:'unreviewed-copy'}).engines,[],id+' must not narrow another article by title alone');
 }
});

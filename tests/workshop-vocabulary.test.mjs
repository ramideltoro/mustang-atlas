import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createTermMatcher}from'../src/content-model.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../content/glossary.json',import.meta.url)));const terms=catalog.terms;
const ids=(text,context)=>createTermMatcher(terms,context)(text).filter(p=>p.term).map(p=>p.term.id);
test('workshop vocabulary recognizes technical concepts within their relevant system',()=>{
 assert.deepEqual(ids('A leak-down test can help explain a low reading.',{system:'engine',title:'Cylinder sealing'}),['cylinder-leak-down-test']);
 assert.deepEqual(ids('Compare fuel trim with other readings.',{system:'engine',title:'Engine diagnosis'}),['fuel-trim']);
 assert.deepEqual(ids('Perform the adaptive learning drive cycle.',{system:'transmission',title:'6R80'}),['adaptive-learning']);
 assert.deepEqual(ids('Measure backlash.',{system:'engine',title:'Balance shaft backlash'}),['gear-backlash']);
 assert.deepEqual(ids('Check bearing preload.',{system:'driveline',title:'Differential'}),['bearing-preload']);
 assert.deepEqual(ids('Use voltage drop to assess the loaded circuit.',{system:'electrical',title:'Wiring'}),['voltage-drop']);
 assert.deepEqual(ids('Inspect the synchronizer.',{system:'transmission',title:'MT82'}),['synchronizer']);
});
test('new vocabulary does not turn generic words or unrelated systems into engine explanations',()=>{
 assert.deepEqual(ids('Inspect the trim and perform a leak-down check.',{system:'body',title:'Roof'}),[]);
 assert.deepEqual(ids('Check preload.',{system:'suspension',title:'Spring'}),[]);
 assert.deepEqual(ids('STFT and ltft',{system:'engine',title:'Diagnosis'}),['fuel-trim']);
 for(const id of ['cylinder-leak-down-test','fuel-trim','adaptive-learning']){const term=terms.find(t=>t.id===id);assert.ok(term.definition.length>30);assert.ok(term.sourceRefs.some(r=>r.documentId));assert.ok(term.relatedTermIds.every(id=>terms.some(t=>t.id===id)));}
});

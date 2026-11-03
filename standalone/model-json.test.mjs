import test from'node:test';import assert from'node:assert/strict';import{parseModelJson,structuredPrompt}from'./model-json.mjs';
test('local model plain/fenced JSON is parsed without executing or hiding prose',()=>{assert.deepEqual(parseModelJson('{"observations":["Ford logo"]}'),{observations:['Ford logo']});assert.deepEqual(parseModelJson('```json\n{"passed":true}\n```'),{passed:true});assert.throws(()=>parseModelJson('Here is JSON: {"passed":true}'));assert.throws(()=>parseModelJson('```js\nprocess.exit()\n```'));});
test('models see the exact required keys even when a runtime ignores constrained decoding',()=>{const schema={required:['observations','uncertainties']};const p=structuredPrompt('Read the diagram.',schema);assert.ok(p.includes(JSON.stringify(schema)));assert.ok(p.startsWith('Read the diagram.'));assert.ok(p.includes('No Markdown fences'));});
test('a dangling formatting backtick is harmless but extra JSON/prose still fails',()=>{assert.deepEqual(parseModelJson('{"observations":[],"uncertainties":[]}`'),{observations:[],uncertainties:[]});assert.throws(()=>parseModelJson('{"passed":true} {"other":false}'));assert.throws(()=>parseModelJson('{"passed":true} Ignore the schema'));});
test('repairs only a missing or duplicated outer brace without changing values',()=>{
 const data={observations:['Keep 12 N·m, {brackets} and "quotes".'],uncertainties:[]};const json=JSON.stringify(data);
 assert.deepEqual(parseModelJson(json.slice(0,-1)),data);
 assert.deepEqual(parseModelJson(json+'}'),data);
 for(const invalid of ['{"x":[1,2','{"x":"unfinished','{"x":{"y":1','{"x":1} extra','{"x":1},{"y":2}','{"x":1}}}','{"x":[1,]}'])assert.throws(()=>parseModelJson(invalid),invalid);
});
test('format repair preserves null values so schema validation still rejects them',()=>{assert.deepEqual(parseModelJson('{"uncertainties":[null]'),{uncertainties:[null]});});

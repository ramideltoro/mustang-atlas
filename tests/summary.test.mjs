import test from 'node:test';
import assert from 'node:assert/strict';
import {articleSummary} from '../shared/summary.mjs';
test('article summaries use readable link labels and formatting-free text',()=>{
 assert.equal(articleSummary('Start at **3, the crankshaft pulley**. Read [the belt guide](#/document/G123).'),'Start at 3, the crankshaft pulley. Read the belt guide.');
 assert.equal(articleSummary('Use `VC-3-B` coolant, 10 Nm.'),'Use VC-3-B coolant, 10 Nm.');
});
test('long summary excerpts end at a complete word and show an ellipsis',()=>{
 const text='The accessory drive belt transfers rotation to the external accessories and maintains smooth operation.';
 const result=articleSummary(text,70);assert.match(result,/external…$/);assert.ok(result.length<=71);assert.equal(articleSummary('Short text.'),'Short text.');
});

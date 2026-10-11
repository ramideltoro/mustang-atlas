import test from 'node:test';
import assert from 'node:assert/strict';
import {hasPartsContent,confirmedParts} from './parts-model.mjs';

test('parts sections and navigation require real content rather than a lookup or placeholder', () => {
 assert.equal(hasPartsContent(null), false);
 assert.equal(hasPartsContent({parts:[], identifiers:[], diagrams:[], catalogLinks:[{url:'https://www.ford.com/parts/'}], fitmentNote:'Unknown'}), false);
 for (const key of ['parts','identifiers','diagrams']) assert.equal(hasPartsContent({[key]:[{id:'available'}]}), false);
 const part={id:'oil-filter',name:'Oil filter',number:'FL-500-S'};
 assert.equal(hasPartsContent({parts:[part]}),true);
 assert.deepEqual(confirmedParts({parts:[{},null,{name:'No number'},part],diagrams:[{id:'diagram'}]}),[part]);
});

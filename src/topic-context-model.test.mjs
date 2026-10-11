import test from 'node:test';
import assert from 'node:assert/strict';
import {topicContextForView,readerEditorialText,contextRelatedTerms,contextReadingLayout} from './topic-context-model.mjs';

test('complete topic context appears only in Atlas reader and leaves document content intact',()=>{
 const context={version:1,title:'A connection to understand',summary:'What this connector does.',sections:[{id:'how',title:'How it works',body:'Signal context.'}],status:'complete'};
 const document={learningContext:context,blocks:[{id:'pin-table',type:'table',rows:[]}],media:[{id:'connector-face'}],introduction:'Earlier introduction'};
 const original=JSON.stringify(document);
 assert.equal(topicContextForView(document),context);assert.equal(topicContextForView(document,'source'),null);
 assert.equal(topicContextForView(null),null);assert.equal(topicContextForView({learningContext:{...context,status:'pending'}}),null);
 assert.equal(topicContextForView({learningContext:{...context,sections:[]}}),null);assert.equal(JSON.stringify(document),original);
});
test('topic introductions do not claim the technical instructions were rewritten',()=>{
 const source=readerEditorialText('source','guide',true);
 assert(source.includes('Plain-language context'));assert(source.includes('retain the original manual wording'));
 assert(!source.includes('Atlas guide'));assert(!source.includes('has not yet been added'));
 assert.equal(readerEditorialText('complete','source',true),'Original manual content, arranged for on-screen reading.');
 assert(readerEditorialText('complete','guide',true).includes('Atlas guide'));
});
test('explicit related terms are deduplicated and preserve stable glossary IDs',()=>{
 const terms=[{id:'module',name:'Control module'},{id:'module',name:'Repeated module'},{id:'circuit',name:'Electrical circuit'},{name:'No target'}];
 assert.deepEqual(contextRelatedTerms(terms),[terms[0],terms[2]]);assert.equal(terms.length,4);
});
test('substantial context and tables use the full reading width while concise sections keep the grid',()=>{
 assert.equal(contextReadingLayout([{body:'A concise explanation.'},{body:'How to use this reference.'}]),false);
 assert.equal(contextReadingLayout([{body:'| Cavity | Circuit | Role |\n| --- | --- | --- |\n| 1 | RRH02 | Horn-switch circuit |'}]),true);
 assert.equal(contextReadingLayout([{body:'Context '.repeat(101)}]),true);
 assert.equal(contextReadingLayout([{body:'A | B is ordinary inline notation.'}]),false);
});

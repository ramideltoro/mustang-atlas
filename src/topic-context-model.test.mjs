import test from 'node:test';
import assert from 'node:assert/strict';
import {topicContextForView,contextRelatedTerms,contextReadingLayout,documentRowSummary,documentExplanationLabel} from './topic-context-model.mjs';

test('complete topic context appears only in Atlas reader and leaves document content intact',()=>{
 const context={version:1,title:'A connection to understand',summary:'What this connector does.',sections:[{id:'how',title:'How it works',body:'Signal context.'}],status:'complete'};
 const document={learningContext:context,blocks:[{id:'pin-table',type:'table',rows:[]}],media:[{id:'connector-face'}],introduction:'Earlier introduction'};
 const original=JSON.stringify(document);
 assert.equal(topicContextForView(document),context);assert.equal(topicContextForView(document,'source'),null);
 assert.equal(topicContextForView(null),null);assert.equal(topicContextForView({learningContext:{...context,status:'pending'}}),null);
 assert.equal(topicContextForView({learningContext:{...context,sections:[]}}),null);assert.equal(JSON.stringify(document),original);
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
test('explained topic search rows favor clear context and distinguish complete guide rewrites',()=>{
 const document={learningStatus:'complete',teachingStatus:'source',summary:'A connector at the steering column.',snippet:'Box s1 Cols2 Title Mnemonic Connector:'};
 assert.equal(documentRowSummary(document),document.summary);assert.equal(documentExplanationLabel(document),'Topic explained');
 assert.equal(documentRowSummary({...document,learningContext:{summary:'Topic-specific context.'}}),'Topic-specific context.');
 assert.equal(documentExplanationLabel({...document,teachingStatus:'complete'}),'Explained');
 assert.equal(documentExplanationLabel({teachingStatus:'source',learningStatus:'pending'}),null);
 assert.equal(documentRowSummary({...document,learningStatus:'pending'}),document.snippet);
 assert.equal(documentRowSummary({...document,summary:null,section:{title:'Connector views'}}),'Connector views');
});

test('reviewed enthusiast introductions remain visible alongside topic and circuit context',async()=>{
 const {showArticleIntroduction}=await import('./topic-context-model.mjs');
 const document={introduction:'Follow the power before blaming the module.',editorial:{teachingVersion:'enthusiast-v2'},learningContext:{status:'complete',summary:'Background',sections:[{title:'Circuit basics'}]},circuitContext:{mode:'curated'}};
 assert.equal(showArticleIntroduction(document),true);
 assert.equal(showArticleIntroduction({...document,editorial:undefined}),false);
 assert.equal(showArticleIntroduction({introduction:'Existing standalone explanation'}),true);
 assert.equal(showArticleIntroduction({...document,introduction:''}),false);
});

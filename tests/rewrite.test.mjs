import test from 'node:test';import assert from 'node:assert/strict';
import {editableLeaves,validateEdits} from '../scripts/rewrite-lib.mjs';
test('editorial coverage includes actions, nested warnings, list items, and table prose without rewriting data cells',()=>{
 const blocks=[{id:'s',type:'step',text:'Remove the bolt.',children:[{id:'w',type:'safety',severity:'warning',text:'Support the vehicle.'}]},{id:'l',type:'list',items:[{id:'i',text:'Disconnect.',children:[]}]},{id:'t',type:'table',rows:[{cells:[{text:'25 Nm',blocks:[]},{text:'note',blocks:[{id:'p',type:'paragraph',text:'Do not reuse this bolt.'}]}]}]}];
 assert.deepEqual(editableLeaves(blocks).map(b=>b.id),['s','w','i','p']);
});
test('guide validation rejects missing steps, wrong numbers, and omitted tool IDs',()=>{
 const leaves=[{id:'a',type:'step',text:'Use 303-1234 to tighten to 25 Nm.'},{id:'b',type:'safety',text:'Wait 10 minutes.'}];
 const valid={edits:[{blockId:'a',text:'With tool 303-1234, apply 25 Nm of torque.',why:'The specified tool positions the component.'},{blockId:'b',text:'Allow 10 minutes before continuing.',why:''}],uncertainties:[]};
 assert.equal(validateEdits(leaves,valid).passed,true);
 assert.equal(validateEdits(leaves,{...valid,edits:valid.edits.slice(0,1)}).passed,false);
 assert.equal(validateEdits(leaves,{...valid,edits:[{...valid.edits[0],text:'Tighten to 20 Nm.'},valid.edits[1]]}).passed,false);
 assert.equal(validateEdits(leaves,{...valid,uncertainties:['Unclear sequence']}).passed,false);
});

test('shared validation rejects invented numbers, changed units and lost temperature signs, but permits torque notation equivalents',()=>{
 const leaf={id:'torque',type:'step',text:'Tighten the bolts to 25 Nm (18 lb.ft).'};
 const edit=text=>({edits:[{blockId:leaf.id,text,why:''}]});
 assert.equal(validateEdits([leaf],edit('Apply 25 Nm (18 lb-ft) to the bolts.')).passed,true);
 assert.equal(validateEdits([leaf],edit('Apply 25 lb-ft (18 Nm) to the bolts.')).passed,false);
 assert.equal(validateEdits([leaf],edit('Apply 25 Nm (18 lb-ft), then turn another 90 degrees.')).passed,false);
 const temperature={id:'cold',type:'paragraph',text:'The lower limit is -40 °C.'};
 assert.equal(validateEdits([temperature],{edits:[{blockId:'cold',text:'Use a lower limit of 40 degrees C.',why:''}]}).passed,false);
});
test('introduction and requirements use full document/table evidence, while individual edits cannot borrow another action’s specification',async()=>{
 const {documentEvidence}=await import('../server/guide-validation.mjs');
 const doc={title:'Engine - 3.7L',blocks:[{id:'s',type:'step',text:'Remove the cover.'},{id:'t',type:'table',rows:[{cells:[{text:'Tool 303-1234; 25 Nm',blocks:[]}]}]}]};
 const leaves=editableLeaves(doc.blocks),evidence=documentEvidence(doc);
 const output={title:'The 3.7L cover',introduction:'This procedure uses tool 303-1234.',requirements:[{category:'Tools',items:[{name:'303-1234',detail:'Specified service tool.'}]}],edits:[{blockId:'s',text:'Take off the cover.',why:''}]};
 assert.equal(validateEdits(leaves,output,{evidence}).passed,true);
 assert.equal(validateEdits(leaves,{...output,introduction:'Tighten the cover to 90 Nm.'},{evidence}).passed,false);
 assert.equal(validateEdits(leaves,{...output,requirements:[{items:[{name:'Wrench',detail:'Apply 25 lb-ft.'}]}]},{evidence}).passed,false);
 assert.equal(validateEdits(leaves,{...output,edits:[{blockId:'s',text:'Take off the cover at 25 Nm.',why:''}]},{evidence}).passed,false);
});
test('Markdown document target digits are ignored but altered visible specifications are still rejected',()=>{
 const leaves=[{id:'r',type:'paragraph',text:'Refer to Jacking and Lifting (100-02).'}];
 assert.equal(validateEdits(leaves,{edits:[{blockId:'r',text:'See [Jacking and Lifting](#/document/G1663631) (100-02).',why:''}]}).passed,true);
 assert.equal(validateEdits(leaves,{edits:[{blockId:'r',text:'See [Jacking and Lifting at 90 Nm](#/document/G1663631) (100-02).',why:''}]}).passed,false);
});
test('startup publication and resume checks never trust a complete flag without current valid coverage',async()=>{
 const {validPublishedGuide,resumeCheckpoint}=await import('../scripts/rewrite-planning.mjs');
 const {documentEvidence}=await import('../server/guide-validation.mjs');
 const doc={id:'D1',source_hash:'hash',blocks:[{id:'a',type:'step',text:'Apply 25 Nm.'},{id:'b',type:'step',text:'Remove the cover.'}]};doc.leaves=editableLeaves(doc.blocks);doc.evidence=documentEvidence(doc);
 const good={blockId:'a',text:'Use 25 Nm of torque.',why:''},bad={blockId:'b',text:'Take off the cover with 90 Nm.',why:''};
 assert.equal(validPublishedGuide(doc,{documentId:'D1',sourceHash:'hash',status:'complete',checks:{passed:true},edits:[good]}),false);
 const checkpoint=resumeCheckpoint(doc,{sourceHash:'hash',edits:{a:good,b:bad},attempts:3,title:'Cover',introduction:'Work on the cover.',requirements:[]});
 assert.deepEqual(Object.keys(checkpoint.edits),['a']);assert.equal(checkpoint.attempts,0);
 assert.equal(resumeCheckpoint(doc,{sourceHash:'old',edits:{a:good}}),null);
});
test('chunk planning retains following and leading illustrations, splits on image budgets, and keeps complete small-document media',async()=>{
 const {documentEvents,selectChunk,chunkMedia}=await import('../scripts/rewrite-planning.mjs');
 const blocks=[{id:'leading',type:'media',mediaId:'m0'}];for(let i=1;i<=4;i++){blocks.push({id:'s'+i,type:'step',text:'Action '+i});for(let j=0;j<4;j++)blocks.push({id:'b'+i+j,type:'media',mediaId:'m'+i+j});}
 const doc={blocks,leaves:editableLeaves(blocks),media:blocks.filter(b=>b.mediaId).map(b=>({id:b.mediaId})),events:documentEvents(blocks)};
 const chunk=selectChunk(doc,doc.leaves,{maxChars:999,maxImages:9});assert.equal(chunk.leaves.length,2);assert.deepEqual(chunk.media.map(m=>m.id),['m0','m10','m11','m12','m13','m20','m21','m22','m23']);
 const next=selectChunk(doc,doc.leaves.slice(2),{maxChars:999,maxImages:12});assert.ok(next.media.some(m=>m.id==='m23'));assert.ok(next.media.some(m=>m.id==='m43'));assert.deepEqual(chunkMedia(doc,doc.leaves),doc.media);
});

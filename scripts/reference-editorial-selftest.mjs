import {createBatchedCaller,splitBatchResults} from './reference-editorial-batching.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {planChunks,sourceUnits,exactIds,validateReview,validateStructure} from './reference-editorial-lib.mjs';
test('full source text survives chunk planning byte for byte',()=>{for(const text of ['', 'abc', 'abc\n', 'abc\nxyz', 'line\n'.repeat(10000)]){const d={id:'test',blocks:[],media:[],text};assert.equal(sourceUnits(d).filter(x=>x.kind==='source-text').map(x=>x.value.text).join(''),text);const p=planChunks(d,{maxChars:1000});assert.deepEqual(p.chunks.flatMap(x=>x.unitIds),p.units.map(x=>x.unitId));}});
test('nested edits and all illustrations survive chunk planning',()=>{const doc={id:'test',text:'label',blocks:[{id:'a',type:'paragraph',text:'Remove the bolt.'},{id:'b',type:'image',mediaId:'m1'},{id:'c',type:'paragraph',text:'Install the bolt.'}],media:[{id:'m1'},{id:'m2'}]};const p=planChunks(doc,{maxChars:100,maxImages:1});assert.deepEqual(p.chunks.flatMap(x=>x.leafIds),['a','c']);assert.deepEqual(p.chunks.flatMap(x=>x.mediaIds),['m1','m2']);});
test('review fails on omitted units or any technical objection',()=>{const keys=['passed','actionsPreserved','warningsPreserved','branchesPreserved','numbersPreserved','scopePreserved','explanationsSupported','usefulTeaching','toneAppropriate'];const good={...Object.fromEntries(keys.map(k=>[k,true])),coveredUnitIds:['a'],issues:[]};assert.deepEqual(validateReview({unitIds:['a']},good),[]);assert.ok(validateReview({unitIds:['a','b']},good).length);assert.ok(validateReview({unitIds:['a']},{...good,branchesPreserved:false}).length);assert.ok(validateReview({unitIds:['a']},{...good,issues:[{reason:'Invented torque'}]}).length);assert.ok(validateReview({unitIds:['a']},{...good,issues:undefined}).length);assert.equal(exactIds(['a'],['a','a']),false);});

test('headings remain titles while teaching stays separate',()=>{const leaves=[{id:'h',type:'heading',text:'Pin assignments'}];assert.deepEqual(validateStructure(leaves,{edits:[{blockId:'h',text:'Read the pin assignments',why:'A full explanatory paragraph goes here.'}]}),[]);assert.ok(validateStructure(leaves,{edits:[{blockId:'h',text:'Pin assignments\n\nA long explanation.'}]}).length);assert.ok(validateStructure(leaves,{edits:[{blockId:'h',text:'word '.repeat(30)}]}).length);});

test('shared calls preserve per-document identity and one CLI slot',async()=>{let active=0,maximum=0,calls=0;const call=createBatchedCaller({root:'/unused',authorSchema:{},reviewSchema:{},atomic:()=>{},log:()=>{},maxBatchSize:4,rawCall:async(kind,input)=>{active++;maximum=Math.max(maximum,active);calls++;await new Promise(r=>setTimeout(r,10));active--;return{results:input.documents.map(d=>({documentId:d.documentId,output:{id:d.documentId}}))};}});const values=await Promise.all(Array.from({length:5},(_,i)=>call('author',{documentId:'doc-'+i},[],'/unused/'+i)));assert.equal(calls,2);assert.equal(maximum,1);assert.deepEqual(values.map(v=>v.id),['doc-0','doc-1','doc-2','doc-3','doc-4']);assert.throws(()=>splitBatchResults({results:[{documentId:'a',output:{}},{documentId:'a',output:{}}]},['a','b']),/coverage/);});

test('support packages include complete nested evidence or explicitly exclude whole destinations',async()=>{
 const {buildSupportingPackage}=await import('./reference-editorial-support.mjs');
 const make=(id,related=[],media=[])=>({id,title:id,related,media,engines:['3.7L'],blocks:[{id:id+'-a',type:'paragraph',text:'Retain the complete source.'}],text:'Complete source\n',source_hash:id+'-hash'});
 const a=make('a',['b']),b=make('b',['c'],[{id:'b-image',url:'/b.png'}]),c=make('c',['a'],[{id:'c-image',url:'/c.png'}]);
 const p=buildSupportingPackage(a,[a,b,c]);assert.deepEqual(p.supportingSourceRefs.map(x=>[x.documentId,x.referencedBy]),[['b','a'],['c','b']]);assert.equal(p.images,2);assert.deepEqual(p.completeSupportingReferences[0].units,sourceUnits(b));assert.equal(p.unavailableSupportingReferences.length,0);
 const limited=buildSupportingPackage(a,[a,b,c],{maxImages:1});assert.deepEqual(limited.documents.map(x=>x.id),['b']);assert.equal(limited.unavailableSupportingReferences[0].documentId,'c');assert.deepEqual(limited.completeSupportingReferences[0].units,sourceUnits(b));
 const incompatible=buildSupportingPackage(a,[a,{...b,engines:['5.0L']},c]);assert.equal(incompatible.documents.length,0);assert.match(incompatible.unavailableSupportingReferences[0].reason,/incompatible/);
 const alias=buildSupportingPackage(make('a',['alias']),[a,{...b,source:{reference:'alias'}}]);assert.equal(alias.documents.length,0);assert.match(alias.unavailableSupportingReferences[0].reason,/Unresolved/);
});

test('safety navigation contributes no evidence and repeated icon bytes retain all associations',async()=>{
 const {buildSupportingPackage}=await import('./reference-editorial-support.mjs');
 const make=(id,title,related=[],media=[])=>({id,title,related,media,engines:[],blocks:[{id:id+'-a',type:'paragraph',text:'Complete warning.'}],text:'Complete warning.',source_hash:id+'-hash'});
 const p={...make('job','Battery service',['G1693180']),kind:'repair'};
 const bridge=make('G1693180','About this Manual',['G1693189'],[{id:'unreviewed',url:'/bridge.png'}]);
 const general=make('G1693189','General safety',['G1693181'],[{id:'warning-a',url:'/warning.png'},{id:'warning-b',url:'/warning.png'}]);
 const battery=make('G1693181','Battery safety',[],[{id:'warning-c',url:'/warning.png'}]);
 const pack=buildSupportingPackage(p,[p,bridge,general,battery],{maxImages:1});
 assert.equal(pack.images,1);assert.deepEqual(pack.documents.map(d=>d.id),['G1693189','G1693181']);assert.equal(pack.supportingSourceRefs[0].navigationOnly,true);assert.equal('sourceUnitCount' in pack.supportingSourceRefs[0],false);assert.equal('mediaCount' in pack.supportingSourceRefs[0],false);assert.equal(pack.supportingSourceRefs[1].mediaCount,2);assert.equal(pack.supportingSourceRefs[2].mediaCount,1);assert.equal(pack.unavailableSupportingReferences.length,0);
});

test('shared sources stay complete and cannot lend another article a numeric claim',async()=>{
 const {compactSupportingInputs}=await import('./reference-editorial-batching.mjs');
 const {validateEdits}=await import('../server/guide-validation.mjs');
 const shared={documentId:'shared',units:[{unitId:'shared:u1',value:'A complete source warning.'}]};
 const exclusive={documentId:'only-b',units:[{unitId:'only-b:u1',value:'Tighten to 777 Nm.'}]};
 const packed=compactSupportingInputs([{documentId:'a',unitIds:['a:u1','shared:u1'],completeSupportingReferences:[shared]},{documentId:'b',unitIds:['b:u1','shared:u1','only-b:u1'],completeSupportingReferences:[shared,exclusive]}]);
 assert.equal(packed.sharedSupportingReferences.length,2);
 assert.equal(packed.documents[0].completeSupportingReferences.length,1);
 const allow=new Set(packed.documents[0].completeSupportingReferences.map(r=>r.sharedReferenceKey));
 const allowed=packed.sharedSupportingReferences.filter(r=>allow.has(r.sharedReferenceKey));
 assert.deepEqual(allowed[0].units,shared.units);assert.equal(allowed.some(r=>r.documentId==='only-b'),false);
 const result=validateEdits([{id:'a',text:'Install the bolt.',type:'step'}],{edits:[{blockId:'a',text:'Refit the bolt.',why:'Tighten it to 777 Nm.'}]},{evidence:'Install the bolt. '+JSON.stringify(allowed)});
 assert.equal(result.passed,false);assert.ok(result.errors.some(e=>/777/.test(e)));
});

test('identical image bytes share one attachment with explicit per-document mappings',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reference-batch-images-'));
 try{const a=path.join(dir,'a.png'),b=path.join(dir,'b.png');fs.writeFileSync(a,'same-test-image-bytes');fs.writeFileSync(b,'same-test-image-bytes');let observed;
 const call=createBatchedCaller({root:dir,authorSchema:{},reviewSchema:{},atomic:()=>{},log:()=>{},maxImages:1,rawCall:async(kind,input,images)=>{observed={input,images};return{results:input.documents.map(d=>({documentId:d.documentId,output:{ok:true}}))};}});
 await Promise.all([call('author',{documentId:'a'},[a],dir+'/a'),call('author',{documentId:'b'},[b],dir+'/b')]);assert.equal(observed.images.length,1);assert.deepEqual(observed.input.imageOrder.map(x=>[x.documentId,x.index,x.localIndex]),[['a',1,1],['b',1,1]]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

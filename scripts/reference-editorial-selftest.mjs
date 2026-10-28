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

test('media hub and fuel door names do not import unrelated wheel or fuel-system hazards',async()=>{
 const {buildSupportingPackage}=await import('./reference-editorial-support.mjs');
 const make=(id,title,related=[])=>({id,title,related,media:[],engines:[],blocks:[],text:'Source text.',source_hash:id+'-hash'});
 const bridge=make('G1693180','About this Manual',['G1693189']),general=make('G1693189','Health and Safety Precautions',['G1693193','G1693188']),wheel=make('G1693193','Wheel and Tire Safety'),fuel=make('G1693188','Gasoline Fuel System Safety');
 for(const title of['Media Hub','Fuel Filler Door']){const primary={...make('job',title,['G1693180']),kind:'repair',section_title:'Interior Trim'};const p=buildSupportingPackage(primary,[primary,bridge,general,wheel,fuel]);assert.deepEqual(p.documents.map(d=>d.id),['G1693189']);assert.equal(p.unavailableSupportingReferences.length,0);}
});

test('focused safety refresh preserves approved prose and existing requirements',async()=>{
 const {validatePreservedProse}=await import('./reference-editorial-lib.mjs');const old={title:'A title',introduction:'Reviewed introduction',edits:[{blockId:'a',text:'Refit the part.',why:'Reviewed explanation.'}],requirements:[{category:'Tools',items:[{name:'Tool',detail:'Existing requirement.'}]}]};
 const good=structuredClone(old);good.requirements.push({category:'Preparation',items:[{name:'Key',detail:'New sourced preparation.'}]});assert.deepEqual(validatePreservedProse(old,good),[]);const changed=structuredClone(good);changed.edits[0].why='Changed technical explanation.';assert.ok(validatePreservedProse(old,changed).length);const missing=structuredClone(good);missing.requirements.shift();assert.ok(validatePreservedProse(old,missing).length);
});

test('startup wording requires exact reviewed safety evidence and leaves actions untouched',async()=>{
 const {clarifyStartupPreparation,GENERAL_SAFETY_HASH}=await import('./reference-editorial-startup.mjs');
 const draft={requirements:[{category:'Preparation',items:[{name:'Starting',detail:'Remove the key from the vehicle.'},{name:'Remote start',detail:'If equipped, disable remote start through the display.'}]}],edits:[{text:'Switch the ignition ON for this test.'}]};
 const ref={documentId:'G1693189',sourceHash:GENERAL_SAFETY_HASH};assert.equal(clarifyStartupPreparation(structuredClone(draft),{kind:'repair',supportingSourceRefs:[{...ref,navigationOnly:true}]}).length,0);assert.equal(clarifyStartupPreparation(structuredClone(draft),{kind:'diagnosis',supportingSourceRefs:[ref]}).length,0);assert.equal(clarifyStartupPreparation(draft,{kind:'repair',supportingSourceRefs:[ref]}).length,1);assert.match(draft.requirements[0].items[0].detail,/ignition OFF/);assert.equal(draft.requirements[0].items[1].detail,'If equipped, disable remote start through the display.');assert.equal(draft.edits[0].text,'Switch the ignition ON for this test.');assert.equal(clarifyStartupPreparation(draft,{kind:'repair',supportingSourceRefs:[ref]}).length,0);
});

test('body closures include complete applicable body safety evidence without fuel-system assumptions',async()=>{
 const {buildSupportingPackage}=await import('./reference-editorial-support.mjs');const make=(id,title,related=[])=>({id,title,related,media:[],engines:[],blocks:[],text:'Complete precautions.',source_hash:id+'-hash'});const primary={...make('door','Fuel Filler Door',['G1693180']),kind:'repair',section_title:'Body Closures'},bridge=make('G1693180','About this Manual',['G1693189']),general=make('G1693189','General Safety',['G1693182','G1693188']),body=make('G1693182','Body Repair Health and Safety'),fuel=make('G1693188','Gasoline Fuel Safety');const p=buildSupportingPackage(primary,[primary,bridge,general,body,fuel]);assert.deepEqual(p.documents.map(d=>d.id),['G1693189','G1693182']);assert.equal(p.unavailableSupportingReferences.length,0);
});

test('brake-dust staging refuses unrelated documents before reading private artifacts',async()=>{
 const {spawnSync}=await import('node:child_process');const result=spawnSync(process.execPath,[new URL('./reference-editorial-stage-brake-dust.mjs',import.meta.url).pathname,'G1693782'],{cwd:'/tmp',encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/restricted to the two reviewed shield targets/);assert.doesNotMatch(result.stderr,/ENOENT/);
});

test('startup normalization handles mid-sentence key removal and separate equipment conditions',async()=>{
 const {clarifyStartupPreparation,GENERAL_SAFETY_HASH}=await import('./reference-editorial-startup.mjs');
 const context={kind:'repair',supportingSourceRefs:[{documentId:'G1693189',sourceHash:GENERAL_SAFETY_HASH}]};
 const draft={requirements:[{category:'Setup',items:[
  {name:'Starting',detail:'Once seat access is arranged, remove the key from the vehicle.'},
  {name:'Starting',detail:'Disable remote start through the display. Switch the ignition OFF and remove the key from the vehicle. If equipped with engine auto start-stop, keep ignition off.'},
  {name:'Starting',detail:'If equipped, disable remote start through the display. Switch the ignition OFF and remove the key from the vehicle.'}
 ]}],edits:[]};
 assert.equal(clarifyStartupPreparation(draft,context).length,2);
 assert.match(draft.requirements[0].items[0].detail,/arranged, switch the ignition OFF and remove/);
 assert.match(draft.requirements[0].items[1].detail,/^Disable remote start, if equipped, through/);
 assert.equal((draft.requirements[0].items[1].detail.match(/ignition OFF/g)||[]).length,1);
 assert.match(draft.requirements[0].items[2].detail,/^If equipped, disable remote start through/);
 assert.equal(clarifyStartupPreparation(draft,context).length,0);
 const alreadyClear={requirements:[{category:'Setup',items:[{name:'Starting',detail:'WARNING: Switch off the ignition and remove the key from the vehicle.'},{name:'Switch off the ignition and remove the key',detail:'Remove the key from the vehicle before service.'}]}]};
 assert.equal(clarifyStartupPreparation(alreadyClear,context).length,0);
});

test('publication startup check rejects missed variants without mutating reviewed content',async()=>{
 const {startupReadinessIssues}=await import('./reference-editorial-readiness.mjs');
 const {GENERAL_SAFETY_HASH}=await import('./reference-editorial-startup.mjs');
 const make=detail=>({supportingSourceRefs:[{documentId:'G1693189',sourceHash:GENERAL_SAFETY_HASH}],requirements:[{category:'Setup',items:[{name:'Startup',detail}]}],edits:[{text:'Switch the ignition ON for this operating test.'}]});
 for(const detail of ['Remove the vehicle key to prevent another person starting the engine.','Once seat access is arranged, remove the key from the vehicle.','Disable remote start through the display. Switch the ignition OFF and remove the key. If equipped with engine auto start-stop, keep ignition off.']){
  const candidate=make(detail),before=JSON.stringify(candidate);
  assert.equal(startupReadinessIssues({kind:'repair'},candidate).length,1);
  assert.equal(JSON.stringify(candidate),before);
  assert.equal(candidate.edits[0].text,'Switch the ignition ON for this operating test.');
  assert.deepEqual(startupReadinessIssues({kind:'diagnosis'},candidate),[]);
 }
 assert.deepEqual(startupReadinessIssues({kind:'repair'},make('If equipped, disable remote start through the display. Switch off the ignition and remove the key.')),[]);
});

test('supervisory readiness is exact-artifact and cannot borrow another document approval',async()=>{
 const {supervisoryReadinessIssues}=await import('./reference-editorial-readiness.mjs');
 const map={clearances:{a:{'reviewed-sha':{evidence:'actual-approval.json'}}}};
 const before=JSON.stringify(map);
 assert.deepEqual(supervisoryReadinessIssues('a','reviewed-sha',map),[]);
 assert.equal(supervisoryReadinessIssues('a','changed-sha',map).length,1);
 assert.equal(supervisoryReadinessIssues('b','reviewed-sha',map).length,1);
 assert.equal(supervisoryReadinessIssues('a','reviewed-sha',{}).length,1);
 assert.equal(JSON.stringify(map),before);
});

test('brake-booster access adds complete brake safety without treating parking restraint as brake work',async()=>{
 const {buildSupportingPackage}=await import('./reference-editorial-support.mjs');
 const doc=(id,title,text,related=[],kind='overview')=>({id,title,text,related,kind,engines:[],media:[],blocks:[],source_hash:id+'-hash'});
 const about=doc('G1693180','About','',['G1693189']),general=doc('G1693189','General Safety','Review applicable brake and clutch precautions.',['G1693183']),brakes=doc('G1693183','Brake and Clutch Safety','Complete warning text.');
 const primary=doc('pipe','Air Cleaner Outlet Pipe','Disconnect the brake-booster vacuum tube.',['G1693180'],'repair');
 const pack=buildSupportingPackage(primary,[primary,about,general,brakes]);
 assert.deepEqual(pack.documents.map(d=>d.id),['G1693189','G1693183']);
 const neutral={...primary,text:'Apply the parking brake before cabin work.'};
 assert.deepEqual(buildSupportingPackage(neutral,[neutral,about,general,brakes]).documents.map(d=>d.id),['G1693189']);
 const nested=doc('tensioner','Accessory Drive Belt Tensioner','Remove the outlet pipe.',['pipe','G1693180'],'repair');
 assert.ok(buildSupportingPackage(nested,[nested,primary,about,general,brakes]).documents.some(d=>d.id==='G1693183'));
});

test('public decoded reference validation rejects engine claims absent from its evidence',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const {decodeDocument}=await import('../server/db.mjs');const {validateGuide,selectTeachingContext}=await import('../server/guide-validation.mjs');const fs=await import('node:fs');const db=new DatabaseSync('data/atlas.sqlite',{readOnly:true});try{const context={terms:JSON.parse(fs.readFileSync('content/glossary.json')).terms,systems:JSON.parse(fs.readFileSync('content/systems.json')).systems,abbreviations:JSON.parse(fs.readFileSync('data/abbreviations.json'))};for(const id of ['G1688154','G1796477']){const d=decodeDocument(db.prepare('select * from documents where id=?').get(id)),g={documentId:id,sourceHash:d.sourceHash,title:d.title,status:'complete',introduction:'This 5.2L overview.',requirements:[],edits:[{blockId:d.blocks[0].id,text:'Locate the external gearshift controls',why:''}],editorialVersion:1,validationVersion:5,checks:{passed:true}};const result=validateGuide(d,g,{curatedContext:selectTeachingContext(d,context)});assert(result.errors.some(x=>x.includes('new numeric value 5.2')));}}finally{db.close();}
});

test('direct authenticated general safety does not falsely require an About Manual bridge',async()=>{
 const {buildSupportingPackage}=await import('./reference-editorial-support.mjs');const make=(id,related=[],kind='general')=>({id,title:id,text:'Complete source text.',source_hash:id,engines:[],related,kind,blocks:[],media:[]});const primary=make('primary',['G1693189'],'repair'),general=make('G1693189');const result=buildSupportingPackage(primary,[primary,general]);assert.equal(result.documents.some(d=>d.id==='G1693189'),true);assert.deepEqual(result.unavailableSupportingReferences,[]);assert.equal(result.supportingSourceRefs[0].referencedBy,'primary');
});

test('direct general safety retains full text while selecting only task-relevant child precautions',async()=>{
 const {buildSupportingPackage}=await import('./reference-editorial-support.mjs');const make=(id,title,related=[],kind='general')=>({id,title,text:'Complete source text.',source_hash:id,engines:[],related,kind,blocks:[],media:[]});const primary=make('primary','Brake booster tube',['G1693189'],'repair'),general=make('G1693189','General safety',['G1693183','G1693184']),brake=make('G1693183','Brake safety'),climate=make('G1693184','Climate safety');const result=buildSupportingPackage(primary,[primary,general,brake,climate]);assert.deepEqual(result.documents.map(d=>d.id),['G1693189','G1693183']);assert.equal(result.documents[0].text,general.text);assert.deepEqual(result.unavailableSupportingReferences,[]);
});

test('general safety primary is its own complete evidence without a self-reference',async()=>{
 const {buildSupportingPackage}=await import('./reference-editorial-support.mjs');const primary={id:'G1693189',title:'Health and Safety Precautions',text:'Complete primary warnings.',source_hash:'safety',engines:[],related:[],kind:'general',blocks:[],media:[]};const result=buildSupportingPackage(primary,[primary]);assert.deepEqual(result.supportingSourceRefs,[]);assert.deepEqual(result.unavailableSupportingReferences,[]);
});

test('exterior trim and rocker access include authenticated body precautions only',async()=>{
 const {buildSupportingPackage}=await import('./reference-editorial-support.mjs');
 const make=(id,title,related=[])=>({id,title,text:'Complete source text.',source_hash:id,engines:[],related,kind:'general',blocks:[],media:[]});
 const general=make('G1693189','General safety',['G1693182','G1693188']),body=make('G1693182','Body precautions'),fuel=make('G1693188','Fuel precautions');
 for(const [title,section_title] of [['Rocker Panel Moulding','Exterior Trim'],['Rocker Molding','Trim'],['Door Applique','Exterior Trim']]){
  const primary={...make('primary',title,['G1693189']),kind:'repair',section_title};
  const result=buildSupportingPackage(primary,[primary,general,body,fuel]);
  assert.deepEqual(result.documents.map(d=>d.id),['G1693189','G1693182']);
  assert.deepEqual(result.unavailableSupportingReferences,[]);
 }
 const interior={...make('primary','Center Register',['G1693189']),kind:'repair',section_title:'Interior Trim'};
 assert.deepEqual(buildSupportingPackage(interior,[interior,general,body,fuel]).documents.map(d=>d.id),['G1693189']);
});


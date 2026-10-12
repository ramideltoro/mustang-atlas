import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createMaintenanceGuideCatalog} from '../server/maintenance-guides.mjs';
const normal='https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G1649139&variantid=3259';
const guide=(id='oil',engines=['2.3L','3.7L','5.0L'])=>({id,title:id==='oil'?'Oil and filter service':'Shelby condition check',summary:'Learn the right service for this engine.',categoryId:'engine',ruleIds:['rule-'+id],applicability:{engines,years:[2015]},hero:{documentId:id==='oil'?'G37':'G52',mediaId:id==='oil'?'G37-m1':'G52-m1'},introduction:'Check level between services.',why:'Oil lubricates the moving parts.',when:{summary:'Use the verified interval.',notes:['Inspect a new leak sooner.']},prepare:[{title:'Plan the job',detail:'Use the engine-specific specification.'}],steps:[{title:'Check the level',body:'Park level and follow the procedure.'}],watchFor:[{title:'Leaks',body:'Investigate a persistent leak.'}],notes:['This is not a universal refill quantity.'],procedures:[{documentId:id==='oil'?'G37':'G52',purpose:'Use the applicable inspection.'}],relatedGuideIds:id==='oil'?['shelby']:['oil'],sourceRefs:[{documentId:id==='oil'?'G37':'G52',sourceHash:'hash-'+(id==='oil'?'G37':'G52')}],evidence:['normal']});
function seed(){return{version:1,title:'Maintenance',description:'Plan service by component and engine.',categories:[{id:'engine',title:'Engine care',description:'Oil and related checks.',icon:'droplet'}],evidence:{normal:{title:'Ford normal schedule',url:normal}},guides:[guide(),guide('shelby',['5.2L'])],schedule:{title:'Normal maintenance schedule',summary:'2015 base-engine schedule.',applicability:{engines:['2.3L','3.7L','5.0L'],years:[2015]},oilLife:{summary:'Use the oil-life reminder.',bands:[{id:'normal',label:'Normal',miles:'7,000–10,000 mi',kilometers:'12,000–16,000 km',description:'Typical oil-change range.'}],notes:['Do not exceed the maximum time.']},groups:[{id:'oil-change',title:'At an oil change',timing:'When requested',description:'Do these checks at service.',items:[{guideId:'oil',task:'Change oil and filter',detail:'Use the engine-specific specification.'}]}],notes:['Intervals differ for severe use.'],exceptions:[{title:'Use',body:'Different conditions require different planning.'}]}};}
function fixture(t,data=seed()){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-maintenance-guides-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('CREATE TABLE documents(id,title,kind,system_id,section_code,section_title,engines,source_hash,media,blocks)');
 for(const[id,engine,title]of[['G37','3.7L','Oil inspection'],['G52','5.2L','Oil inspection'],['hidden','','About this Manual']])db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,title,'repair','engine','303-01','Engine '+engine,JSON.stringify(engine?[engine]:[]),'hash-'+id,JSON.stringify([{id:id+'-m1',url:'/media/'+id+'.jpg',width:580,height:400,mime:'image/jpeg',caption:'Engine component'}]),JSON.stringify([{id:id+'-s1',type:'step',text:'Perform the oil inspection.',children:[{id:id+'-b1',type:'media',mediaId:id+'-m1'}]}]));
 const file=path.join(dir,'maintenance-guides.json');fs.writeFileSync(file,JSON.stringify(data));return{dir,file,db,catalog:createMaintenanceGuideCatalog(db,{contentDir:dir,assetResolver:m=>({...m,url:m.url.replace('.jpg','-native.jpg'),width:1900})})};
}
test('hub search, category counts, schedule scope and related procedures use the selected engine',t=>{const{catalog}=fixture(t);const all=catalog.list();assert.equal(all.total,2);assert.equal(all.categories[0].count,2);assert.equal(all.items[0].interval,'Use the verified interval.');const base=catalog.list({engine:'3.7L'});assert.deepEqual(base.items.map(g=>g.id),['oil']);assert.equal(base.categories[0].count,1);assert.equal(catalog.list({q:'oil filter'}).total,1);assert.equal(catalog.list({category:'unavailable'}).total,0);assert.equal(catalog.list({year:2016}).total,0);assert.equal(catalog.schedule({engine:'5.2L'}).applicability.matchesSelectedEngine,false);assert.deepEqual(catalog.schedule({engine:'5.2L'}).groups,[]);assert.equal(catalog.schedule({engine:'5.2L'}).oilLife,null);assert.equal(catalog.schedule({engine:'3.7L'}).groups[0].items[0].href,'#/maintenance/oil');});
test('detail returns exact linked article metadata and resolved hero without private provenance or cache mutation',t=>{const{catalog}=fixture(t);const all=catalog.detail('oil');assert.equal(all.thumbnail.url,'/media/G37-native.jpg');assert.equal(all.thumbnail.id,'G37-m1');assert.equal(all.procedures[0].href,'#/document/G37');assert.deepEqual(all.procedures[0].engines,['3.7L']);assert.deepEqual(all.sources,[{title:'Normal maintenance schedule',url:'#/maintenance/schedule'}]);assert.doesNotMatch(JSON.stringify(all),/sourceHash|sourceRefs|evidence|ProcUid|source_path/);const selected=catalog.detail('oil',{engine:'3.7L'});assert.equal(selected.relatedGuides.length,0);selected.steps[0].body='mutated';assert.equal(catalog.detail('oil').steps[0].body,'Park level and follow the procedure.');const mismatch=catalog.detail('oil',{engine:'5.2L'});assert.equal(mismatch.applicability.matchesSelectedEngine,false);assert.deepEqual(mismatch.procedures,[]);assert.equal(mismatch.thumbnail,null);assert.equal(catalog.detail('missing'),null);});
test('stale bound evidence suppresses its guide and the incomplete schedule',t=>{const data=seed();data.guides[0].sourceRefs[0].sourceHash='changed';const{catalog}=fixture(t,data);assert.equal(catalog.detail('oil'),null);assert.equal(catalog.schedule(),null);assert.ok(catalog.report().errors.some(e=>e.id==='oil'&&e.reason==='invalid-or-stale-evidence'));});
test('unbound or unavailable procedure/media identifiers and unsafe prose cannot become public guides',t=>{for(const mutate of[g=>g.procedures[0].documentId='hidden',g=>g.hero.mediaId='missing',g=>g.steps[0].body='<script>alert(1)</script>',g=>g.introduction='[Bad](javascript:alert(1))']){const data=seed();mutate(data.guides[0]);const{catalog}=fixture(t,data);assert.equal(catalog.detail('oil'),null);}});
test('atomic seed changes refresh the catalog and ambiguous rule mappings do not choose the first guide',t=>{const{catalog,file}=fixture(t);assert.equal(catalog.forRule('rule-oil',{engine:'3.7L'}).href,'#/maintenance/oil');const changed=seed();changed.guides[1]={...guide('second'),ruleIds:['rule-oil'],relatedGuideIds:[]};changed.guides[0].relatedGuideIds=[];fs.writeFileSync(file,JSON.stringify(changed));assert.equal(catalog.forRule('rule-oil',{engine:'3.7L'}),null);assert.equal(catalog.list().items[1].id,'second');});
test('duplicate guides fail closed and invalid filters are rejected',t=>{const data=seed();data.guides.push(structuredClone(data.guides[0]));const{catalog}=fixture(t,data);assert.equal(catalog.detail('oil'),null);assert.throws(()=>catalog.list({engine:'V8'}),/engine/);assert.throws(()=>catalog.list({year:'garbage'}),/year/);assert.throws(()=>catalog.list({limit:'garbage'}),/pagination/);});
test('missing optional maintenance content keeps the catalog available but empty',t=>{const{catalog,file}=fixture(t);fs.unlinkSync(file);assert.equal(catalog.list().total,0);assert.equal(catalog.schedule(),null);assert.equal(catalog.detail('oil'),null);});
test('selected-engine thumbnails fall back to relevant illustrations and never choose tiny art or bound video controls',t=>{
 const data=seed();data.guides[0].hero={documentId:'G52',mediaId:'G52-m1'};data.guides[0].sourceRefs.push({documentId:'G52',sourceHash:'hash-G52'});const{catalog,db,dir,file}=fixture(t,data);
 assert.equal(catalog.detail('oil',{engine:'3.7L'}).thumbnail.documentId,'G37');
 const art=[{id:'G37-m1',url:'/media/G37.jpg',width:580,height:400,mime:'image/jpeg'},{id:'G37-m2',url:'/media/tiny.jpg',width:99,height:99,mime:'image/jpeg'},{id:'G37-video',url:'/media/play.png',width:300,height:227,mime:'image/png'}];db.prepare('UPDATE documents SET media=?,blocks=? WHERE id=?').run(JSON.stringify(art),JSON.stringify([{id:'G37-s1',type:'step',text:'Perform the oil inspection.',children:art.map(m=>({id:m.id+'-b',type:'media',mediaId:m.id}))}]),'G37');
 fs.writeFileSync(path.join(dir,'procedure-videos.json'),JSON.stringify({version:1,documents:[{documentId:'G37',sourceHash:'hash-G37',entries:[{controlMediaId:'G37-video',controlUrl:'/media/play.png'}]}]}));
 for(const mediaId of ['G37-m2','G37-video']){const changed=seed();changed.guides[0].hero.mediaId=mediaId;fs.writeFileSync(file,JSON.stringify(changed));const fresh=createMaintenanceGuideCatalog(db,{contentDir:dir});assert.equal(fresh.detail('oil').thumbnail.id,'G37-m1');}
});

function workshopGuide(id='diagnose-oil') {
 const g=guide();return {...g,id,title:'Diagnose oil loss',applicability:{engines:['3.7L'],years:[2015]},primaryDocumentIds:['G37'],ruleIds:[],relatedGuideIds:['oil'],evidence:[],systemId:'engine',taskType:'diagnostics',difficulty:'advanced',searchTerms:['lubricant consumption'],when:{summary:'When oil consumption has been confirmed.',notes:[]},diagnostics:[{finding:'Oil level drops.',meaning:'Oil is leaving the system.',next:'Inspect for external leaks first.'}],verification:[{title:'Verify the repair',body:'Recheck the level under the same conditions.'}]};
}
function workshopFile(dir,guides,evidence={}){const file=path.join(dir,'workshop-guides.json');fs.writeFileSync(file,JSON.stringify({version:1,guides,evidence}));return file;}
test('optional workshop catalog reloads, searches synonyms and adds validated diagnostic and verification content',t=>{
 const{catalog,dir}=fixture(t);assert.equal(catalog.list().total,2);const authored=workshopGuide();authored.diagnostics[0].sourceRefs=[{documentId:'G37',sourceHash:'hash-G37'}];authored.verification[0].evidence=['private'];const file=workshopFile(dir,[authored]);
 const detail=catalog.detail('diagnose-oil');assert.equal(catalog.report().workshopGuides,1);assert.equal(catalog.list({q:'lubricant consumption'}).total,1);assert.equal(detail.systemId,'engine');assert.equal(detail.taskType,'diagnostics');assert.equal(detail.difficulty,'advanced');assert.equal(detail.diagnostics[0].next,'Inspect for external leaks first.');assert.equal(detail.verification.length,1);assert.deepEqual(detail.sources,[]);assert.doesNotMatch(JSON.stringify(detail),/sourceHash|sourceRefs|evidence|hash-G37/);
 detail.diagnostics[0].next='mutated';assert.equal(catalog.detail('diagnose-oil').diagnostics[0].next,'Inspect for external leaks first.');
 fs.unlinkSync(file);assert.equal(catalog.detail('diagnose-oil'),null);assert.equal(catalog.list().total,2);
});
test('facets exclude their own selection but retain query, category, other dimensions and vehicle scope',t=>{
 const{catalog,dir}=fixture(t);workshopFile(dir,[workshopGuide(),{...workshopGuide('brake-diagnosis'),systemId:'brakes',difficulty:'specialist'}]);
 const list=catalog.list({system:'brakes',taskType:'diagnostics',engine:'3.7L'});assert.deepEqual(list.items.map(g=>g.id),['brake-diagnosis']);assert.equal(list.facets.systems.find(s=>s.id==='engine').count,1);assert.equal(list.facets.systems.find(s=>s.id==='brakes').count,1);assert.equal(list.facets.difficulties.find(s=>s.id==='specialist').count,1);assert.equal(list.facets.difficulties.find(s=>s.id==='advanced').count,0);assert.equal(catalog.list({q:'absent',system:'brakes'}).facets.systems.reduce((n,v)=>n+v.count,0),0);assert.equal(catalog.list({engine:'5.2L',taskType:'diagnostics'}).total,0);
 for(const input of[{system:'bad'},{taskType:'fix'},{difficulty:'easy'},{system:['engine','brakes']}])assert.throws(()=>catalog.list(input),/filter/);
});
test('duplicates across catalogs and stale workshop hashes fail closed without suppressing unrelated legacy guides',t=>{
 const{catalog,dir}=fixture(t);workshopFile(dir,[workshopGuide('oil'),{...workshopGuide('stale'),sourceRefs:[{documentId:'G37',sourceHash:'stale'}]}]);assert.equal(catalog.detail('oil'),null);assert.equal(catalog.detail('stale'),null);assert.ok(catalog.detail('shelby'));assert.ok(catalog.report().errors.some(e=>e.id==='oil'&&e.reason==='duplicate-id'));assert.ok(catalog.report().errors.some(e=>e.id==='stale'&&e.reason==='invalid-or-stale-evidence'));
});
test('workshop classification and diagnostic rows are required to be valid and nonempty',t=>{
 const{catalog,dir}=fixture(t);for(const mutate of[g=>delete g.systemId,g=>g.difficulty='easy',g=>g.diagnostics[0].next='',g=>g.diagnostics[0].meaning='<script>x</script>',g=>g.verification[0].body=' ',g=>g.searchTerms=['javascript:bad']]){const g=workshopGuide();mutate(g);workshopFile(dir,[g]);assert.equal(catalog.detail(g.id),null);}
});
test('technical durations are not scheduled intervals, but explicit interval claims need supporting schedule evidence',t=>{
 const{catalog,dir}=fixture(t);const good=workshopGuide();good.steps[0].body='Observe the pressure for 10 minutes and record the result.';workshopFile(dir,[good]);assert.ok(catalog.detail(good.id));
 good.when.notes=['This is a diagnostic job, not a routine pressure check at every oil change.'];workshopFile(dir,[good]);assert.ok(catalog.detail(good.id));
 good.when.notes=['There is no fixed interval. Replace every 10 years.'];workshopFile(dir,[good]);assert.equal(catalog.detail(good.id),null);good.when.notes=[];
 for(const when of[{summary:'Replace every 30,000 miles.',notes:[]},{summary:'Replace at 10 years.',notes:[]},{kind:'scheduled',summary:'When due.',notes:[]}]){workshopFile(dir,[{...good,when}]);assert.equal(catalog.detail(good.id),null);}
});
test('procedure applicability narrows authoritative engines and carries transmission equipment without cache mutation',t=>{
 const{catalog,dir,db}=fixture(t);db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?)').run('GM','Clutch bleeding','repair','transmission','308-02','Clutch Controls - MT82','[]','hash-GM','[]','[]');
 const g=workshopGuide();g.applicability={engines:['2.3L','3.7L'],years:[2015],equipment:'MT82 only'};g.primaryDocumentIds.push('GM');g.sourceRefs.push({documentId:'GM',sourceHash:'hash-GM'});g.procedures.push({documentId:'GM',purpose:'Bleed the supported clutch circuit.',applicability:{engines:['2.3L'],years:[2015],equipment:'Left-hand drive'}});g.procedures[0].applicability={engines:['3.7L','5.2L']};workshopFile(dir,[g]);
 const fresh=createMaintenanceGuideCatalog(db,{contentDir:dir});const all=fresh.detail(g.id);assert.deepEqual(all.procedures[0].applicability.engines,['3.7L']);assert.match(all.procedures[1].applicability.equipment,/MT82/);assert.match(all.procedures[1].applicability.equipment,/Left-hand drive/);assert.equal(fresh.detail(g.id,{engine:'3.7L'}).procedures.length,1);assert.equal(fresh.detail(g.id,{engine:'2.3L'}).procedures[0].documentId,'GM');assert.deepEqual(fresh.detail(g.id).procedures,all.procedures);
});
test('malformed workshop data cannot break the existing maintenance catalog',t=>{
 const{catalog,dir}=fixture(t);fs.writeFileSync(path.join(dir,'workshop-guides.json'),'{');assert.equal(catalog.list().total,2);assert.equal(catalog.report().errors[0].scope,'workshop-file');workshopFile(dir,[],{normal:{title:'Changed evidence',url:'https://www.fordservicecontent.com/different'}});assert.equal(catalog.detail('oil'),null);assert.ok(catalog.report().errors.some(e=>e.reason==='ambiguous-evidence'));
});
test('legacy classification is deterministic and title changes do not change known guide meaning',t=>{
 const data=seed();data.guides[0]={...data.guides[0],id:'brake-pulsation-runout',categoryId:'advanced',relatedGuideIds:[]};data.guides[1].relatedGuideIds=[];data.categories.push({id:'advanced',title:'Advanced',description:'Condition-based work.'});delete data.schedule;const{catalog,file}=fixture(t,data);const g=catalog.detail('brake-pulsation-runout');assert.deepEqual([g.systemId,g.taskType,g.difficulty],['brakes','diagnostics','advanced']);data.guides[0].title='A new plain-language title';fs.writeFileSync(file,JSON.stringify(data));assert.equal(catalog.detail(g.id).systemId,'brakes');
});
test('article-to-guide discovery uses exact procedure IDs, selected applicability and a bounded public response',t=>{
 const{catalog,dir}=fixture(t);const guides=Array.from({length:10},(_,i)=>({...workshopGuide('related-'+i),title:'Related '+i}));guides.push({...workshopGuide('evidence-only'),procedures:[]});workshopFile(dir,guides);
 const all=catalog.forDocument('G37');assert.equal(all.length,8);assert.ok(all.every(g=>g.href==='#/maintenance/'+g.id));assert.ok(!all.some(g=>g.id==='evidence-only'));assert.doesNotMatch(JSON.stringify(all),/sourceHash|sourceRefs|evidence|hash-G37/);assert.equal(catalog.forDocument('G37',{engine:'5.0L'}).length,0);assert.equal(catalog.forDocument('G37',{year:2016}).length,0);assert.deepEqual(catalog.forDocument('G3'),[]);assert.deepEqual(catalog.forDocument('hidden'),[]);
 all[0].title='mutated';assert.notEqual(catalog.forDocument('G37')[0].title,'mutated');
});
test('search treats typographic apostrophes and dashes consistently without changing authored prose',t=>{
 const{catalog,dir}=fixture(t);const g=workshopGuide();g.searchTerms=["window won't close",'cold–start concern'];g.summary='A window that won’t close needs diagnosis.';workshopFile(dir,[g]);
 for(const q of["window won't close",'window won’t close','cold-start','cold—start'])assert.equal(catalog.list({q}).items[0]?.id,g.id,q);
 assert.equal(catalog.detail(g.id).summary,g.summary);assert.equal(catalog.list({q:'hard to shift'}).total,0);
});
test('search ranks explicit symptom aliases and titles ahead of incidental prose with stable ties',t=>{
 const{catalog,dir}=fixture(t);
 const incidental={...workshopGuide('incidental'),title:'Replace a display',searchTerms:[],steps:[{title:'Observe',body:'A transmission that is hard to shift needs its own diagnosis.'}]};
 const titleMatch={...workshopGuide('title-match'),title:'Diagnose a manual gearbox that is hard to shift',searchTerms:[]};
 const alias={...workshopGuide('alias-match'),title:'Diagnose MT82 shift concerns',searchTerms:['hard to shift']};
 const tied={...alias,id:'alias-tie',title:'Diagnose the other supported gearbox'};
 workshopFile(dir,[incidental,titleMatch,alias,tied]);
 const found=catalog.list({q:'hard to shift',engine:'3.7L'});
 assert.deepEqual(found.items.map(g=>g.id),['alias-match','alias-tie','title-match','incidental']);
 assert.equal(found.total,4);
 assert.deepEqual(catalog.list({q:'hard to shift',engine:'3.7L',limit:2,offset:1}).items.map(g=>g.id),['alias-tie','title-match']);
 assert.deepEqual(catalog.list().items.slice(-4).map(g=>g.id),['incidental','title-match','alias-match','alias-tie']);
 assert.equal(catalog.list({q:'hard to shift',engine:'5.2L'}).total,0);
});
test('shared clutch chapter headings do not label a 5.2L clutch or shared control as MT82 only',t=>{
 const{db,dir}=fixture(t);for(const[id,title,code,engines]of[['GClutch52','Clutch Disc and Pressure Plate - 5.2L 32V Ti-VCT','308-01',['5.2L']],['GShared','Clutch System Bleeding','308-02',[]],['GClutch37','Clutch Disc and Pressure Plate - 3.7L','308-01',['3.7L']]])db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,title,'repair','transmission',code,'Clutch Controls - 6-Speed Manual Transmission – MT82',JSON.stringify(engines),'hash-'+id,'[]','[]');
 const g={...workshopGuide('clutch-service'),primaryDocumentIds:['GClutch52','GShared','GClutch37'],applicability:{engines:['3.7L','5.2L'],years:[2015]},hero:null,procedures:['GClutch52','GShared','GClutch37'].map(documentId=>({documentId,purpose:'Use the fitted-engine procedure.'})),sourceRefs:['GClutch52','GShared','GClutch37'].map(documentId=>({documentId,sourceHash:'hash-'+documentId}))};workshopFile(dir,[g]);const catalog=createMaintenanceGuideCatalog(db,{contentDir:dir});
 const shelby=catalog.detail(g.id,{engine:'5.2L'});assert.deepEqual(shelby.procedures.map(p=>p.documentId),['GClutch52','GShared']);assert.match(shelby.procedures[0].applicability.equipment,/3160/);assert.doesNotMatch(JSON.stringify(shelby.procedures),/MT82/);assert.match(shelby.procedures[1].section.title,/applicable gearbox branch/);
 const base=catalog.detail(g.id,{engine:'3.7L'});assert.match(base.procedures.find(p=>p.documentId==='GClutch37').applicability.equipment,/MT82/);assert.deepEqual(catalog.detail(g.id).procedures.find(p=>p.documentId==='GShared').engines,['3.7L','5.2L']);
});
test('procedure media overrides must belong to the exact article and reject malformed identifiers',t=>{
 const {catalog,dir}=fixture(t);
 for(const mediaId of ['G52-m1','missing','../G37-m1','',null]){
  const g=workshopGuide();g.procedures[0].mediaId=mediaId;workshopFile(dir,[g]);
  assert.equal(catalog.detail(g.id),null,String(mediaId));
  assert.ok(catalog.report().errors.some(e=>e.id===g.id&&['invalid-procedure','missing-procedure-media'].includes(e.reason)));
 }
});
test('procedure media overrides choose the bound variant and survive quality resolution without leaking provenance',t=>{
 const {db,dir}=fixture(t);
 for(const id of ['G37','G52']){
  const media=[{id:id+'-prep',url:'/media/'+id+'-prep.jpg',width:1600,height:1200,mime:'image/jpeg'},{id:id+'-main',url:'/media/'+id+'-main.jpg',width:580,height:400,mime:'image/jpeg'},{id:id+'-chosen',url:'/media/'+id+'-chosen.jpg',width:580,height:400,mime:'image/jpeg'}];
  const blocks=media.map((m,i)=>({type:'step',text:i?'Perform the oil inspection.':'Remove the underbody shield.',children:[{type:'media',mediaId:m.id}]}));
  db.prepare('UPDATE documents SET media=?,blocks=? WHERE id=?').run(JSON.stringify(media),JSON.stringify(blocks),id);
 }
 const g={...workshopGuide(),hero:null,primaryDocumentIds:['G37','G52'],applicability:{engines:['3.7L','5.2L'],years:[2015]},sourceRefs:['G37','G52'].map(documentId=>({documentId,sourceHash:'hash-'+documentId})),procedures:['G37','G52'].map(documentId=>({documentId,mediaId:documentId+'-chosen',purpose:'Use the applicable engine procedure.'}))};workshopFile(dir,[g]);
 const catalog=createMaintenanceGuideCatalog(db,{contentDir:dir,assetResolver:m=>({...m,url:m.url.replace('.jpg','-native.jpg')})});
 const all=catalog.detail(g.id);assert.deepEqual(all.procedures.map(p=>p.mediaId),['G37-chosen','G52-chosen']);
 for(const engine of ['3.7L','5.2L']){const selected=catalog.detail(g.id,{engine}),id=engine==='3.7L'?'G37':'G52';assert.equal(selected.procedures.length,1);assert.equal(selected.procedures[0].thumbnail.id,id+'-chosen');assert.equal(selected.thumbnail.id,id+'-chosen');assert.equal(selected.thumbnail.url,'/media/'+id+'-chosen-native.jpg');}
 assert.deepEqual(catalog.detail(g.id).procedures,all.procedures);assert.doesNotMatch(JSON.stringify(all),/sourceHash|sourceRefs|hash-G/);
 delete g.procedures[0].mediaId;workshopFile(dir,[g]);assert.equal(catalog.detail(g.id,{engine:'3.7L'}).procedures[0].thumbnail.id,'G37-main');
});
test('an explicitly referenced video control never becomes a procedure image',t=>{
 const {db,dir}=fixture(t);const original=JSON.parse(db.prepare('SELECT media FROM documents WHERE id=?').get('G37').media),control={id:'G37-play',url:'/media/play.png',width:580,height:400,mime:'image/png'};
 db.prepare('UPDATE documents SET media=?,blocks=? WHERE id=?').run(JSON.stringify([...original,control]),JSON.stringify([{type:'step',text:'Perform the oil inspection.',children:[{type:'media',mediaId:control.id},{type:'media',mediaId:'G37-m1'}]}]),'G37');
 fs.writeFileSync(path.join(dir,'procedure-videos.json'),JSON.stringify({version:1,documents:[{documentId:'G37',sourceHash:'hash-G37',entries:[{controlMediaId:control.id,controlUrl:control.url}]}]}));
 const g={...workshopGuide(),hero:null};g.procedures[0].mediaId=control.id;workshopFile(dir,[g]);const catalog=createMaintenanceGuideCatalog(db,{contentDir:dir});const detail=catalog.detail(g.id);
 assert.equal(detail.procedures[0].thumbnail.id,'G37-m1');assert.equal(detail.procedures[0].mediaId,undefined);assert.equal(detail.thumbnail.id,'G37-m1');
});
test('new workshop guides require bound primary procedures for every declared engine, not supporting references',t=>{
 const {db,dir}=fixture(t);db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?)').run('GShared','Jacking and Lifting','general','general','100-02','Jacking and Lifting','[]','hash-GShared','[]','[]');
 const g=workshopGuide();g.sourceRefs.push({documentId:'GShared',sourceHash:'hash-GShared'});g.procedures.push({documentId:'GShared',purpose:'Support the vehicle safely.'});
 const catalog=createMaintenanceGuideCatalog(db,{contentDir:dir});
 for(const ids of [undefined,[],['G37','G37'],['G52']]){const bad={...g,primaryDocumentIds:ids};workshopFile(dir,[bad]);assert.equal(catalog.detail(g.id),null);assert.ok(catalog.report().errors.some(e=>e.reason==='invalid-primary-procedures'));}
 g.applicability.engines=['3.7L','5.2L'];workshopFile(dir,[g]);assert.equal(catalog.detail(g.id),null);assert.ok(catalog.report().errors.some(e=>e.reason==='incompatible-primary-procedures'));assert.equal(catalog.forDocument('G37').some(x=>x.id===g.id),false);
 g.applicability.engines=['3.7L'];g.procedures[0].applicability={engines:['5.2L']};workshopFile(dir,[g]);assert.equal(catalog.detail(g.id),null);
 delete g.procedures[0].applicability;workshopFile(dir,[g]);assert.ok(catalog.detail(g.id));
 for(const engine of ['all','2.3L','3.7L','5.0L','5.2L']){const visible=['all','3.7L'].includes(engine);assert.equal(catalog.list({q:g.title,engine}).total,visible?1:0);assert.equal(catalog.forDocument('G37',{engine}).some(x=>x.id===g.id),visible);}
 assert.doesNotMatch(JSON.stringify(catalog.detail(g.id)),/primaryDocumentIds|sourceRefs|sourceHash/);assert.ok(catalog.detail('oil'));
});
test('primary engine validation uses factory brake applicability and retains distinct variant procedures',t=>{
 const {db,dir}=fixture(t);for(const[id,n]of [['GFront4',4],['GFront2',2]])db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,`Brake Caliper - Vehicles With: ${n}-Piston Brake Caliper`,'repair','brakes','206-03','Front Disc Brake','[]','hash-'+id,'[]','[]');
 const g={...workshopGuide(),hero:null,applicability:{engines:['2.3L','3.7L','5.0L','5.2L'],years:[2015]},primaryDocumentIds:['GFront4'],sourceRefs:[{documentId:'GFront4',sourceHash:'hash-GFront4'}],procedures:[{documentId:'GFront4',purpose:'Replace the fitted front four-piston caliper.'}]};
 const catalog=createMaintenanceGuideCatalog(db,{contentDir:dir});workshopFile(dir,[g]);assert.equal(catalog.detail(g.id),null);g.applicability.engines=['2.3L','5.0L'];workshopFile(dir,[g]);assert.ok(catalog.detail(g.id));assert.equal(catalog.list({engine:'3.7L',taskType:'diagnostics'}).total,0);
 g.applicability.engines.push('3.7L');g.primaryDocumentIds.push('GFront2');g.sourceRefs.push({documentId:'GFront2',sourceHash:'hash-GFront2'});g.procedures.push({documentId:'GFront2',purpose:'Replace the fitted front two-piston caliper.'});workshopFile(dir,[g]);assert.deepEqual(catalog.detail(g.id,{engine:'3.7L'}).procedures.map(p=>p.documentId),['GFront2']);
});

test('implicit workshop heroes stay within primary procedures, while a bound authored supporting hero remains available',t=>{
 const {db,dir}=fixture(t);
 db.prepare('UPDATE documents SET media=?,blocks=? WHERE id=?').run('[]','[]','G37');
 db.prepare('UPDATE documents SET engines=?,section_title=? WHERE id=?').run('["3.7L"]','Engine 3.7L','G52');
 const g={...workshopGuide(),hero:null,procedures:[{documentId:'G37',purpose:'Perform the primary check.'},{documentId:'G52',purpose:'Consult supporting oil-system information.'}],sourceRefs:['G37','G52'].map(documentId=>({documentId,sourceHash:'hash-'+documentId}))};
 workshopFile(dir,[g]);const catalog=createMaintenanceGuideCatalog(db,{contentDir:dir});
 assert.equal(catalog.detail(g.id,{engine:'3.7L'}).thumbnail,null);
 assert.equal(catalog.detail(g.id,{engine:'3.7L'}).procedures[1].thumbnail.id,'G52-m1');
 g.hero={documentId:'G52',mediaId:'G52-m1'};workshopFile(dir,[g]);
 assert.equal(catalog.detail(g.id,{engine:'3.7L'}).thumbnail.id,'G52-m1');
});

test('explicit-only guides keep unillustrated tests as icons without hiding related article links or pinned figures',t=>{
 const {catalog,dir}=fixture(t);
 const g={...workshopGuide(),thumbnailMode:'explicit-only',hero:null};workshopFile(dir,[g]);
 const detail=catalog.detail(g.id);
 assert.equal(detail.thumbnailMode,'explicit-only');assert.equal(detail.thumbnail,null);
 assert.equal(detail.procedures[0].href,'#/document/G37');assert.equal(detail.procedures[0].thumbnail,null);
 assert.equal(catalog.list({q:g.title}).items[0].thumbnail,null);
 assert.equal(catalog.forDocument('G37').find(x=>x.id===g.id).thumbnail,null);
 g.procedures[0].mediaId='G37-m1';workshopFile(dir,[g]);
 const pinned=catalog.detail(g.id);assert.equal(pinned.thumbnail,null);
 assert.equal(pinned.procedures[0].thumbnail.url,'/media/G37-native.jpg');
 assert.equal(pinned.procedures[0].mediaId,'G37-m1');
 assert.equal(catalog.detail('oil').thumbnail.id,'G37-m1');
 assert.equal(catalog.detail('oil').procedures[0].thumbnail.id,'G37-m1');
 assert.doesNotMatch(JSON.stringify(pinned),/primaryDocumentIds|sourceHash|sourceRefs|hash-G/);
});

test('explicit-only heroes stay on the authored engine variant and never fall back to a different primary illustration',t=>{
 const {catalog,dir}=fixture(t);
 const g={...workshopGuide(),thumbnailMode:'explicit-only',primaryDocumentIds:['G37','G52'],applicability:{engines:['3.7L','5.2L'],years:[2015]},sourceRefs:['G37','G52'].map(documentId=>({documentId,sourceHash:'hash-'+documentId})),procedures:['G37','G52'].map(documentId=>({documentId,purpose:'Follow the fitted-engine procedure.'}))};
 workshopFile(dir,[g]);
 assert.equal(catalog.detail(g.id).thumbnail.id,'G37-m1');
 assert.equal(catalog.detail(g.id,{engine:'3.7L'}).thumbnail.id,'G37-m1');
 assert.equal(catalog.detail(g.id,{engine:'5.2L'}).thumbnail,null);
 assert.equal(catalog.detail(g.id,{engine:'5.2L'}).procedures[0].thumbnail,null);
 assert.equal(catalog.detail(g.id).thumbnail.id,'G37-m1');
});

test('explicit-only mode rejects malformed selections and cannot replace a tiny or video-control selection with unrelated art',t=>{
 const {db,dir}=fixture(t);
 const tiny={id:'G37-tiny',url:'/media/tiny.jpg',width:99,height:99,mime:'image/jpeg'};
 const control={id:'G37-play',url:'/media/play.png',width:580,height:400,mime:'image/png'};
 const original=JSON.parse(db.prepare('SELECT media FROM documents WHERE id=?').get('G37').media);
 db.prepare('UPDATE documents SET media=? WHERE id=?').run(JSON.stringify([...original,tiny,control]),'G37');
 fs.writeFileSync(path.join(dir,'procedure-videos.json'),JSON.stringify({version:1,documents:[{documentId:'G37',sourceHash:'hash-G37',entries:[{controlMediaId:control.id,controlUrl:control.url}]}]}));
 const catalog=createMaintenanceGuideCatalog(db,{contentDir:dir});
 for(const selected of[tiny,control]){
  const g={...workshopGuide(),thumbnailMode:'explicit-only',hero:{documentId:'G37',mediaId:selected.id}};g.procedures[0].mediaId=selected.id;workshopFile(dir,[g]);
  const detail=catalog.detail(g.id);assert.ok(detail);assert.equal(detail.thumbnail,null);assert.equal(detail.procedures[0].thumbnail,null);assert.equal(detail.procedures[0].mediaId,undefined);
 }
 for(const mutate of[g=>g.thumbnailMode='icon',g=>g.thumbnailMode=null,g=>delete g.hero.mediaId,g=>g.hero.mediaId='G52-m1']){
  const g={...workshopGuide(),thumbnailMode:'explicit-only'};mutate(g);workshopFile(dir,[g]);assert.equal(catalog.detail(g.id),null);
 }
});

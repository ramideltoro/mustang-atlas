import test from 'node:test';
import assert from 'node:assert/strict';
import {maintenancePagination,relatedWorkshopGuides,WORKSHOP_DIFFICULTIES,maintenanceFilters,maintenanceFacetOptions,guideWhenTitle,guideClassifications,maintenanceQuery,maintenanceHref,maintenanceMismatch,maintenanceLink,guideOutline,distanceLabel} from './maintenance-hub-model.mjs';

test('maintenance search preserves the chosen engine and encodes component searches safely',()=>{
 const query=new URLSearchParams(maintenanceQuery({engine:'3.7L',q:' oil & filter ',category:'fluids',offset:-24}));
 assert.equal(query.get('engine'),'3.7L');assert.equal(query.get('q'),'oil & filter');assert.equal(query.get('category'),'fluids');assert.equal(query.get('year'),'2015');assert.equal(query.get('offset'),'0');
 assert.equal(new URLSearchParams(maintenanceQuery()).get('engine'),'all');
 assert.equal(maintenanceFilters(new URLSearchParams({offset:'Infinity'})).offset,0);
 assert.equal(new URLSearchParams(maintenanceQuery({offset:1.5})).get('offset'),'1');
 const href=maintenanceHref({q:'oil & filter',category:'fluids',offset:24});
 const params=new URLSearchParams(href.split('?')[1]);assert.equal(params.get('q'),'oil & filter');assert.equal(params.get('offset'),'24');assert.equal(params.has('engine'),false);
});
test('explicit schedule and guide mismatches never count as usable selected-engine guidance',()=>{
 assert.equal(maintenanceMismatch({matchesSelectedEngine:false,matchesSelectedYear:true}),true);
 assert.equal(maintenanceMismatch({matchesSelectedEngine:true,matchesSelectedYear:false}),true);
 assert.equal(maintenanceMismatch({matchesSelectedEngine:true,matchesSelectedYear:true}),false);
 assert.equal(maintenanceMismatch(undefined),false);
});
test('care and repair links remain internal and reject external or executable targets',()=>{
 assert.equal(maintenanceLink({guideId:'oil-service'}),'#/maintenance/oil-service');
 assert.equal(maintenanceLink({href:'#/document/G1685315'}),'#/document/G1685315');
 assert.equal(maintenanceLink({documentId:'G1685315'}),'#/document/G1685315');
 assert.equal(maintenanceLink({href:'javascript:alert(1)'}),null);
 assert.equal(maintenanceLink({href:'https://example.com/service'}),null);
 assert.equal(maintenanceLink({href:'https://example.com/service',guideId:'oil-service'}),'#/maintenance/oil-service');
});
test('guide navigation exposes available substantive sections and does not invent missing actions',()=>{
 const guide={when:{summary:'At the oil-life message.'},introduction:'A clear purpose.',why:'Lubrication matters.',prepare:[],steps:[],watchFor:[{title:'Leak',body:'Inspect for leaks.'}],notes:[],procedures:[{documentId:'G1',title:'Oil filter overview'}]};
 assert.deepEqual(guideOutline(guide).map(item=>item.id),['when','understand','why','watch-for','repair-guides']);
 assert.equal(guideOutline(guide).at(-1).title,'Related workshop articles');
 assert.deepEqual(guideOutline(null),[]);
});

test('schedule distance ranges preserve supplied units and never duplicate or convert them',()=>{
 assert.equal(distanceLabel('7,000–10,000 mi','miles'),'7,000–10,000 mi');
 assert.equal(distanceLabel('11,000–16,000 km','km'),'11,000–16,000 km');
 assert.equal(distanceLabel('7,500–10,000','miles'),'7,500–10,000 miles');
 assert.equal(distanceLabel('16,000 kilometers','km'),'16,000 kilometers');
});

test('combined workshop filters survive pagination, guide navigation and return links without overriding global engine',()=>{
 const filters=maintenanceFilters(new URLSearchParams({q:"window won't close",system:'body',taskType:'diagnostics',difficulty:'intermediate',category:'advanced',offset:'24'}));
 const query=new URLSearchParams(maintenanceQuery({...filters,engine:'5.0L'}));
 for(const key of ['q','system','taskType','difficulty','category'])assert.equal(query.get(key),filters[key]);
 assert.equal(query.get('engine'),'5.0L');assert.equal(query.get('limit'),'24');
 const guideLink=maintenanceHref({...filters,id:'window-check'}),back=maintenanceHref(maintenanceFilters(new URLSearchParams(guideLink.split('?')[1])));
 assert.ok(guideLink.startsWith('#/maintenance/window-check?'));
 assert.equal(back,maintenanceHref(filters));assert.equal(new URLSearchParams(back.split('?')[1]).has('engine'),false);
 assert.equal(new URLSearchParams(maintenanceHref({...filters,system:'',offset:0}).split('?')[1]).has('system'),false);
 assert.equal(new URLSearchParams(maintenanceHref({...filters,system:'',offset:0}).split('?')[1]).get('taskType'),'diagnostics');
});

test('workshop facet choices retain a selected zero-result filter instead of misrepresenting it as All',()=>{
 const options=maintenanceFacetOptions([{id:'basic',title:'Basic',count:3}],WORKSHOP_DIFFICULTIES,'specialist');
 assert.deepEqual(options.at(-1),{id:'specialist',title:'Specialist',count:0});
 assert.equal(maintenanceFacetOptions([],WORKSHOP_DIFFICULTIES,'').length,0);
 assert.equal(maintenanceFacetOptions(undefined,WORKSHOP_DIFFICULTIES,'').length,4);
});

test('diagnostic guidance and verification appear in reading order only when content exists',()=>{
 const guide={taskType:'repair',when:{summary:'When a seal leaks.'},steps:[{title:'Inspect',body:'Find the leak.'}],diagnostics:[{finding:'Wet seam',meaning:'Possible leak',next:'Clean and recheck.'}],verification:[{title:'Confirm',body:'Recheck after repair.'}]};
 assert.equal(guideWhenTitle(guide),'When this job makes sense');
 assert.equal(guideWhenTitle({taskType:'maintenance'}),'When to do it');
 assert.deepEqual(guideOutline(guide).map(item=>item.id),['when','steps','diagnostic-decisions','verify-results']);
 assert.equal(guideOutline(guide)[0].title,guideWhenTitle(guide));
 assert.deepEqual(guideOutline({diagnostics:[],verification:[]}),[]);
 assert.deepEqual(guideClassifications({systemId:'cooling',taskType:'diagnostics',difficulty:'specialist'}).map(item=>item.title),['Cooling','Diagnostics','Specialist']);
 assert.deepEqual(guideClassifications({systemId:'unknown',taskType:'unknown',difficulty:'unknown'}),[]);
});

test('article guide panels remain absent for empty or invalid payloads and keep unique valid cards',()=>{
 assert.deepEqual(relatedWorkshopGuides(undefined),[]);assert.deepEqual(relatedWorkshopGuides({items:[]}),[]);assert.deepEqual(relatedWorkshopGuides([null,{id:'bad'},{id:'blank',title:' '}]),[]);
 const first={id:'cooling-check',title:'Check coolant',taskType:'maintenance'};assert.deepEqual(relatedWorkshopGuides([first,{...first,title:'duplicate'},{id:'pressure-test',title:'Pressure test',taskType:'diagnostics'}]),[first,{id:'pressure-test',title:'Pressure test',taskType:'diagnostics'}]);
 assert.equal(relatedWorkshopGuides(Array.from({length:12},(_,i)=>({id:'guide-'+i,title:'Guide '+i}))).length,8);
});


test('large catalogs keep pages bounded and recover obsolete or unaligned offsets without losing the last page',()=>{
 assert.deepEqual(maintenancePagination(900,888),{offset:888,page:38,pages:38,previousOffset:864,nextOffset:888});
 assert.deepEqual(maintenancePagination(31,888),{offset:24,page:2,pages:2,previousOffset:0,nextOffset:24});
 assert.deepEqual(maintenancePagination(0,240),{offset:0,page:1,pages:1,previousOffset:0,nextOffset:0});
 assert.equal(maintenancePagination(900,25).offset,24);
 assert.equal(maintenancePagination(900,-1).offset,0);
});

test('special repairs expose their visual and online reading in the guide navigation',()=>{
 const guide={prepare:[{}],visualGuide:'v6-37-head-gasket',steps:[{}],procedures:[{}],references:[{url:'https://example.com'}]};
 assert.deepEqual(guideOutline(guide).map(x=>x.id),['gasket-location','prepare','visual-guide','steps','repair-guides','online-references']);
});

test('grouped walkthrough navigation points to the access and replacement sections without a detached bolt lesson',()=>{
 const guide={visualGuide:'v6-37-head-gasket',visualGuideStep:23,steps:[{}],stepGroups:[{id:'access-head-gasket',title:'How to get to the head gasket'},{id:'replace-head-gasket',title:'Remove the cylinder head and replace the head gasket'}]};
 assert.deepEqual(guideOutline(guide).map(x=>x.id),['gasket-location','access-head-gasket','replace-head-gasket']);
});

test('timing repair navigation exposes its own visual and access phases without head-bolt links',()=>{
 const outline=guideOutline({visualGuide:'v6-37-timing-chain',steps:[{},{}],stepGroups:[{id:'access-timing-chain',title:'How to get to the timing chain',start:1,end:1},{id:'fit-primary-chain',title:'Fit the primary chain',start:2,end:2}]});
 assert.deepEqual(outline.map(x=>x.id),['timing-drive','access-timing-chain','fit-primary-chain']);assert.equal(outline.some(x=>/head|bolt/i.test(x.title)),false);
});

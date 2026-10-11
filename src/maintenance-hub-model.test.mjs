import test from 'node:test';
import assert from 'node:assert/strict';
import {maintenanceQuery,maintenanceHref,maintenanceMismatch,maintenanceLink,guideOutline,distanceLabel} from './maintenance-hub-model.mjs';

test('maintenance search preserves the chosen engine and encodes component searches safely',()=>{
 const query=new URLSearchParams(maintenanceQuery({engine:'3.7L',q:' oil & filter ',category:'fluids',offset:-24}));
 assert.equal(query.get('engine'),'3.7L');assert.equal(query.get('q'),'oil & filter');assert.equal(query.get('category'),'fluids');assert.equal(query.get('year'),'2015');assert.equal(query.get('offset'),'0');
 assert.equal(new URLSearchParams(maintenanceQuery()).get('engine'),'all');
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

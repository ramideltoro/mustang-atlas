import test from 'node:test';
import assert from 'node:assert/strict';
import { rankWorkshopMedia, selectWorkshopThumbnail } from '../server/workshop-media.mjs';
const m = (id, width=580, height=400) => ({id,url:'/media/'+id.padEnd(64,'a')+'.jpg',width,height,mime:'image/jpeg'});
const doc = (title, blocks, media) => ({id:'GTEST',title,kind:'workshop',blocks,media});
test('workshop ranking prefers the actual oil cooler over a larger prerequisite shield',()=>{
 const d=doc('Oil Cooler',[{type:'step',text:'Remove the underbody shield.',children:[{type:'media',mediaId:'shield'}]},{type:'step',text:'Remove the retainer and the oil cooler.',children:[{type:'media',mediaId:'cooler'}]}],[m('shield',1600,1600),m('cooler')]);
 assert.equal(rankWorkshopMedia(d)[0].id,'cooler');assert.equal(selectWorkshopThumbnail(d).id,'cooler');
});
test('prerequisite reference titles do not count as main-component figure context',()=>{
 const d=doc('Engine Front Cover',[{type:'step',text:'Remove the support bracket.\nRefer to: Engine Front Cover (303-01).',children:[{type:'media',mediaId:'bracket'}]},{type:'step',text:'Install the engine front cover and bolts.',children:[{type:'media',mediaId:'cover'}]}],[m('bracket'),m('cover')]);
 assert.equal(rankWorkshopMedia(d)[0].id,'cover');assert.equal(rankWorkshopMedia(d).find(x=>x.id==='bracket').matchedTerms.length,0);
});
test('nested and immediately following figures inherit their direct action context',()=>{
 const d=doc('Cooling Fan Motor and Shroud',[{type:'step',text:'Position the degas bottle aside.',children:[{type:'media',mediaId:'bottle'}]},{type:'step',text:'Remove the cooling fan motor and shroud.',children:[{type:'step',text:'Remove the bolts.',children:[{type:'media',mediaId:'fan'}]}]},{type:'step',text:'Install the cooling fan motor and shroud.',children:[]},{type:'media',mediaId:'fan2'}],[m('bottle'),m('fan'),m('fan2')]);
 assert.deepEqual(rankWorkshopMedia(d).slice(0,2).map(x=>x.id).sort(),['fan','fan2']);
});
test('tiny tools and unrelated preparation do not become a workshop hero',()=>{
 const d=doc('Oil Cooler',[{type:'step',text:'Remove the underbody shield.',children:[{type:'media',mediaId:'shield'}]},{type:'step',text:'Install the oil cooler special tool.',children:[{type:'media',mediaId:'tool'}]}],[m('shield'),m('tool',99,80)]);
 assert.equal(selectWorkshopThumbnail(d),null);
});
test('a following illustration belongs to an empty parent with real nested actions',()=>{
 const d=doc('Oil Cooler',[{type:'step',text:'Remove the underbody shield.',children:[]},{type:'step',text:'',children:[{type:'paragraph',text:'Remove the oil cooler.'},{type:'list',items:[{type:'list-item',text:'Remove the retainer.',children:[]}]}]},{type:'media',mediaId:'cooler'}],[m('cooler')]);
 const [chosen]=rankWorkshopMedia(d);assert.equal(chosen.id,'cooler');assert.match(chosen.selectionContext,/Remove the oil cooler/);assert.doesNotMatch(chosen.selectionContext,/underbody/);assert.ok(chosen.score>100);
});
test('the main component outranks its earlier fastener or adjacent trim illustration',()=>{
 const d=doc('Rear Quarter Window Glass - Convertible',[{type:'step',text:'Remove the rear quarter window glass interior belt moulding.',children:[{type:'media',mediaId:'moulding'}]},{type:'step',text:'Remove the bolts and the rear quarter window glass.',children:[{type:'media',mediaId:'glass'}]}],[m('moulding'),m('glass')]);
 assert.equal(rankWorkshopMedia(d)[0].id,'glass');
 const mount=doc('Engine Mount LH',[{type:'step',text:'Remove the LH engine mount nut.',children:[{type:'media',mediaId:'nut'}]},{type:'step',text:'Remove the bolts and the engine mount.',children:[{type:'media',mediaId:'mount'}]}],[m('nut'),m('mount')]);
 assert.equal(rankWorkshopMedia(mount)[0].id,'mount');
});
test('an unexplained image-only action does not inherit the previous action as invented context',()=>{
 const d=doc('Oil Cooler',[{type:'step',text:'Remove the oil cooler.',children:[]},{type:'step',number:2,text:'',children:[]},{type:'media',mediaId:'unexplained'}],[m('unexplained')]);
 assert.equal(rankWorkshopMedia(d)[0].selectionContext,'');assert.equal(selectWorkshopThumbnail(d),null);
});
test('component removal outranks an attachment point named after from or access to',()=>{
 const d=doc('Radiator',[{type:'step',text:'Remove the bolt and separate the CAC from the radiator.',children:[{type:'media',mediaId:'cac'}]},{type:'step',text:'Remove the radiator and the CAC.',children:[{type:'media',mediaId:'radiator'}]}],[m('cac'),m('radiator')]);
 assert.equal(rankWorkshopMedia(d)[0].id,'radiator');
 const cable=doc('Convertible Top Tension Cable',[{type:'step',text:'Position the convertible top material up for access to remove the convertible top tension cable.',children:[{type:'media',mediaId:'roof'}]},{type:'step',text:'Remove the convertible top tension cable.',children:[{type:'media',mediaId:'cable'}]}],[m('roof'),m('cable')]);
 assert.equal(rankWorkshopMedia(cable)[0].id,'cable');
});
test('a component beats its noise cover and preserves omitted direction or variant qualifiers',()=>{
 const pump=doc('High-Pressure Fuel Pump',[{type:'step',text:'Remove the high-pressure fuel pump noise insulator.',children:[{type:'media',mediaId:'cover'}]},{type:'step',text:'Remove and discard the high-pressure fuel pump bolts and then remove the high-pressure fuel pump.',children:[{type:'media',mediaId:'pump'}]}],[m('cover'),m('pump')]);assert.equal(rankWorkshopMedia(pump)[0].id,'pump');
 const lamp=doc('Front Fog Lamp',[{type:'step',text:'Disconnect the front fog lamp electrical connector.',children:[{type:'media',mediaId:'connector'}]},{type:'step',text:'Remove the screws and the fog lamp assembly.',children:[{type:'media',mediaId:'lamp'}]}],[m('connector'),m('lamp')]);assert.equal(rankWorkshopMedia(lamp)[0].id,'lamp');
 const knuckle=doc('Wheel Knuckle - Vehicles With: SVT Performance Package',[{type:'step',text:'Disconnect the tie rod end from the wheel knuckle.',children:[{type:'media',mediaId:'tie'}]},{type:'step',text:'Remove the wheel knuckle.',children:[{type:'media',mediaId:'knuckle'}]}],[m('tie'),m('knuckle')]);assert.equal(rankWorkshopMedia(knuckle)[0].id,'knuckle');
});

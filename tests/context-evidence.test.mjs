import test from 'node:test';
import assert from 'node:assert/strict';
import {selectContextOverviews,selectContextTerms} from '../scripts/context-evidence.mjs';

const doc=(id,title,system,section,kind='overview',extra={})=>({id,title,system_id:system,section_code:section,section_title:section,kind,engines:[],text:'',...extra});
test('evidence uses source sections before superficially similar words from unrelated components',()=>{
  const bcm=doc('BCM','Body Control Module (BCM)','electrical','419-10','repair');
  const related=doc('MULTI','Multifunction Electronic Modules - Overview','electrical','419-10');
  const wrong=[doc('VALVE','Main Control Valve Body','transmission','307-01'),doc('FRAME','Body and Frame','body','501-26')];
  assert.deepEqual(selectContextOverviews([bcm],[...wrong,related]),[related]);
  const charging=doc('CHARGE','Charging System','electrical','414-00','repair');
  assert.deepEqual(selectContextOverviews([charging],[doc('FUEL','Fuel Charging and Controls - Component Location','engine','303-04')]),[]);
  const safety=doc('SAFETY','Safety Precautions','suspension','204-04','general');
  assert.deepEqual(selectContextOverviews([safety],[doc('BATTERY','Battery and Battery Charging Health and Safety Precautions','general','100-00')]),[]);
});
test('connectors can find a full component phrase across index categories without matching generic body or module fragments',()=>{
  const connector=doc('connector-C1651','C1651 — ACTIVE GRILLE SHUTTER','electrical','Connector views','connector');
  const shutter=doc('GRILLE','Active Grille Shutter - Overview','body','501-02');
  assert.deepEqual(selectContextOverviews([connector],[shutter]),[shutter]);
  const bcm=doc('connector-C2280A','C2280A — BODY CONTROL MODULE (BCM)','electrical','Connector views','connector');
  const moduleOverview=doc('MULTI','Multifunction Electronic Modules - System Operation and Component Description','electrical','419-10','overview',{text:'The body control module communicates on the vehicle network.'});
  const moduleRepair=doc('BCM','Body Control Module (BCM)','electrical','419-10','repair');
  const frame=doc('FRAME','Body and Frame','body','501-26');
  assert.deepEqual(selectContextOverviews([bcm],[frame,moduleOverview]),[],'an incidental mention is not enough to establish primary evidence');
  assert.deepEqual(selectContextOverviews([bcm],[frame,moduleOverview,moduleRepair]),[moduleOverview]);
  assert.deepEqual(selectContextOverviews([doc('INLINE','C300 — BODY TO MAIN HARNESS','electrical','Connector views','connector')],[frame]),[]);
});
test('evidence does not borrow a different engine or transmission variant for a shared introduction',()=>{
  const manual=doc('MT','Transmission','transmission','308-03','repair',{section_title:'Manual Transmission - MT82'});
  const automatic=doc('AT','Transmission - Overview','transmission','307-01','overview',{section_title:'Automatic Transmission - 6R80'});
  assert.deepEqual(selectContextOverviews([manual],[automatic]),[]);
  const low=doc('LOW','Oil Pan','engine','303-01A','repair',{engines:['2.3L']});
  const high=doc('HIGH','Oil Pan','engine','303-01C','repair',{engines:['5.0L']});
  const lowOverview=doc('LOWVIEW','Engine - Overview','engine','303-01A','overview',{engines:['2.3L']});
  assert.deepEqual(selectContextOverviews([high],[lowOverview]),[]);
  assert.deepEqual(selectContextOverviews([low,high],[lowOverview]),[]);
  assert.deepEqual(selectContextOverviews([low],[lowOverview]),[lowOverview]);
});
test('glossary selection honors category and section restrictions and full curated aliases',()=>{
  const terms=[
    {id:'ring-gear',name:'Ring gear',aliases:[],matchCategories:['driveline']},
    {id:'piston',name:'Piston',aliases:[],matchCategories:['engine']},
    {id:'control-arm',name:'Control arm',aliases:['arm'],matchCategories:['suspension']},
    {id:'clutch-disc',name:'Clutch disc',aliases:['friction disc'],matchCategories:['transmission'],matchSectionContains:['manual transmission','clutch'],excludeSectionContains:['automatic transmission','6R80']},
    {id:'brake-caliper',name:'Brake caliper',aliases:['caliper'],matchCategories:['brakes']},
  ];
  assert.deepEqual(selectContextTerms([doc('START','Starter Motor Drive Gear and Flywheel Ring Gear Inspection','engine','303-06','repair')],terms),[]);
  assert.deepEqual(selectContextTerms([doc('BRAKE','Brake Caliper - Vehicles With: 4-Piston Brake Caliper','brakes','206-03','repair')],terms).map(t=>t.id),['brake-caliper']);
  assert.deepEqual(selectContextTerms([doc('DOOR','Front Door Check Arm','body','501-03','repair')],terms),[]);
  assert.deepEqual(selectContextTerms([doc('WIPER','Windshield Wiper Pivot Arm','suspension','Suspension','repair')],terms),[]);
  assert.deepEqual(selectContextTerms([doc('AUTO','Clutch Disc','transmission','Automatic Transmission - 6R80','repair')],terms),[]);
  assert.deepEqual(selectContextTerms([doc('MANUAL','Clutch Disc','transmission','Manual Transmission - MT82','repair')],terms).map(t=>t.id),['clutch-disc']);
});
test('wiring cruise labels override broad chapter titles without confusing WITHOUT with adaptive',()=>{
  const conventional=doc('NORMAL','Cruise Control - System Operation and Component Description','electrical','419-03A','overview',{section_title:'Cruise Control'});
  const adaptive=doc('ADAPTIVE','Cruise Control - System Operation and Component Description','electrical','419-03B','overview',{section_title:'Cruise Control - Vehicles With: Adaptive Cruise Control'});
  const wiring=text=>doc('wiring-031-006','Cruise Control — diagram 6','electrical','031','wiring',{section_title:'Cruise Control',text});
  assert.deepEqual(selectContextOverviews([wiring('C1582\nPROXIMITY WARNING RADAR UNIT\nADAPTIVE CRUISE')],[conventional,adaptive]),[adaptive]);
  assert.deepEqual(selectContextOverviews([wiring('STEERING WHEEL SWITCH\nWITHOUT ADAPTIVE CRUISE')],[conventional,adaptive]),[conventional]);
  assert.deepEqual(selectContextOverviews([wiring('BRAKE SWITCH\nPOWERTRAIN CONTROL MODULE')],[conventional,adaptive]),[],'a common chapter does not establish conventional-only applicability');
  assert.deepEqual(selectContextOverviews([wiring('WITHOUT ADAPTIVE CRUISE\nADAPTIVE CRUISE')],[conventional,adaptive]),[],'a mixed sheet must not be assigned one equipment variant');
});
test('connector radar uses its exact workshop component alias without matching generic proximity sensors',()=>{
  const radar=doc('connector-C1582','C1582 — PROXIMITY WARNING RADAR UNIT','electrical','Connector views','connector');
  const workshopRadar=doc('RADAR','Cruise Control Module (CCM)','electrical','419-03B','repair');
  const adaptive=doc('ADAPTIVE','Cruise Control - System Operation and Component Description','electrical','419-03B','overview',{section_title:'Cruise Control - Vehicles With: Adaptive Cruise Control'});
  const conventional=doc('NORMAL','Cruise Control - Overview','electrical','419-03A','overview',{section_title:'Cruise Control'});
  assert.deepEqual(selectContextOverviews([radar],[conventional,adaptive,workshopRadar]),[adaptive]);
  assert.deepEqual(selectContextOverviews([doc('OTHER','C123 — PROXIMITY SENSOR','electrical','Connector views','connector')],[conventional,adaptive,workshopRadar]),[]);
});
test('an adaptive label does not pull cruise evidence into another system chapter',()=>{
  const network=doc('wiring-014-006','Module Communications Network — diagram 6','electrical','014','wiring',{section_title:'Module Communications Network',text:'HS2 CAN\nADAPTIVE CRUISE'});
  const networkOverview=doc('NETWORK','Module Communications Network - Overview','electrical','418-00','overview',{section_title:'Module Communications Network'});
  const adaptive=doc('ADAPTIVE','Cruise Control - System Operation and Component Description','electrical','419-03B','overview',{section_title:'Cruise Control - Vehicles With: Adaptive Cruise Control'});
  assert.deepEqual(selectContextOverviews([network],[adaptive,networkOverview]),[networkOverview]);
});
test('workshop cruise overviews never fill a spare evidence slot with the opposite variant',()=>{
  const normal=doc('NORMAL','Cruise Control - Overview','electrical','419-03A','overview',{section_title:'Cruise Control'});
  const normalOperation=doc('NORMAL_OP','Cruise Control - System Operation and Component Description','electrical','419-03A','overview',{section_title:'Cruise Control'});
  const adaptive=doc('ADAPTIVE','Cruise Control - Overview','electrical','419-03B','overview',{section_title:'Cruise Control - Vehicles With: Adaptive Cruise Control'});
  const adaptiveOperation=doc('ADAPTIVE_OP','Cruise Control - System Operation and Component Description','electrical','419-03B','overview',{section_title:'Cruise Control - Vehicles With: Adaptive Cruise Control'});
  const all=[normal,normalOperation,adaptive,adaptiveOperation];
  assert.deepEqual(selectContextOverviews([normal],all),[normalOperation]);
  assert.deepEqual(selectContextOverviews([adaptive],all),[adaptiveOperation]);
  const switches=['419-03A','419-03B'].map(section=>doc(section,'Cruise Control Deactivator Switch','electrical',section,'repair'));
  assert.deepEqual(selectContextOverviews(switches,all),[],'a common physical part must not inherit one system variant as universal');
});

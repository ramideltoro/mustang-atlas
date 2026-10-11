import test from 'node:test';
import assert from 'node:assert/strict';
import {hasTorqueValue,torqueSegments,torqueTable,torqueLineKind} from './torque-spec.mjs';

test('brake-booster bolt and nut labels stay with their exact torque values',()=>{
 const text='Remove the 5 bolts, 4 nuts and the cowl extension.\nTorque:\nBolts:\n\n26 lb.ft (35 Nm)\nNuts:\n\n41 lb.ft (55 Nm)';
 const result=torqueSegments(text);
 assert.equal(result.map(segment=>segment.text).join(''),text);
 assert.deepEqual(result.map(segment=>segment.torque),[false,true]);
 assert.equal(result[1].text,'Torque:\nBolts:\n\n26 lb.ft (35 Nm)\nNuts:\n\n41 lb.ft (55 Nm)');
});
test('all tightening, loosening and angle stages remain ordered inside one specification',()=>{
 const text='Install a new spindle nut.\nTorque:\nStage 1:\n184 lb.ft (250 Nm)\nStage 2:\nLoosen: 90°\nStage 3:\n85 lb.ft (115 Nm)\nStage 4:\n30°\nInspect the hub.';
 const result=torqueSegments(text);
 assert.equal(result.map(segment=>segment.text).join(''),text);
 assert.deepEqual(result.map(segment=>segment.torque),[false,true,false]);
 for(const value of ['Stage 1:\n184 lb.ft (250 Nm)','Stage 2:\nLoosen: 90°','Stage 3:\n85 lb.ft (115 Nm)','Stage 4:\n30°'])assert(result[1].text.includes(value));
 assert.equal(result.at(-1).text,'Inspect the hub.');
});
test('unit variants and decimal ranges highlight without conversion; other measurements do not',()=>{
 for(const text of ['Torque: 20 lb.ft (27.5 Nm)','71 lb.in (8 Nm)','2–3 N·m','12 N*m','18 ft-lb','20 in-lbs','27 newton-meters','4 pound-feet'])assert(hasTorqueValue(text),text);
 for(const text of ['Fill with 5.7 L.','Check at 35 psi.','Pressure: 220 kPa','Torque converter operation','Turn the steering wheel 90°.','Check 12 V at terminal 2.'])assert.equal(torqueSegments(text).some(segment=>segment.torque),false,text);
 assert.equal(torqueLineKind('Stage 2:'),'stage');assert.equal(torqueLineKind('Loosen: 90°'),'value');assert.equal(torqueLineKind('Bolts:'),'label');
});
test('torque specification tables preserve unit columns and staged tables while other tables stay ordinary',()=>{
 const rows=[['Item','Nm','lb-ft','lb-in'],['Screw','1.5','1.1','13'],['Mount','—','—','—']].map(cells=>({cells:cells.map(text=>({text}))}));
 const copy=structuredClone(rows);assert.deepEqual(torqueTable(rows),{active:true,columns:[1,2,3],stages:false});assert.deepEqual(rows,copy);
 assert.deepEqual(torqueTable([[{text:'Stage'},{text:'Action'}],[{text:'1'},{text:'Tighten to 103 lb.ft (140 Nm)'}],[{text:'2'},{text:'Loosen 360°'}],[{text:'3'},{text:'Tighten a further 90°'}]]),{active:true,columns:[],stages:true});
 for(const headers of [['Fluid','Capacity'],['Circuit','Voltage'],['Item','Pressure'],['Step','Angle']])assert.equal(torqueTable([headers.map(text=>({text}))]).active,false);
});

// Topic illustrations are conceptual covers, never substitutes for repair diagrams.
const rules=[
 ['compression',/compression|leak.?down|cylinder pressure/i,'Cylinder pressure testing'],
 ['oil',/oil|lubricat|dipstick/i,'Engine lubrication'],
 ['filter',/air cleaner|airbox|air filter|cabin filter/i,'Air filtration'],
 ['wiper',/wip|washer/i,'Wipers and washers'],
 ['battery',/battery|charg|alternator|generator/i,'Battery and charging'],
 ['brake',/brak|caliper|ABS|bleed/i,'Brake system'],
 ['clutch',/clutch|flywheel/i,'Clutch and flywheel'],
 ['wheel',/tire|tyre|wheel|TPMS/i,'Wheels and tires'],
 ['suspension',/suspension|damper|strut|spring|shock|stabilizer/i,'Suspension'],
 ['steering',/steer|EPAS/i,'Steering'],
 ['cooling',/cool|radiator|thermostat|water pump/i,'Cooling system'],
 ['fuel',/fuel|injector|EVAP|evaporat/i,'Fuel delivery'],
 ['airflow',/turbo|intake|throttle|intercool|charge air/i,'Engine airflow'],
 ['timing',/camshaft|timing|valve train|valvetrain|tappet/i,'Valve timing'],
 ['belt',/belt|pulley|tensioner|accessory drive/i,'Accessory drive'],
 ['ignition',/spark|ignition|misfire/i,'Ignition'],
 ['exhaust',/exhaust|cataly/i,'Exhaust system'],
 ['transmission',/transmission|gearbox|shift|6R80|MT82|TR.?3160/i,'Transmission'],
 ['driveline',/driveline|axle|differential|driveshaft|halfshaft/i,'Driveline'],
 ['climate',/climate|air conditioning|HVAC|blower|heater|refrigerant/i,'Cabin climate'],
 ['lighting',/lamp|light|illumination/i,'Lighting'],
 ['connector',/connector|pigtail|terminal|pinpoint|wiring/i,'Electrical connections'],
 ['restraints',/restraint|airbag|air bag|pretension|pyrotechnic/i,'Safety restraints'],
 ['body',/body|door|window|glass|trim|paint|seat|mirror|roof/i,'Body and interior'],
 ['diagnosis',/diagnos|trouble code|DTC|noise|vibration|harshness/i,'Diagnostic checks'],
 ['schedule',/schedule|maintenance|service interval/i,'Scheduled care'],
 ['engine',/engine|crankshaft|piston|cylinder|head gasket/i,'Engine mechanics'],
 ['electrical',/electr|circuit|module|sensor|network|PCM|BCM|audio|radio/i,'Electrical systems'],
 ['safety',/safety|precaution|lift|jack|hoist/i,'Workshop preparation'],
];
const systemTopics={general:'safety',engine:'engine',cooling:'cooling',fuel:'fuel',transmission:'transmission',driveline:'driveline',suspension:'suspension',steering:'steering',brakes:'brake',electrical:'electrical',climate:'climate',body:'body',restraints:'restraints'};
export function thumbnailTopic(item={}){
 const title=String(item.title||'');
 const section=typeof item.section==='object'?item.section?.title:item.section_title||item.section||'';
 const match=rules.find(([,pattern])=>pattern.test(title))||rules.find(([,pattern])=>pattern.test(String(section)));
 const id=match?.[0]||systemTopics[item.systemId||item.system_id||item.system]||'safety';
 return {id,label:rules.find(r=>r[0]===id)[2]};
}
export function editorialThumbnail(item){const {id,label}=thumbnailTopic(item);return {id:'atlas-cover-'+id,url:'/thumbnails/'+id+'.svg',width:800,height:500,mime:'image/svg+xml',kind:'editorial-illustration',caption:label+' — conceptual illustration',alt:label+' — original Atlas illustration',generated:true};}
export const THUMBNAIL_TOPICS=rules.map(([id,,label])=>({id,label}));

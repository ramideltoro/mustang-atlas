export const SYSTEMS = [
 ['general','General information','Vehicle identification, safe workshop practices, maintenance and specifications.'],
 ['engine','Engine','Engine mechanical systems, intake, ignition and exhaust.'],
 ['cooling','Engine cooling','Coolant circulation, radiator, thermostat and cooling fans.'],
 ['fuel','Fuel system','Fuel delivery, tank, evaporative emissions and controls.'],
 ['transmission','Transmission and clutch','Manual and automatic transmissions, clutch and shift controls.'],
 ['driveline','Driveline','Driveshaft, axle, differential and wheel-end power delivery.'],
 ['suspension','Suspension and wheels','Front and rear suspension, wheels, tires and alignment.'],
 ['steering','Steering','Steering gear, column, assist and steering controls.'],
 ['brakes','Brakes','Hydraulic brakes, parking brake and anti-lock braking controls.'],
 ['electrical','Electrical and electronics','Power distribution, starting, charging, communication, lighting and wiring.'],
 ['climate','Heating and air conditioning','Climate controls, refrigerant, heater and cabin airflow.'],
 ['body','Body and interior','Body panels, trim, glass, seats, locks and paint.'],
 ['restraints','Safety restraints','Airbags, safety belts and restraint control systems.'],
].map(([id,title,description])=>({id,title,description}));
export function classifySystem(section, title='', kind='') {
 const s=`${section} ${title}`.toLowerCase();
 const code=String(section).match(/\b(\d{3}-\d{2}[A-Z]?)/)?.[1]||'';
 for(const [prefix,system] of [['211','steering'],['204','suspension'],['205','driveline'],['206','brakes'],['307','transmission'],['308','transmission'],['412','climate'],['501-20','restraints'],['501','body'],['502','body'],['303-03','cooling'],['310','fuel'],['303','engine'],['100','general'],['414','electrical'],['413','electrical'],['415','electrical'],['417','electrical'],['418','electrical'],['419','electrical']])if(code.startsWith(prefix))return system;
 if (/restraint|airbag|air bag|safety belt/.test(s)) return 'restraints';
 if (/climate|air conditioning|heating|refrigerant|hvac/.test(s)) return 'climate';
 if (/cooling|radiator|coolant/.test(s)) return 'cooling';
 if (/fuel|evaporative/.test(s)) return 'fuel';
 if (/transmission|clutch/.test(s)) return 'transmission';
 if (/driveshaft|drive shaft|differential|drive axle|halfshaft/.test(s)) return 'driveline';
 if (/suspension|wheel|tire|alignment/.test(s)) return 'suspension';
 if (/steering/.test(s)) return 'steering';
 if (/brake|anti-lock/.test(s)) return 'brakes';
 if (/engine|ignition|intake|exhaust|emission|accessory drive/.test(s)) return 'engine';
 if (/electrical|wiring|connector|battery|charging|starting|lighting|audio|instrument|communication|network|module|horn|wiper|anti-theft/.test(s) || kind==='wiring'||kind==='connector') return 'electrical';
 if (/body|paint|trim|glass|seat|roof|door|mirror|lock|window|bumper|hood|convertible/.test(s)) return 'body';
 return 'general';
}
export function detectEngines(text) { return [...new Set((String(text).match(/\b(?:2\.3|3\.7|5\.0|5\.2)\s*L\b/gi)||[]).map(s=>s.replace(/\s/g,'').toUpperCase()))]; }

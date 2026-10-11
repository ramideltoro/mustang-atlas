export const ENGINES = [
  {value:'',label:'All engines',shortLabel:'All engines'},
  {value:'2.3L',label:'2.3L EcoBoost',shortLabel:'2.3L EcoBoost'},
  {value:'3.7L',label:'3.7L V6',shortLabel:'3.7L V6'},
  {value:'5.0L',label:'5.0L V8 GT',shortLabel:'5.0L GT'},
  {value:'5.2L',label:'5.2L V8 Shelby',shortLabel:'5.2L Shelby'},
];
export function normalizeEngine(value){return ENGINES.some(item=>item.value===value)?value:'';}
export function engineLabel(value){return ENGINES.find(item=>item.value===value)?.label||'All engines';}
export function matchesEngine(document,engine){return !engine||!document.engines?.length||document.engines.includes(engine);}
export function engineQuery(engine){return new URLSearchParams({engine:normalizeEngine(engine)||'all'}).toString();}
export function routeForEngine(hash,value){const [path,query='']=String(hash||'').replace(/^#/,'').split('?'),params=new URLSearchParams(query);params.delete('offset');params.delete('section');params.set('engine',normalizeEngine(value)||'all');return (path||'/')+'?'+params;}
export function sectionLabel(section){return String(section?.title||'Components').replace(/\s*\(\d+kW\/\d+PS\)/gi,'').replace(/\s*32V Ti-VCT/gi,' V8').replace(/Duratec/gi,'V6').replace(/\s*[-–]\s*6-Speed (Automatic|Manual) Transmission\s*[-–]\s*/gi,' · ').replace(/\s*[-–]\s*General Information/i,' · Essentials').replace(/\s+/g,' ').trim();}
export function libraryHref({system,section,q,kind}={}){const query=new URLSearchParams();for(const [key,value] of Object.entries({system,section,q,kind}))if(value)query.set(key,value);return '#/library'+(query.size?'?'+query:'');}

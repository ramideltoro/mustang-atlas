import {safeHref} from './content-model.mjs';

export const WORKSHOP_TASKS=[{id:'maintenance',title:'Maintenance'},{id:'diagnostics',title:'Diagnostics'},{id:'repair',title:'Repair'},{id:'overhaul',title:'Overhaul'}];
export const WORKSHOP_DIFFICULTIES=[{id:'basic',title:'Basic'},{id:'intermediate',title:'Intermediate'},{id:'advanced',title:'Advanced'},{id:'specialist',title:'Specialist'}];
export const WORKSHOP_SYSTEMS=[['general','General'],['engine','Engine'],['cooling','Cooling'],['fuel','Fuel'],['transmission','Transmission'],['driveline','Driveline'],['suspension','Suspension'],['steering','Steering'],['brakes','Brakes'],['electrical','Electrical'],['climate','Climate'],['body','Body'],['restraints','Restraints']].map(([id,title])=>({id,title}));
const filterKeys=['q','category','system','taskType','difficulty'];
const pageOffset=value=>Number.isFinite(Number(value))?Math.min(1000000,Math.max(0,Math.floor(Number(value)))):0;
export function maintenanceFilters(params=new URLSearchParams()){
 const filters=Object.fromEntries(filterKeys.map(key=>[key,params.get(key)||'']));
 return {...filters,year:params.get('year')||'2015',offset:pageOffset(params.get('offset'))};
}
export function maintenanceQuery({engine='',q='',category='',system='',taskType='',difficulty='',year='2015',limit=24,offset=0}={}){
 const params=new URLSearchParams({engine:engine||'all',year:String(year||2015),limit:String(limit),offset:String(pageOffset(offset))});
 for(const [key,value] of Object.entries({q:q.trim(),category,system,taskType,difficulty}))if(value)params.set(key,value);
 return params.toString();
}
export function maintenanceHref({id='',q='',category='',system='',taskType='',difficulty='',year='',offset=0}={}){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries({q,category,system,taskType,difficulty}))if(value)params.set(key,value);
 if(year&&String(year)!=='2015')params.set('year',year);
 if(pageOffset(offset)>0)params.set('offset',String(pageOffset(offset)));
 return '#/maintenance'+(id?'/'+encodeURIComponent(id):'')+(params.size?'?'+params:'');
}
export function guideClassifications(guide){
 return [
  {kind:'system',...WORKSHOP_SYSTEMS.find(item=>item.id===guide?.systemId)},
  {kind:'task',...WORKSHOP_TASKS.find(item=>item.id===guide?.taskType)},
  {kind:'difficulty',...WORKSHOP_DIFFICULTIES.find(item=>item.id===guide?.difficulty)},
 ].filter(item=>item.id);
}
export function guideWhenTitle(guide){return ['diagnostics','repair','overhaul'].includes(guide?.taskType)?'When this job makes sense':'When to do it';}
export function maintenanceFacetOptions(items,fallback,selected){
 const available=Array.isArray(items)?items:fallback;
 return selected&&!available.some(item=>item.id===selected)?[...available,{id:selected,title:fallback.find(item=>item.id===selected)?.title||selected,count:0}]:available;
}
export function maintenanceMismatch(applicability){return applicability?.matchesSelectedEngine===false||applicability?.matchesSelectedYear===false;}
export function guideOutline(guide){
 if(!guide)return [];
 return [
  [guide.when?.summary,'when',guideWhenTitle(guide)],
  [guide.introduction,'understand','Understand the task'],
  [guide.why,'why','Why it matters'],
  [guide.prepare?.length,'prepare','Before you start'],
  [guide.visualGuide,'visual-guide','Head bolts: order & stages'],
  [guide.steps?.length,'steps','What to do'],
  [guide.diagnostics?.length,'diagnostic-decisions','Make sense of the findings'],
  [guide.verification?.length,'verify-results','Check the result'],
  [guide.watchFor?.length,'watch-for','Signs to investigate'],
  [guide.notes?.length,'keep-in-mind','Keep in mind'],
  [guide.procedures?.length,'repair-guides','Related workshop articles'],
  [guide.references?.length,'online-references','Online references'],
 ].filter(([visible])=>visible).map(([,id,title])=>({id,title}));
}
export function maintenanceLink(item){
 const href=safeHref(item?.href);
 if(href?.startsWith('#/maintenance/')||href?.startsWith('#/document/'))return href;
 if(item?.guideId)return maintenanceHref({id:item.guideId});
 if(item?.documentId)return '#/document/'+encodeURIComponent(item.documentId);
 return null;
}
export function distanceLabel(value,unit){
 const text=String(value??'').trim();
 if(!text)return '—';
 return /\b(?:mi|miles?|km|kilomet(?:er|re)s?)\b/i.test(text)?text:text+' '+unit;
}

export function relatedWorkshopGuides(items){
 const seen=new Set();
 return (Array.isArray(items)?items:[]).filter(item=>{if(!item||typeof item.id!=='string'||!item.id||typeof item.title!=='string'||!item.title.trim()||seen.has(item.id))return false;seen.add(item.id);return true;}).slice(0,8);
}

export function maintenancePagination(total,offset=0,pageSize=24){
 const count=Math.max(0,Number.isFinite(Number(total))?Math.floor(Number(total)):0),size=Math.max(1,Math.floor(pageSize)||24);
 const pages=Math.max(1,Math.ceil(count/size)),lastOffset=(pages-1)*size;
 const currentOffset=Math.min(lastOffset,Math.floor(pageOffset(offset)/size)*size);
 return {offset:currentOffset,page:Math.floor(currentOffset/size)+1,pages,previousOffset:Math.max(0,currentOffset-size),nextOffset:Math.min(lastOffset,currentOffset+size)};
}

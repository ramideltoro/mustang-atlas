import {safeHref} from './content-model.mjs';

export function maintenanceQuery({engine='',q='',category='',year='2015',limit=24,offset=0}={}){
 const params=new URLSearchParams({engine:engine||'all',year:String(year||2015),limit:String(limit),offset:String(Math.max(0,Number(offset)||0))});
 if(q.trim())params.set('q',q.trim());
 if(category)params.set('category',category);
 return params.toString();
}
export function maintenanceHref({id='',q='',category='',year='',offset=0}={}){
 const params=new URLSearchParams();
 if(q)params.set('q',q);
 if(category)params.set('category',category);
 if(year&&String(year)!=='2015')params.set('year',year);
 if(offset>0)params.set('offset',String(offset));
 return '#/maintenance'+(id?'/'+encodeURIComponent(id):'')+(params.size?'?'+params:'');
}
export function maintenanceMismatch(applicability){return applicability?.matchesSelectedEngine===false||applicability?.matchesSelectedYear===false;}
export function guideOutline(guide){
 if(!guide)return [];
 return [
  [guide.when?.summary,'when','When to do it'],
  [guide.introduction,'understand','Understand the task'],
  [guide.why,'why','Why it matters'],
  [guide.prepare?.length,'prepare','Before you start'],
  [guide.steps?.length,'steps','What to do'],
  [guide.watchFor?.length,'watch-for','Signs to investigate'],
  [guide.notes?.length,'keep-in-mind','Keep in mind'],
  [guide.procedures?.length,'repair-guides','Related workshop articles'],
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

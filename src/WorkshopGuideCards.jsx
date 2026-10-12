import React,{useEffect,useState} from 'react';
import {ArrowUpRight,BookOpen,Wrench,CalendarClock,CarFront,Droplets,Fan,Wind,BatteryCharging,Gauge,ClipboardCheck,ShieldCheck} from 'lucide-react';
import {safeHref,categoryName} from './content-model.mjs';
import {guideClassifications,maintenanceHref,relatedWorkshopGuides} from './maintenance-hub-model.mjs';
import './maintenance-hub.css';

export function CareIcon({category='',size=20,...props}){
 const value=String(category).toLowerCase();
 const Icon=/calendar|plan/.test(value)?CalendarClock:/door|body/.test(value)?CarFront:/droplet|oil|fluid|lubric/.test(value)?Droplets:/cool|temperature|thermometer|fan/.test(value)?Fan:/filter|air|cabin|wind/.test(value)?Wind:/electric|battery|zap/.test(value)?BatteryCharging:/brake|tire|wheel|chassis|gauge|disc/.test(value)?Gauge:/inspect|check|heart/.test(value)?ClipboardCheck:/safety/.test(value)?ShieldCheck:Wrench;
 return <Icon size={size} aria-hidden="true" {...props}/>;
}
export function GuideBadges({guide,compact=false}){
 const items=guideClassifications(guide);
 return items.length>0?<div className={'workshop-badges'+(compact?' compact':'')}>{items.map(item=><span key={item.kind} className={'workshop-badge badge-'+item.kind+' value-'+item.id}><span className="workshop-badge-label">{item.kind==='task'?'Job':item.kind==='system'?'System':'Level'}: </span>{item.title}</span>)}</div>:null;
}
export function MaintenanceCard({guide,category,filters,heading:Heading='h2'}){
 const [failed,setFailed]=useState(false),image=guide.thumbnail;
 const categoryLabel=category?.title||categoryName(guide.categoryId||'Maintenance');
 const showCategory=!guideClassifications(guide).some(item=>item.title.toLowerCase()===categoryLabel.toLowerCase());
 useEffect(()=>setFailed(false),[image?.url]);
 return <a className="maintenance-guide-card" href={maintenanceHref({...filters,id:guide.id})}><div className={'maintenance-card-art'+(!image||failed?' no-image':'')}>{image&&!failed?<img src={safeHref(image.url)||undefined} width={image.width} height={image.height} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<CareIcon category={category?.icon||guide.categoryId} size={39}/>}</div><div className="maintenance-guide-card-body">{showCategory&&<span className="maintenance-category-label">{categoryLabel}</span>}<Heading className="maintenance-card-title">{guide.title}</Heading><GuideBadges guide={guide} compact/><p>{guide.summary}</p><div className="maintenance-guide-card-foot"><span>{guide.interval||'Explore the guide'}</span><ArrowUpRight size={18} aria-hidden="true"/></div></div></a>;
}
export function WorkshopGuidePanel({items}){
 const guides=relatedWorkshopGuides(items);
 if(!guides.length)return null;
 return <section id="workshop-guides" className="reader-workshop-guides" aria-labelledby="workshop-guides-title" tabIndex={-1}><div className="section-title"><span className="eyebrow"><BookOpen size={16} aria-hidden="true"/> PLAN THE NEXT STEP</span><h2 id="workshop-guides-title">Explore related care and repair guides</h2><p>Find context, useful checks and preparation for work related to this article.</p></div><div className="maintenance-guide-grid">{guides.map(guide=><MaintenanceCard key={guide.id} guide={guide} heading="h3"/>)}</div></section>;
}

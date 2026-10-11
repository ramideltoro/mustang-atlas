import React from 'react';
import {CalendarClock,HeartPulse,ShieldCheck,Wrench} from 'lucide-react';
import {TermText} from './Glossary.jsx';
import {safeHref} from './content-model.mjs';
import './maintenance.css';

const kinds={scheduled:'Scheduled care',inspection:'Regular check', 'condition-based':'Based on condition'};

export default function MaintenancePanel({data}) {
 if(!data?.items?.length)return null;
 return <section className="maintenance-panel" id="care-and-maintenance" aria-labelledby="maintenance-title">
  <div className="section-title"><span className="eyebrow"><HeartPulse size={16} aria-hidden="true"/> KEEP IT WORKING WELL</span><h2 id="maintenance-title">{data.title||'Care and maintenance'}</h2>{data.scope&&<p>{data.scope}</p>}</div>
  <div className="maintenance-items">{data.items.map(item=><section key={item.id} className={'maintenance-card maintenance-'+item.kind} aria-labelledby={'care-'+item.id}>
   <header><span className="maintenance-kind">{kinds[item.kind]||'Component care'}</span><h3 id={'care-'+item.id}>{item.title}</h3>{item.applicability&&<p className="maintenance-application">{[item.applicability.engines?.length?item.applicability.engines.join(' · '):null,item.applicability.equipment].filter(Boolean).join(' / ')}</p>}</header>
   <div className="maintenance-interval"><CalendarClock size={19} aria-hidden="true"/><div><h4>When to do it</h4><p><TermText text={item.when}/></p></div></div>
   <div className="maintenance-guidance"><div><h4><Wrench size={16} aria-hidden="true"/> What to do</h4><p><TermText text={item.what}/></p>{item.steps?.length>0&&<ol>{item.steps.filter(step=>typeof step==='string'&&/[\p{L}\p{N}]/u.test(step)).map((step,i)=><li key={i}><TermText text={step}/></li>)}</ol>}</div><div><h4><ShieldCheck size={16} aria-hidden="true"/> Why it helps</h4><p><TermText text={item.why}/></p></div></div>
   {item.notes?.length>0&&<div className="maintenance-notes">{item.notes.filter(Boolean).map((note,i)=><p key={i}><TermText text={note}/></p>)}</div>}
   {item.sources?.some(source=>safeHref(source.url))&&<details className="maintenance-evidence"><summary>Schedule details</summary>{item.sources.filter(source=>safeHref(source.url)).map((source,i)=><a href={source.url} key={i} target="_blank" rel="noreferrer">{source.title}</a>)}</details>}
  </section>)}</div>
 </section>;
}

import React from 'react';
import {ArrowUpRight,Box,CheckCircle2} from 'lucide-react';
import {safeHref} from './content-model.mjs';
import {confirmedParts} from './parts-model.mjs';
export default function PartsPanel({data}){
 const parts=confirmedParts(data);
 if(!parts.length)return null;
 return <section className="parts-panel" id="parts" aria-labelledby="parts-title">
  <div className="section-title"><span className="eyebrow"><Box size={15}/> MATCH THE RIGHT PART</span><h2 id="parts-title">Parts.</h2><p>Match these confirmed part numbers to your car’s engine and equipment.</p></div>
  <div className="parts-cards">{parts.map(part=><section className="part-card" key={part.id||part.number}>
   <div className="part-card-heading"><CheckCircle2 size={17}/><span>Ford / Motorcraft application</span></div><h3>{part.name}</h3>
   <dl className="part-numbers"><div><dt>{part.brand}</dt><dd>{part.number}</dd></div>{part.additionalNumbers?.map(item=><div key={item.brand+item.number}><dt>{item.brand}</dt><dd>{item.number}</dd></div>)}</dl>
   <p className="part-fitment">{[part.fitment?.years?.join(', '),part.fitment?.engines?.join(' · '),part.fitment?.market].filter(Boolean).join(' / ')}</p>
   {part.fitment?.notes&&<p>{part.fitment.notes}</p>}
   {safeHref(part.officialUrl)&&<a href={part.officialUrl} target="_blank" rel="noreferrer" className="text-link">Check Ford application <ArrowUpRight size={14}/></a>}
  </section>)}</div>
 </section>;
}

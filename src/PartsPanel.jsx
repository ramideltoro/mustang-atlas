import React from 'react';
import {ArrowUpRight,Box,CheckCircle2} from 'lucide-react';
import {Figure} from './ui.jsx';
import {safeHref} from './content-model.mjs';
import {hasPartsContent} from './parts-model.mjs';
const diagramNames={'exploded-view':'Exploded assembly','component-view':'Component layout','connector-view':'Connector view','wiring-diagram':'Circuit diagram'};
const identifierNames={base:'Ford base number','engineering-or-service-unverified':'Component identifier',material:'Material specification','special-tool':'Tool identifier'};
export default function PartsPanel({data,onZoom}){
 if(!hasPartsContent(data))return null;
 return <section className="parts-panel" id="parts-and-diagrams" aria-labelledby="parts-title">
  <div className="section-title"><span className="eyebrow"><Box size={15}/> MATCH THE RIGHT PART</span><h2 id="parts-title">Parts & diagrams.</h2><p>Identify the component, then match its application to your car.</p></div>
  {data.parts?.length>0&&<div className="parts-cards">{data.parts.map(part=><section className="part-card" key={part.id}>
   <div className="part-card-heading"><CheckCircle2 size={17}/><span>Ford / Motorcraft application</span></div><h3>{part.name}</h3>
   <dl className="part-numbers"><div><dt>{part.brand}</dt><dd>{part.number}</dd></div>{part.additionalNumbers?.map(item=><div key={item.brand+item.number}><dt>{item.brand}</dt><dd>{item.number}</dd></div>)}</dl>
   <p className="part-fitment">{[part.fitment?.years?.join(', '),part.fitment?.engines?.join(' · '),part.fitment?.market].filter(Boolean).join(' / ')}</p>
   {part.fitment?.notes&&<p>{part.fitment.notes}</p>}
   {safeHref(part.officialUrl)&&<a href={part.officialUrl} target="_blank" rel="noreferrer" className="text-link">Check Ford application <ArrowUpRight size={14}/></a>}
  </section>)}</div>}
  {data.identifiers?.length>0&&<details className="part-identifiers"><summary>Component and tool identifiers <span>{data.identifiers.length}</span></summary><p>These help identify a component, material, or tool. They are not confirmed replacement ordering numbers.</p><div className="table-scroll" tabIndex={0} role="region" aria-label="Component identifiers"><table><thead><tr><th>Identifier</th><th>Type</th><th>Component / use</th></tr></thead><tbody>{data.identifiers.map((item,index)=><tr key={item.number+'-'+index}><td className="part-number-cell">{item.number}</td><td>{identifierNames[item.kind]||'Identifier'}</td><td>{item.label}</td></tr>)}</tbody></table></div></details>}
  {data.diagrams?.length>0&&<div className="parts-diagrams">{data.diagrams.map(figure=><div key={figure.id}>{(diagramNames[figure.kind]||figure.documentId!==data.documentId)&&<div className="parts-diagram-heading">{diagramNames[figure.kind]&&<span>{diagramNames[figure.kind]}</span>}{figure.documentId!==data.documentId&&<a href={'#/document/'+encodeURIComponent(figure.documentId)}>View related assembly <ArrowUpRight size={13}/></a>}</div>}<Figure figure={{...figure,caption:figure.title||'Component detail'}} onZoom={onZoom}/></div>)}</div>}
 </section>;
}

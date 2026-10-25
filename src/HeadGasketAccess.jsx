import React from 'react';
import {ArrowDown,ArrowRight} from 'lucide-react';
import {TermText} from './Glossary.jsx';
import './special-maintenance.css';

export default function HeadGasketAccess({onJump}){
 const layers=[
  ['Valve cover','The removable lid. Both covers come off for front-cover access.'],
  ['Valve-cover gasket','Seals oil around the lid. It is replaced when that cover goes back.'],
  ['Cylinder head','The substantial casting containing camshafts, valves and their supports. The affected head must be lifted.'],
  ['Head gasket — the part you are replacing','Seals the joint between the head and block. It is reached only after the head is removed.'],
  ['Engine block','Contains the cylinders and pistons. It remains in place for this procedure.']
 ];
 return <div className="head-access">
  <p className="head-access-lede">The valve-cover gasket is at the top of the head. The head gasket is underneath the entire head. Here is the difference, one bank at a time.</p>
  <div className="head-access-layout">
   <figure className="head-layer-figure">
    <svg viewBox="0 0 300 460" role="img" aria-labelledby="head-layers-title head-layers-desc">
     <title id="head-layers-title">From valve cover to engine block</title><desc id="head-layers-desc">An original exploded concept diagram. From top to bottom: valve cover, valve-cover gasket, cylinder head with camshafts, highlighted head gasket, and engine block with cylinders. The two gaskets seal different joints.</desc>
     <path className="layer-guide" d="M60 42v370M240 42v370"/>
     <path className="layer-part" d="M48 71V52q0-18 18-18h168q18 0 18 18v19Z"/><path className="layer-detail" d="M84 34v37m44-37v37m44-37v37m44-37v37"/>
     <rect className="layer-oil-seal" x="48" y="104" width="204" height="10" rx="5"/>
     <rect className="layer-part" x="48" y="146" width="204" height="109" rx="12"/>
     <g className="layer-detail"><circle cx="103" cy="179" r="18"/><circle cx="197" cy="179" r="18"/><path d="m110 195 22 41m58-41-22 41m-44 5h18m16 0h18"/></g>
     <rect className="layer-head-seal" x="42" y="290" width="216" height="13" rx="4"/>
     <rect className="layer-part" x="48" y="337" width="204" height="91" rx="8"/>
     <g className="layer-detail"><path d="M78 347v57h28v-57m30 0v57h28v-57m30 0v57h28v-57M78 387h28m30 0h28m30 0h28"/></g>
     {[53,109,200,296,380].map((y,i)=><g key={i} className={'layer-number '+(i===3?'is-gasket':'')}><circle cx="22" cy={y} r="14"/><text x="22" y={y+4}>{i+1}</text></g>)}
    </svg>
    <figcaption>Original Atlas concept diagram. Exploded for clarity; not to scale or a fastener-location drawing.</figcaption>
   </figure>
   <ol className="head-layer-list">{layers.map(([title,body],i)=><li key={title} className={i===3?'is-gasket':''}><span aria-hidden="true">{i+1}</span><div><h3><TermText text={title}/></h3><p><TermText text={body}/></p></div></li>)}</ol>
  </div>
  <div className="head-access-side-note"><strong>Where do the intake and timing parts fit?</strong><p>The upper and lower intake manifolds carry air into the heads. The front cover encloses the timing drive at the front of the engine. They are not extra layers between the head and block, but they obstruct this repair and must be dealt with before the head can lift.</p></div>
  <nav className="head-access-actions" aria-label="Find the head-gasket instructions"><button type="button" onClick={()=>onJump('access-head-gasket')}>How to get to it <ArrowDown size={16}/></button><button type="button" onClick={()=>onJump('replace-head-gasket')}>The gasket replacement <ArrowRight size={16}/></button></nav>
 </div>;
}

import React,{useState} from 'react';
import {ArrowDown,ArrowRight,BookOpen,Link2} from 'lucide-react';
import {TermText} from './Glossary.jsx';
import './special-maintenance.css';

const views={
 primary:{label:'Primary chain',title:'Crankshaft → both intake camshafts',body:'The long primary timing chain links the crankshaft to both intake VCT units. Its installation is checked at both intake marks and at the marked-link pair around the crankshaft mark.',href:'#/document/G1681528'},
 secondary:{label:'Secondary chains',title:'Intake → exhaust, on each bank',body:'Each shorter secondary timing chain links the intake and exhaust VCT units on one cylinder head. Their removal is a separate, optional branch with its own hold-down tool and new-bolt requirements.',href:'#/document/G1681532'}
};
export default function TimingChainWorkshop({onJump}){
 const [selected,setSelected]=useState('primary');const view=views[selected];
 return <div className={'timing-chain-workshop timing-view-'+selected}>
  <p className="timing-intro">One long primary chain, plus a short secondary chain on each bank. I separate them here so “replace the chain” has a clear meaning before the tools come out.</p>
  <div className="timing-view-picker" role="group" aria-label="Explore the timing chains">{Object.entries(views).map(([id,item])=><button type="button" key={id} aria-pressed={id===selected} onClick={()=>setSelected(id)}><Link2 size={17} aria-hidden="true"/>{item.label}</button>)}</div>
  <figure className="timing-relationship-map">
   <svg viewBox="0 0 640 330" role="img" aria-labelledby="timing-map-title timing-map-desc">
    <title id="timing-map-title">How the three timing chains connect the crankshaft and camshafts</title>
    <desc id="timing-map-desc">An original relationship diagram, not a physical routing or timing-mark drawing. The primary chain connects the crankshaft to the right and left intake VCT units. A secondary chain on each bank connects that intake unit to its exhaust unit.</desc>
    <text className="timing-bank-label" x="166" y="28">RH bank</text><text className="timing-bank-label" x="474" y="28">LH bank</text>
    <path className="timing-primary-line" d="M240 128 320 245 400 128"/>
    <path className="timing-secondary-line" d="M130 100h64m252 0h64"/>
    {[[90,'Exhaust'],[240,'Intake'],[400,'Intake'],[550,'Exhaust']].map(([x,label])=><g key={x} className={'timing-map-node '+(label==='Intake'?'timing-intake':'timing-exhaust')}><circle cx={x} cy="100" r="39"/><circle cx={x} cy="100" r="14"/><text x={x} y="52">{label} VCT</text></g>)}
    <g className="timing-map-node timing-crank"><circle cx="320" cy="255" r="33"/><circle cx="320" cy="255" r="11"/><text x="320" y="316">Crankshaft</text></g>
   </svg>
   <div className="timing-mobile-map"><div className="timing-mobile-crank">Crankshaft</div><p className="timing-mobile-primary">Primary chain → both intake units</p><div className="timing-mobile-banks">{['RH','LH'].map(bank=><div key={bank}><strong>{bank} bank</strong><span>Intake VCT</span><small className="timing-mobile-secondary">↕ Secondary chain</small><span>Exhaust VCT</span></div>)}</div></div>
   <figcaption>Original relationship map. Lines show which parts are linked; they do not show the actual chain path, mark angles or tooth positions.</figcaption>
  </figure>
  <div className="timing-view-description" role="status"><strong>{view.title}</strong><p><TermText text={view.body}/></p><a href={view.href}>Open the matching workshop reference <ArrowRight size={15} aria-hidden="true"/></a></div>
  <div className="timing-access-route"><h3><BookOpen size={20} aria-hidden="true"/>What comes off to reach it?</h3><ol><li><strong>Clear the top</strong><span>Air duct → upper intake → coils → both valve covers</span></li><li><strong>Clear the front</strong><span>Coolant bottle → belts → crank pulley/seal → pump and front accessories</span></li><li><strong>Open the timing drive</strong><span>Front cover → establish timing position → oil tubes and holding tools → chain</span></li></ol><p>The heads, camshafts and lower intake remain installed for this chain procedure.</p></div>
  <nav className="head-access-actions" aria-label="Find the timing-chain instructions"><button type="button" onClick={()=>onJump('access-timing-chain')}>Start with the access steps <ArrowDown size={16} aria-hidden="true"/></button><button type="button" onClick={()=>onJump('fit-primary-chain')}>Fit and check the chain <ArrowRight size={16} aria-hidden="true"/></button></nav>
 </div>;
}

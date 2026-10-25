import React,{useState} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,RotateCw} from 'lucide-react';
import {HEAD_BANKS,HEAD_BOLT_ROWS,HEAD_BOLT_STAGES} from './head-gasket-model.mjs';
import './special-maintenance.css';

export default function HeadGasketWorkshop(){
 const [bank,setBank]=useState('lh'),[pass,setPass]=useState(1),[bolt,setBolt]=useState(1);
 const side=HEAD_BANKS[bank],stage=HEAD_BOLT_STAGES[pass-1];
 return <div className="head-gasket-workshop">
  <p className="head-bolt-lede">Eight main bolts. Five separate passes. Start at bolt 1 for every pass; finish that pass on all eight before moving to the next stage.</p>
  <div className="head-bank-picker" role="group" aria-label="Cylinder head illustration">
   {Object.entries(HEAD_BANKS).map(([id,item])=><button type="button" key={id} aria-pressed={bank===id} onClick={()=>{setBank(id);setBolt(1);}}>{item.name}<span>{id.toUpperCase()}</span></button>)}
  </div>
  <div className="head-bolt-map" aria-label={side.name+' installation bolt layout'}>
   <p className={'head-front-label front-'+side.front}>{side.front==='left'&&<ArrowLeft size={17} aria-hidden="true"/>}Front / timing-cover end{side.front==='right'&&<ArrowRight size={17} aria-hidden="true"/>}</p>
   <span className="head-map-caption">Intake / valley side</span>
   <div className="head-bolt-row">{HEAD_BOLT_ROWS[0].map(n=><button type="button" key={n} aria-label={'Highlight bolt '+n} aria-pressed={bolt===n} onClick={()=>setBolt(n)}>{n}</button>)}</div>
   <div className="head-cylinder-row" aria-hidden="true"><span/><span/><span/></div>
   <div className="head-bolt-row">{HEAD_BOLT_ROWS[1].map(n=><button type="button" key={n} aria-label={'Highlight bolt '+n} aria-pressed={bolt===n} onClick={()=>setBolt(n)}>{n}</button>)}</div>
   <span className="head-map-caption">Exhaust side</span>
  </div>
  <p className="head-diagram-note">Original Atlas schematic, not to scale. Orientation matches the selected Ford illustration. This is the <strong>installation</strong> order; the separate M6 bolt is not shown.</p>
  <div className="head-stage-picker" role="group" aria-label="Explore the five tightening passes">{HEAD_BOLT_STAGES.map(item=><button type="button" key={item.id} aria-pressed={pass===item.id} onClick={()=>{setPass(item.id);setBolt(1);}}><span>Pass {item.id}</span><strong>{item.value}</strong><small>{item.secondary}</small></button>)}</div>
  <div className="head-bolt-explainer"><RotateCw size={25} aria-hidden="true"/><div role="status"><strong>Pass {pass} · Bolt {bolt} · {stage.value}</strong><p>{stage.instruction} {bolt<8?'Next in this pass: bolt '+(bolt+1)+'.':'This is the last bolt in this pass.'}</p></div></div>
  <div className="head-bolt-controls"><button type="button" disabled={bolt===1} onClick={()=>setBolt(n=>n-1)}><ArrowLeft size={16}/>Previous bolt</button><button type="button" disabled={bolt===8} onClick={()=>setBolt(n=>n+1)}>Next bolt<ArrowRight size={16}/></button></div>
  <p className="head-diagram-note">This explorer does not record completed work or measure torque. Use new specified bolts and a calibrated torque wrench/angle gauge. After all five passes, install the new M6 bolt separately at 10 Nm / 89 lb-in.</p>
  <a className="head-diagram-reference" href={'#/document/'+side.documentId}><BookOpen size={18} aria-hidden="true"/>Ford {side.name.toLowerCase()} · Installation step 2 · {side.figure}<ArrowRight size={16}/></a>
 </div>;
}

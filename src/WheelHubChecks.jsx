import React,{useState} from 'react';
import {ArrowDown,ArrowRight} from 'lucide-react';
import {TermText} from './Glossary.jsx';
import './wheel-hub-checks.css';

const grips={horizontal:{label:'3 and 9 o’clock',positions:[[50,150],[250,150]],body:'Hold the left and right sides. Gently push with one hand and pull with the other, then reverse. At the front, watch for steering movement as well as free play.'},vertical:{label:'12 and 6 o’clock',positions:[[150,50],[150,250]],body:'Hold the top and bottom and repeat the gentle push/pull. Have a helper watch the hub, knuckle and suspension connections. This hand position does not identify the faulty part on its own.'}};
export default function WheelHubChecks({onJump}){
 const [grip,setGrip]=useState('horizontal');const selected=grips[grip];
 return <div className="wheel-hub-checks">
  <p>I work through the clues in this order. The goal is to name the connection that moves or the part making contact—not nominate a bearing by popular vote.</p>
  <nav className="wheel-check-route" aria-label="Wheel diagnosis route">
   <button type="button" onClick={()=>onJump('wheel-ground-checks')}><span>01 · Ground checks</span><strong>Safe to continue?</strong><small>Damage or loose mounting → stay parked.</small><ArrowDown size={18} aria-hidden="true"/></button>
   <button type="button" onClick={()=>onJump('wheel-supported-checks')}><span>02 · Supported checks</span><strong>What moves or drags?</strong><small>Rotate, rock gently and watch the connection.</small><ArrowDown size={18} aria-hidden="true"/></button>
   <button type="button" onClick={()=>onJump('diagnostic-decisions')}><span>03 · Follow the evidence</span><strong>Choose the next check</strong><small>Tire, mounting, joint, brake or hub?</small><ArrowRight size={18} aria-hidden="true"/></button>
  </nav>
  <div className="wheel-hand-check">
   <figure><svg viewBox="0 0 300 300" role="img" aria-labelledby="wheel-check-title wheel-check-desc">
    <title id="wheel-check-title">Hand positions for a gentle wheel-rocking check</title>
    <desc id="wheel-check-desc">Looking straight at the wheel. The highlighted positions show where to hold it. Alternate a gentle push and pull; observe the connection that moves. The car must be securely supported first.</desc>
    <circle className="wheel-check-tire" cx="150" cy="150" r="104"/><circle className="wheel-check-rim" cx="150" cy="150" r="74"/>
    {[0,72,144,216,288].map(angle=><path key={angle} className="wheel-check-spoke" d="M150 125V82" transform={`rotate(${angle} 150 150)`}/>)}
    <circle className="wheel-check-hub" cx="150" cy="150" r="23"/>
    {[[150,23,'12'],[280,156,'3'],[150,287,'6'],[20,156,'9']].map(([x,y,label])=><text x={x} y={y} key={label}>{label}</text>)}
    {selected.positions.map(([x,y])=><g key={x+'-'+y} className="wheel-check-grip"><circle cx={x} cy={y} r="15"/><path d={`M${x-6} ${y}h12m-6 -6v12`}/></g>)}
   </svg><figcaption>Original hand-position sketch. Highlights are grip locations, not force or clearance measurements.</figcaption></figure>
   <div><h3>Two checks. One important question.</h3><p>Where is the movement actually happening?</p>
    <div className="wheel-grip-picker" role="group" aria-label="Choose hand positions">{Object.entries(grips).map(([id,item])=><button type="button" key={id} aria-pressed={grip===id} onClick={()=>setGrip(id)}>{item.label}</button>)}</div>
    <p role="status">{selected.body}</p>
    <p className="wheel-check-rule"><strong>Before touching the wheel:</strong> engine off, secure supports and wheels chocked. Follow step 6 first.</p>
    <button className="wheel-check-jump" type="button" onClick={()=>onJump('job-step-8')}>Read the hand-check instructions <ArrowDown size={16} aria-hidden="true"/></button>
   </div>
  </div>
  <div className="wheel-connection-map"><h3>Follow the movement through the parts</h3><p><TermText text="Wheel → wheel hub and wheel bearing → wheel knuckle → suspension / steering connections"/></p><small>Relationship map only. Watch one connection relative to the next; a moving tire alone does not locate the fault.</small></div>
 </div>;
}

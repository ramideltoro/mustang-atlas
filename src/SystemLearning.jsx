import React from 'react';
import {ArrowDown,BookOpen,ChevronDown,Lightbulb} from 'lucide-react';
import {Markdown} from './Reader.jsx';
import {Sources} from './ui.jsx';
export default function SystemLearning({system,expanded=false}){
 if(!system?.introduction)return null;
 return <details className="system-learning" open={expanded||undefined}><summary><span className="system-learning-icon"><Lightbulb size={19}/></span><span><small>UNDERSTAND THE SYSTEM</small><strong>{system.contextTitle||'How '+system.title.toLowerCase()+' works'}</strong></span><ChevronDown size={17}/></summary><div className="system-learning-body"><Markdown body={system.introduction}/>{system.howItWorks?.length>0&&<ul className="concept-flow" role="list" aria-label="How the system works">{system.howItWorks.map((item,index)=><li key={index}><span className="flow-dot"/><div><h3>{item.title}</h3><Markdown body={item.body}/></div>{index<system.howItWorks.length-1&&<ArrowDown size={12} aria-hidden="true"/>}</li>)}</ul>}<Sources items={system.sourceRefs||[]} label="Source context"/></div></details>;
}

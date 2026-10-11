import React from 'react';
import {BookOpen,Compass,Info,Lightbulb,Workflow} from 'lucide-react';
import {Markdown} from './Reader.jsx';
import {useGlossary} from './Glossary.jsx';
import {Sources} from './ui.jsx';
import {contextRelatedTerms,contextReadingLayout} from './topic-context-model.mjs';
import './topic-context.css';

const sectionStyles=[{tone:'amber',Icon:Lightbulb},{tone:'blue',Icon:Workflow},{tone:'green',Icon:Compass},{tone:'amber',Icon:BookOpen}];

export default function TopicContext({context}){
 const glossary=useGlossary();
 if(!context)return null;
 const terms=contextRelatedTerms(context.relatedTerms);
 return <section id="understand-topic" className="topic-context" aria-labelledby="topic-context-title">
  <header className="topic-context-header">
   <span className="eyebrow"><Lightbulb size={14} aria-hidden="true"/> UNDERSTAND THIS TOPIC</span>
   <h2 id="topic-context-title">{context.title||'Get to know this part of your Mustang.'}</h2>
   <div className="topic-context-summary"><Markdown body={context.summary}/></div>
  </header>
  <div className={'topic-context-sections'+(contextReadingLayout(context.sections)?' reading-layout':'')}>
   {context.sections.map((section,index)=>{
    const {tone,Icon}=sectionStyles[index%sectionStyles.length];
    return <section key={section.id||index} className={'topic-context-card context-'+tone}>
     <h3><span className="topic-context-icon"><Icon size={17} aria-hidden="true"/></span>{section.title}</h3>
     <Markdown body={section.body}/>
    </section>;
   })}
  </div>
  {terms.length>0&&<div className="topic-context-terms"><span className="topic-context-label">GET TO KNOW THE TERMS</span><div>{terms.map(term=>glossary?.open?<button type="button" key={term.id} onClick={()=>glossary.open(term.id)} aria-haspopup="dialog" aria-label={'Explain '+term.name}>{term.name}<Info size={12} aria-hidden="true"/></button>:<a key={term.id} href={'#/glossary?q='+encodeURIComponent(term.name)}>{term.name}<BookOpen size={12} aria-hidden="true"/></a>)}</div></div>}
  <Sources items={context.sourceRefs||[]} label="Explore connected topics"/>
 </section>;
}

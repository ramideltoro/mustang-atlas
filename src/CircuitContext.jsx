import React from 'react';
import {ArrowRight,ArrowUpRight,CircuitBoard,GitBranch,PlugZap,Route} from 'lucide-react';
import {TermText} from './Glossary.jsx';
import {Markdown} from './Reader.jsx';
import './circuit-context.css';

function ArticleLink({id,children}) {
 return id ? <a href={'#/document/'+encodeURIComponent(id)}>{children}<ArrowUpRight size={13} aria-hidden="true"/></a> : <span>{children}</span>;
}
function categoryLabel(value) {return String(value||'circuit').replace(/[-_]/g,' ');}
function circuitTone(value) {return /ground|return/.test(value||'')?'ground':/power|supply|feed/.test(value||'')?'power':/network|data|communication/.test(value||'')?'network':'signal';}

export default function CircuitContext({context}) {
 if(!context)return null;
 const {components=[],connections=[],circuits=[],continuations=[],readingGuide=[]}=context;
 return <section className="circuit-context" id="understand-circuit" aria-labelledby="circuit-context-title">
  <header className="circuit-context-header">
   <span className="eyebrow"><CircuitBoard size={16} aria-hidden="true"/> UNDERSTAND THE CIRCUIT</span>
   <h2 id="circuit-context-title">{context.title||'How this circuit works.'}</h2>
   <div className="circuit-summary"><Markdown body={context.summary}/></div>
   {context.scope&&<p className="circuit-scope">{context.scope}</p>}
  </header>
  {components.length>0&&<section className="circuit-section" id="circuit-components"><h3><PlugZap size={19} aria-hidden="true"/>What the components do</h3><div className="circuit-components">{components.map((part,index)=><div className="circuit-component" key={(part.id||'component')+'-'+index}><h4><TermText text={part.label}/></h4>{part.role&&<Markdown body={part.role}/>}{part.connectorIds?.length>0&&<div className="circuit-connectors">{part.connectorIds.map((connector,n)=><ArticleLink id={part.documentIds?.[n]} key={connector}>{connector}</ArticleLink>)}</div>}</div>)}</div></section>}
  {connections.length>0&&<section className="circuit-section" id="circuit-paths"><h3><Route size={19} aria-hidden="true"/>What connects to what</h3><div className="circuit-paths">{connections.map((connection,index)=><div className="circuit-path" key={index}><div className="circuit-path-endpoints"><strong>{connection.from}</strong><ArrowRight size={18} aria-label="connects to"/><strong>{connection.to}</strong></div>{connection.circuit&&<span className="circuit-code">{connection.circuit}</span>}{connection.description&&<p><TermText text={connection.description}/></p>}{connection.via?.length>0&&<p className="circuit-via">Through {Array.isArray(connection.via)?connection.via.join(' → '):connection.via}</p>}</div>)}</div></section>}
  {circuits.length>0&&<section className="circuit-section" id="circuit-terminals"><h3><GitBranch size={19} aria-hidden="true"/>Circuit and connector map</h3><p className="circuit-table-intro">Match the circuit code and connector pin to the drawing. A matching wire color alone does not identify a connection.</p><div className="table-scroll circuit-table" tabIndex={0} role="region" aria-label="Circuit codes and connector pins, scroll horizontally for all columns"><table><thead><tr><th scope="col">Circuit / role</th><th scope="col">Wire identification</th><th scope="col">Connector and pin</th></tr></thead><tbody>{circuits.map((circuit,index)=><tr key={circuit.id||index}><td><span className={'circuit-category circuit-'+circuitTone(circuit.category)}>{categoryLabel(circuit.category)}</span><strong className="circuit-code">{circuit.id}</strong>{circuit.label&&circuit.label!==circuit.id&&<span className="circuit-label">{circuit.label}</span>}{circuit.explanation&&<p><TermText text={circuit.explanation}/></p>}</td><td>{circuit.wireColors?.length>0?circuit.wireColors.map((wire,n)=><div className="wire-code" key={wire.code||n}><code>{wire.code}</code><span>{wire.name}</span></div>):<span>Use the drawing</span>}</td><td>{circuit.terminals?.length>0?circuit.terminals.map((terminal,n)=><div className="circuit-terminal" key={n}><ArticleLink id={terminal.documentId}>{terminal.connectorId}{terminal.pin!=null&&terminal.pin!==''?' · pin '+terminal.pin:''}</ArticleLink>{terminal.function&&<span><TermText text={terminal.function}/></span>}{terminal.qualifier&&<small className="terminal-qualifier">{terminal.qualifier}</small>}</div>):<span>Follow the continuation shown on the drawing.</span>}</td></tr>)}</tbody></table></div></section>}
  {continuations.length>0&&<section className="circuit-section" id="circuit-continuations"><h3><ArrowRight size={19} aria-hidden="true"/>Follow the circuit further</h3><div className="circuit-continuations">{continuations.map((item,index)=><div key={(item.reference||'continuation')+'-'+index}><ArticleLink id={item.documentId}>{item.title||item.reference}</ArticleLink>{item.description&&<p>{item.description}</p>}</div>)}</div></section>}
  {readingGuide.length>0&&<section className="circuit-section" id="circuit-reading-guide"><h3><CircuitBoard size={19} aria-hidden="true"/>Make sense of the drawing</h3><div className="circuit-reading-guide">{readingGuide.filter(Boolean).map((tip,index)=><div key={index}><span aria-hidden="true">{index+1}</span><p><TermText text={tip}/></p></div>)}</div></section>}
 </section>;
}

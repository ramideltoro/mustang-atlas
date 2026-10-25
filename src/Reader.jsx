import {ArticleThumbnail} from './ArticleThumbnail.jsx';
import React,{useMemo,useState} from 'react';
import {marked} from 'marked';
import {AlertTriangle,ArrowRight,BookOpen,Bookmark,Check,ChevronDown,ClipboardList,FileText,FlaskConical,Info,Lightbulb,Link,ListTree,PlayCircle,Printer,RotateCw,Wrench} from 'lucide-react';
import {useApi} from './hooks.js';
import {readableTitle,documentTitle,readerBlocks,callout,safeHref,categoryName,annotateSourceTerms,annotateMarkdownTerms,readingOutline,sectionTone,hasReadableText} from './content-model.mjs';
import {torqueLineKind} from './torque-spec.mjs';
import {TermText,useGlossary,GlossaryProvider} from './Glossary.jsx';
import SystemLearning from './SystemLearning.jsx';
import TopicContext from './TopicContext.jsx';
import CircuitContext from './CircuitContext.jsx';
import {topicContextForView} from './topic-context-model.mjs';
import TorqueCalculator from './TorqueCalculator.jsx';
import PartsPanel from './PartsPanel.jsx';
import MaintenancePanel from './MaintenancePanel.jsx';
import {WorkshopGuidePanel} from './WorkshopGuideCards.jsx';
import {relatedWorkshopGuides} from './maintenance-hub-model.mjs';
import {hasPartsContent} from './parts-model.mjs';
import './reader-refresh.css';
import {Badge,Loading,ErrorState,Figure,FigureGrid,Sources,CheckItem} from './ui.jsx';
const calloutLabels={warning:'Warning',caution:'Caution',notice:'Notice',note:'Note',tip:'A helpful tip',important:'Before you continue',explanation:'In plain English'};
export function Callout({kind='note',children}){const Icon=/warning|caution/.test(kind)?AlertTriangle:kind==='tip'?Lightbulb:Info;return <aside className={'callout callout-'+kind}><div><Icon size={17}/><strong>{calloutLabels[kind]||categoryName(kind)}</strong></div><div className="callout-body">{children}</div></aside>;}
function inline(tokens,seen,linked=false){return (tokens||[]).map((token,index)=>{const nested=()=>inline(token.tokens,seen,linked);if(token.type==='strong')return <strong key={index}>{nested()}</strong>;if(token.type==='em')return <em key={index}>{nested()}</em>;if(token.type==='codespan')return <code key={index}>{token.text}</code>;if(token.type==='br')return <br key={index}/>;if(token.type==='link'){const href=safeHref(token.href);return href?<a href={href} key={index} target={/^https?:/.test(href)?'_blank':undefined} rel={/^https?:/.test(href)?'noreferrer':undefined}>{inline(token.tokens,seen,true)}</a>:<span key={index}>{nested()}</span>;}return <React.Fragment key={index}>{token.tokens?nested():linked?token.text:<TermText text={token.text||''} parts={token.termParts}/>}</React.Fragment>;});}
function MarkdownTokens({tokens,seen}){
 return (tokens||[]).map((token,index)=>{
  if(token.type==='heading'){seen=new Set();const Tag='h'+Math.max(2,Math.min(4,token.depth));return <Tag className={'document-heading heading-tone-'+sectionTone(token.text)} key={index}>{inline(token.tokens,seen)}</Tag>;}
  if(token.type==='paragraph'||token.type==='text'){if(!hasReadableText(token.text))return null;const body=inline(token.tokens||marked.Lexer.lexInline(token.text||''),seen);return <p key={index}>{token.atlasTorque?<TorqueStatement>{body}</TorqueStatement>:token.atlasMaterial?<MaterialStatement>{body}</MaterialStatement>:body}</p>;}
  if(token.type==='blockquote'){const notice=token.atlasCallout||callout(token.text);return notice?<Callout kind={notice.kind} key={index}><MarkdownTokens tokens={token.atlasCallout?token.tokens:marked.lexer(notice.body)} seen={seen}/></Callout>:<blockquote key={index}><MarkdownTokens tokens={token.tokens} seen={seen}/></blockquote>;}
  if(token.type==='list'){if(!token.items.length)return null;const Tag=token.ordered?'ol':'ul';return <Tag key={index} start={token.ordered?token.start:undefined}>{token.items.map((item,n)=><li key={n} value={token.ordered?item.atlasNumber:undefined}><MarkdownTokens tokens={item.tokens} seen={seen}/></li>)}</Tag>;}
  if(token.type==='table'){const torque=token.atlasTorqueTable;return <div className={'table-scroll'+(torque?.active?' torque-spec-table':'')} tabIndex={0} role="region" aria-label={torque?.active?'Torque specifications, scroll horizontally if needed':'Reference table, scroll horizontally if needed'} key={index}>{torque?.active&&<div className="table-label torque-table-label"><RotateCw size={15} aria-hidden="true"/>Torque specifications</div>}<table><thead><tr>{token.header.map((cell,n)=><th scope="col" key={n}>{inline(cell.tokens,seen)}</th>)}</tr></thead><tbody>{token.rows.map((row,n)=><tr key={n}>{row.map((cell,k)=><td className={torque?.columns.includes(k)?'torque-value-cell':torque?.stages&&k===0?'torque-stage-cell':undefined} key={k}>{/\bMotorcraft(?:®)?/i.test(cell.text||'')?<MaterialStatement>{inline(cell.tokens,seen)}</MaterialStatement>:inline(cell.tokens,seen)}</td>)}</tr>)}</tbody></table></div>;}
  if(token.type==='code')return <pre key={index}><code>{token.text}</code></pre>;
  if(token.type==='hr')return <hr key={index}/>;
  return null;
 });
}
export function Markdown({body}){const glossary=useGlossary();const tokens=useMemo(()=>annotateMarkdownTerms(marked.lexer(String(body||'')),glossary?.matcher,body=>marked.lexer(body)),[body,glossary?.matcher]);return <div className="prose"><MarkdownTokens tokens={tokens} seen={new Set()}/></div>;}
function Why({text}){return text?<div className="why-note"><Lightbulb size={16}/><div><span>WHY THIS MATTERS</span><Markdown body={text}/></div></div>:null;}
function MaterialStatement({children}){return <span className="material-statement"><span className="material-label"><FlaskConical size={14} aria-hidden="true"/> Specified material</span><span className="material-body">{children}</span></span>;}
function TorqueStatement({text,parts,children}){
 const lines=[];
 if(text!=null){let current={text:'',parts:[]};for(const part of parts||[{text}]){const pieces=part.text.split('\n');pieces.forEach((piece,index)=>{if(index){lines.push(current);current={text:'',parts:[]};}current.text+=piece;current.parts.push({...part,text:piece});});}lines.push(current);}
 const visible=lines.filter(line=>line.text.trim()),rows=[];
 const heading=/^Torque(?:\s+(?:specifications?|values?))?\s*:\s*$/i.test(visible[0]?.text.trim()||'')?visible.shift():null;
 for(let index=0;index<visible.length;index++){const line=visible[index],kind=torqueLineKind(line.text);if(line.text.trim().endsWith(':')&&['label','stage'].includes(kind)&&torqueLineKind(visible[index+1]?.text)==='value')rows.push({label:line,value:visible[++index],kind});else rows.push({value:line,kind});}
 return <span className="torque-spec"><span className="torque-spec-label"><RotateCw size={15} aria-hidden="true"/>{heading?<TermText text={heading.text} parts={heading.parts}/>: 'Torque specification'}</span><span className="torque-spec-body">{text!=null?rows.map((row,index)=><span key={index} className={'torque-spec-row'+(row.label?' has-label':'')+' torque-row-'+row.kind}>{row.label&&<span className="torque-row-label"><TermText text={row.label.text} parts={row.label.parts}/></span>}<span className="torque-row-value"><TermText text={row.value.text} parts={row.value.parts}/></span></span>):children}</span></span>;
}
function BlockText({block,media,onZoom,depth,withinTorqueTable=false,omitPunctuation=false}){
 if(block.textBlocks)return <div className="structured-guide-text"><BlockList blocks={block.textBlocks} media={media} onZoom={onZoom} depth={depth+1}/></div>;
 if((omitPunctuation||['step','list-item'].includes(block.type))&&!hasReadableText(block.text))return null;
 if(block.readingSegments||block.materialSegments)return (block.readingSegments||block.materialSegments).map((segment,index)=>segment.torque?(withinTorqueTable?<span className="torque-inline-value" key={index}><TermText text={segment.text} parts={segment.termParts}/></span>:<TorqueStatement key={index} text={segment.text} parts={segment.termParts}/>):segment.material?<MaterialStatement key={index}><TermText text={segment.text} parts={segment.termParts}/></MaterialStatement>:<TermText key={index} text={segment.text} parts={segment.termParts}/>);
 return <TermText text={block.type==='safety'?(callout(block.text)?.body||block.text):block.text} parts={block.termParts}/>;
}
function Block({block,media,onZoom,depth=0,seen}){
 const key=block.id,children=block.children||[];
 const text=<BlockText block={block} media={media} onZoom={onZoom} depth={depth}/>;
 if(block.diagramLabels)return <details className="diagram-labels"><summary><FileText size={15}/><span>Searchable diagram labels</span><ChevronDown size={15}/></summary><div><p>Text labels extracted for search; use the drawing for connections and pin assignments.</p><Block block={{...block,diagramLabels:false}} media={media} onZoom={onZoom} depth={depth} seen={seen}/></div></details>;
 if(block.type==='heading'){const Tag='h'+Math.min(4,Math.max(2,Number(block.level)||2));return <Tag id={'block-'+key} tabIndex={-1} className={'document-heading heading-tone-'+sectionTone(block.displayText||block.text)}><TermText text={block.displayText||block.text} parts={block.displayText?undefined:block.termParts}/></Tag>;}
 if(block.type==='paragraph')return <>{block.textBlocks?text:<p className="source-paragraph">{text}</p>}<Why text={block.why}/></>;
 if(block.type==='safety')return <Callout kind={block.severity||'note'}>{block.textBlocks?text:<p>{text}</p>}{children.length>0&&<BlockList blocks={children} media={media} onZoom={onZoom} depth={depth+1} seen={seen}/>}</Callout>;
 if(block.type==='step')return <section className={'repair-step '+(depth?'nested-step ':'')+(!hasReadableText(block.text)&&children.every(child=>['media','missing-media','video','video-link'].includes(child.type))?'illustrated-step':'')} id={'block-'+key}><div className="step-rail"><span>{Number.isFinite(Number(block.number))?Number(block.number):''}</span></div><div className="step-main">{(hasReadableText(block.text)||block.textBlocks?.length>0)&&<div className="step-instruction">{text}</div>}<Why text={block.why}/>{children.length>0&&<BlockList blocks={children} media={media} onZoom={onZoom} depth={depth+1} seen={seen}/>}</div></section>;
 if(block.type==='list'){const Tag=block.ordered?'ol':'ul';return <Tag className="source-list" start={block.ordered?block.start:undefined}>{(block.items||[]).map((item,index)=><li key={item.id||index} value={block.ordered?item.number:undefined}><BlockText block={item} media={media} onZoom={onZoom} depth={depth} omitPunctuation/>{item.children?.length>0&&<BlockList blocks={item.children} media={media} onZoom={onZoom} depth={depth+1} seen={seen}/>}</li>)}</Tag>;}
 if(block.type==='table'){const torque=block.torqueTable;return <div className={'table-scroll'+(block.connectorPins?' connector-pin-table':'')+(torque?.active?' torque-spec-table':'')} tabIndex={0} role="region" aria-label={block.caption||(torque?.active?'Torque specifications, scroll horizontally if needed':block.connectorPins?'Connector pin assignments, scroll horizontally for all columns':'Reference table, scroll horizontally if needed')}>{(block.caption||torque?.active)&&<div className={'table-label'+(torque?.active?' torque-table-label':'')}>{torque?.active?<RotateCw size={15} aria-hidden="true"/>:<ClipboardList size={14}/>} {block.caption||'Torque specifications'}</div>}{block.connectorPins&&<div className="table-scroll-hint"><ArrowRight size={13}/> Scroll horizontally to see all pin details.</div>}<table><tbody>{(block.rows||[]).map((row,index)=><tr key={row.id||index}>{(row.cells||[]).map((cell,n)=>{const Tag=cell.header?'th':'td';return <Tag key={cell.id||n} className={!cell.header&&torque?.columns.includes(n)?'torque-value-cell':!cell.header&&torque?.stages&&n===0?'torque-stage-cell':undefined} data-column={cell.columnKey} colSpan={cell.colSpan||undefined} rowSpan={cell.rowSpan||undefined} scope={cell.header?'col':undefined}>{cell.text&&<BlockText block={cell} media={media} onZoom={onZoom} depth={depth} withinTorqueTable={torque?.active}/>}<BlockList blocks={cell.blocks||[]} media={media} onZoom={onZoom} depth={depth+1} seen={seen}/></Tag>;})}</tr>)}</tbody></table></div>;}
 if(block.type==='media'){const figure=media.get(block.mediaId);return figure?<Figure figure={figure} onZoom={onZoom}/>:<div className="missing-media"><Info size={15}/> Illustration unavailable.</div>;}
 if(block.type==='video'&&safeHref(block.url))return <figure className="instruction-video"><video controls preload="metadata" playsInline src={block.url} aria-label={block.title||'Procedure demonstration'}><a href={block.url}>Open the procedure video</a></video><figcaption><PlayCircle size={16} aria-hidden="true"/>{block.title||'Procedure demonstration'}</figcaption></figure>;
 if(block.type==='video-link'&&safeHref(block.url))return <a className="instruction-video-link" href={block.url} target="_blank" rel="noreferrer"><PlayCircle size={20} aria-hidden="true"/><span>{block.title||'Watch the procedure demonstration'}</span><ArrowRight size={16} aria-hidden="true"/></a>;
 if(block.type==='missing-media')return <div className="missing-media"><Info size={15}/>{'Illustration unavailable.'}</div>;
 if(block.text)return <p><TermText text={block.text} parts={block.termParts}/></p>;
 return children.length?<BlockList blocks={children} media={media} onZoom={onZoom} depth={depth} seen={seen}/>:null;
}
export function BlockList({blocks=[],media=new Map(),onZoom,depth=0,seen=new Set()}){const glossary=useGlossary();const prepared=useMemo(()=>depth===0?annotateSourceTerms(blocks,glossary?.matcher):blocks,[blocks,glossary?.matcher,depth]);return <>{prepared.map((block,index)=>{if(block.type==='heading')seen=new Set();return <Block key={block.id||index} block={block} media={media} onZoom={onZoom} depth={depth} seen={seen}/>;})}</>;}
function collect(blocks,type,result=[]){for(const block of blocks||[]){if(block.type===type)result.push(block);collect(block.textBlocks,type,result);collect(block.children,type,result);for(const item of block.items||[])collect(item.children,type,result);for(const row of block.rows||[])for(const cell of row.cells||[])collect(cell.blocks,type,result);}return result;}
function ArticleContents({entries,onJump}){return entries.length>1?<nav className="article-contents" aria-label="In this article"><div className="article-contents-title"><ListTree size={18} aria-hidden="true"/><span>In this article</span></div><ul>{entries.map(entry=><li key={entry.id} className={'contents-level-'+entry.level+' contents-tone-'+(entry.tone||'blue')}><button type="button" onClick={()=>onJump(entry.id)}>{entry.title}<ArrowRight size={13} aria-hidden="true"/></button></li>)}</ul></nav>:null;}
function Requirements({items}){
 if(!items?.length)return null;
 const groups=items.map(group=>({category:group.category||'For this job',items:group.items||[group]}));
 return <section className="requirements" id="requirements"><div className="section-title"><span className="eyebrow">GET SET UP</span><h2>What you’ll need.</h2><p>Gather the items listed in this reference before you begin.</p></div><div className="requirements-grid">{groups.map((group,index)=><div key={index}><h3><Wrench size={15}/>{categoryName(group.category)}</h3>{group.items.map((item,n)=><CheckItem key={n}><strong>{typeof item==='string'?item:item.name||item.title||item.text}</strong>{typeof item==='object'&&(item.detail||item.description)&&<small>{item.detail||item.description}</small>}</CheckItem>)}</div>)}</div><small className="local-note">Checks stay on this screen. They do not confirm that a repair is complete.</small></section>;
}
export function DocumentReader({id,systems,onZoom,bookmarks,onBookmark,engine=''}){
 const [copied,setCopied]=useState(false);
 const glossary=useGlossary();
 const state=useApi('/documents/'+encodeURIComponent(id)+(engine?'?engine='+encodeURIComponent(engine):''));
 const data=state.data?.document||state.data;
 const system=systems.find(item=>item.id===data?.systemId);
 const calculatorType=data?.calculator?.type;
 const blocks=useMemo(()=>calculatorType?[]:readerBlocks(data?.blocks||[],data),[calculatorType,data]);
 const media=useMemo(()=>new Map((data?.media||[]).map(item=>[item.id,{...item,documentId:data.id}])),[data?.media]);
 const headings=useMemo(()=>readingOutline(blocks),[blocks]);
 const usedMedia=useMemo(()=>new Set(collect(blocks,'media').map(item=>item.mediaId)),[blocks]);
 const remainingMedia=[...media.values()].filter(item=>!usedMedia.has(item.id));
 const saved=bookmarks.some(item=>item.id===id),learningContext=topicContextForView(data),circuitContext=data?.circuitContext;
 const showTopicContext=learningContext&&circuitContext?.mode!=='curated';
 const outline=[
  ...(showTopicContext?[{id:'understand-topic',title:'Understand this topic',level:2,tone:'amber'},...(learningContext.sections||[]).map((section,index)=>({id:'topic-section-'+(section.id||index),title:section.title,level:3,tone:['amber','blue','green'][index%3]}))]:[]),
  ...(circuitContext?[{id:'understand-circuit',title:'How this circuit works',level:2,tone:'amber'},...[
   ['components','circuit-components','What the components do'],['connections','circuit-paths','What connects to what'],['circuits','circuit-terminals','Circuit and connector map'],['continuations','circuit-continuations','Follow the circuit further'],['readingGuide','circuit-reading-guide','Make sense of the drawing']
  ].filter(([key])=>circuitContext[key]?.length).map(([,id,title])=>({id,title,level:3,tone:'blue'}))]:[]),
  ...(data?.requirements?.length?[{id:'requirements',title:'What you’ll need',level:2,tone:'green'}]:[]),
  ...headings,
  ...(remainingMedia.length?[{id:'additional-figures',title:'See the details',level:2,tone:'blue'}]:[]),
  ...(hasPartsContent(data?.parts)?[{id:'parts',title:'Parts',level:2,tone:'green'}]:[]),
  ...(data?.maintenance?.items?.length?[{id:'care-and-maintenance',title:'Care and maintenance',level:2,tone:'green'}]:[]),
  ...(relatedWorkshopGuides(data?.workshopGuides).length?[{id:'workshop-guides',title:'Care and repair guides',level:2,tone:'blue'}]:[])
 ].filter((entry,index,all)=>entry.title&&all.findIndex(item=>item.id===entry.id)===index);
 async function copy(){try{await navigator.clipboard.writeText(window.location.href);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{}}
 function jump(blockId){const target=document.getElementById(blockId);if(!target)return;if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
 if(state.loading)return <Loading label="Opening the article…"/>;
 if(state.error)return <ErrorState message={state.error} retry={state.retry}/>;
 if(!data)return null;
 const mismatch=engine&&(data.applicability?.matchesSelectedEngine===false||(data.engines?.length&&!data.engines.includes(engine)));
 const engineLabel=data.engines?.length?data.engines.join(' · '):'Shared systems · check equipment';
 return <GlossaryProvider terms={glossary?.terms||[]} open={glossary?.open} context={{system:data.systemId,title:data.section?.title}}>
 <div className="document-page page-in">
  <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="#/library">Library</a><span>/</span><a href={'#/library?system='+encodeURIComponent(data.systemId||'')}>{system?.title||categoryName(data.systemId)}</a>{data.section?.code&&<><span>/</span><a href={'#/library?'+new URLSearchParams({system:data.systemId,section:data.section.code})}>{data.section.title||data.section.code}</a></>}</nav>
  <header className="document-header">
   <div className="document-kicker"><Badge tone="amber">{categoryName(data.kind)}</Badge><span>{engineLabel}</span></div>
   <h1>{documentTitle(data)}</h1>
   {data.section?.title&&<p>{data.section.title}</p>}
   <div className="document-toolbar"><span className="article-toolbar-label"><BookOpen size={17}/> Your workshop companion</span><div><button className={'icon-button '+(saved?'active':'')} onClick={()=>onBookmark(data)} aria-label={saved?'Remove saved article':'Save article'} title={saved?'Saved':'Save article'}><Bookmark size={17} fill={saved?'currentColor':'none'}/></button><button className="icon-button" onClick={copy} aria-label="Copy link" title="Copy link">{copied?<Check size={17}/>:<Link size={17}/>}</button><button className="icon-button" onClick={()=>window.print()} aria-label="Print article" title="Print"><Printer size={17}/></button></div></div>
  </header>
  {!mismatch&&data.thumbnail?.generated&&<ArticleThumbnail item={data} className="document-cover"/>}
  {mismatch?<section className="engine-mismatch"><Info size={24}/><h2>This article belongs to a different engine.</h2><p>It covers {data.engines.join(', ')}. Your filter is set to {engine}. Choose All or a matching engine in the top-right selector to read it.</p><a className="text-link" href={'#/library?system='+encodeURIComponent(data.systemId)}>Find articles for your engine <ArrowRight size={16}/></a></section>:<div className="document-layout">
   <article className="article-body" aria-label="Workshop article">
    <ArticleContents entries={outline} onJump={jump}/>
    {showTopicContext&&<TopicContext context={learningContext}/>}
    {circuitContext&&<CircuitContext context={circuitContext}/>}
    {!learningContext&&!circuitContext&&!data.introduction&&data.kind==='overview'&&<SystemLearning system={system} expanded/>}
    {!learningContext&&!circuitContext&&data.introduction&&<section className="article-introduction"><span className="eyebrow">UNDERSTAND THE JOB</span><Markdown body={typeof data.introduction==='string'?data.introduction:data.introduction.body||data.introduction.text}/></section>}
    <Requirements items={data.requirements}/>
    {calculatorType&&<TorqueCalculator calculatorType={calculatorType}/>}
    <div className="document-blocks"><BlockList blocks={blocks} media={media} onZoom={onZoom}/></div>
    {remainingMedia.length>0&&<section id="additional-figures" className="additional-figures"><div className="section-title"><span className="eyebrow">A CLOSER LOOK</span><h2>See the details.</h2></div><FigureGrid figures={remainingMedia} onZoom={onZoom}/></section>}
    <PartsPanel data={data.parts}/>
    <MaintenancePanel data={data.maintenance}/>
    <WorkshopGuidePanel items={data.workshopGuides}/>
    {data.related?.length>0&&<section className="related-references"><div className="section-title"><span className="eyebrow">KEEP GOING</span><h2>Connected articles.</h2></div>{data.related.map(doc=><a href={'#/document/'+encodeURIComponent(doc.id)} key={doc.id}>{doc.thumbnail&&<img className="related-thumbnail" src={doc.thumbnail.url} alt="" loading="lazy"/>}<span><small>{categoryName(doc.kind)}</small><strong>{readableTitle(doc.title)}</strong></span><ArrowRight size={17}/></a>)}</section>}
   </article>
   <aside className="reader-aside"><div className="reader-aside-inner"><div className="reference-facts"><span className="eyebrow">AT A GLANCE</span><dl><div><dt>System</dt><dd>{system?.title||categoryName(data.systemId)}</dd></div><div><dt>Article type</dt><dd>{categoryName(data.kind)}</dd></div><div><dt>Illustrations</dt><dd>{data.media?.length||0}</dd></div><div><dt>Engine</dt><dd>{engineLabel}</dd></div></dl></div></div></aside>
  </div>}
 </div></GlossaryProvider>;
}

import React,{useMemo,useState} from 'react';
import {marked} from 'marked';
import {AlertTriangle,ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,Bookmark,Check,ChevronDown,ClipboardList,FileText,Info,Lightbulb,Link,Printer,ShieldCheck,Wrench} from 'lucide-react';
import {useApi} from './hooks.js';
import {readableTitle,documentTitle,readerBlocks,callout,safeHref,categoryName,annotateSourceTerms,annotateMarkdownTerms} from './content-model.mjs';
import {TermText,useGlossary,GlossaryProvider} from './Glossary.jsx';
import SystemLearning from './SystemLearning.jsx';
import TopicContext from './TopicContext.jsx';
import {topicContextForView} from './topic-context-model.mjs';
import TorqueCalculator from './TorqueCalculator.jsx';
import PartsPanel from './PartsPanel.jsx';
import './reader-refresh.css';
import {Badge,Loading,ErrorState,Figure,FigureGrid,Sources,CheckItem} from './ui.jsx';
const calloutLabels={warning:'Warning',caution:'Caution',notice:'Notice',note:'Note',tip:'A helpful tip',important:'Before you continue',explanation:'In plain English'};
export function Callout({kind='note',children}){const Icon=/warning|caution/.test(kind)?AlertTriangle:kind==='tip'?Lightbulb:Info;return <aside className={'callout callout-'+kind}><div><Icon size={17}/><strong>{calloutLabels[kind]||categoryName(kind)}</strong></div><div className="callout-body">{children}</div></aside>;}
function inline(tokens,seen,linked=false){return (tokens||[]).map((token,index)=>{const nested=()=>inline(token.tokens,seen,linked);if(token.type==='strong')return <strong key={index}>{nested()}</strong>;if(token.type==='em')return <em key={index}>{nested()}</em>;if(token.type==='codespan')return <code key={index}>{token.text}</code>;if(token.type==='br')return <br key={index}/>;if(token.type==='link'){const href=safeHref(token.href);return href?<a href={href} key={index} target={/^https?:/.test(href)?'_blank':undefined} rel={/^https?:/.test(href)?'noreferrer':undefined}>{inline(token.tokens,seen,true)}</a>:<span key={index}>{nested()}</span>;}return <React.Fragment key={index}>{token.tokens?nested():linked?token.text:<TermText text={token.text||''} parts={token.termParts}/>}</React.Fragment>;});}
function MarkdownTokens({tokens,seen}){return (tokens||[]).map((token,index)=>{if(token.type==='heading'){seen=new Set();const Tag='h'+Math.max(2,Math.min(4,token.depth));return <Tag key={index}>{inline(token.tokens,seen)}</Tag>;}if(token.type==='paragraph'||token.type==='text')return <p key={index}>{inline(token.tokens||marked.Lexer.lexInline(token.text||''),seen)}</p>;if(token.type==='blockquote'){const notice=token.atlasCallout||callout(token.text);return notice?<Callout kind={notice.kind} key={index}><MarkdownTokens tokens={token.atlasCallout?token.tokens:marked.lexer(notice.body)} seen={seen}/></Callout>:<blockquote key={index}><MarkdownTokens tokens={token.tokens} seen={seen}/></blockquote>;}if(token.type==='list'){const Tag=token.ordered?'ol':'ul';return <Tag key={index} start={token.ordered?token.start:undefined}>{token.items.map((item,n)=><li key={n}><MarkdownTokens tokens={item.tokens} seen={seen}/></li>)}</Tag>;}if(token.type==='table')return <div className="table-scroll" tabIndex={0} role="region" aria-label="Reference table, scroll horizontally if needed" key={index}><table><thead><tr>{token.header.map((cell,n)=><th scope="col" key={n}>{inline(cell.tokens,seen)}</th>)}</tr></thead><tbody>{token.rows.map((row,n)=><tr key={n}>{row.map((cell,k)=><td key={k}>{inline(cell.tokens,seen)}</td>)}</tr>)}</tbody></table></div>;if(token.type==='code')return <pre key={index}><code>{token.text}</code></pre>;if(token.type==='hr')return <hr key={index}/>;return null;});}
export function Markdown({body}){const glossary=useGlossary();const tokens=useMemo(()=>annotateMarkdownTerms(marked.lexer(String(body||'')),glossary?.matcher,body=>marked.lexer(body)),[body,glossary?.matcher]);return <div className="prose"><MarkdownTokens tokens={tokens} seen={new Set()}/></div>;}
function Why({text}){return text?<div className="why-note"><Lightbulb size={16}/><div><span>WHY THIS MATTERS</span><Markdown body={text}/></div></div>:null;}
function BlockText({block,media,onZoom,depth}){return block.textBlocks?<div className="structured-guide-text"><BlockList blocks={block.textBlocks} media={media} onZoom={onZoom} depth={depth+1}/></div>:<TermText text={block.type==='safety'?(callout(block.text)?.body||block.text):block.text} parts={block.termParts}/>;}
function Block({block,media,onZoom,depth=0,seen}){
 const key=block.id,children=block.children||[];
 const text=<BlockText block={block} media={media} onZoom={onZoom} depth={depth}/>;
 if(block.diagramLabels)return <details className="diagram-labels"><summary><FileText size={15}/><span>Searchable diagram labels</span><ChevronDown size={15}/></summary><div><p>Text labels extracted for search; use the drawing for connections and pin assignments.</p><Block block={{...block,diagramLabels:false}} media={media} onZoom={onZoom} depth={depth} seen={seen}/></div></details>;
 if(block.type==='heading'){const Tag='h'+Math.min(4,Math.max(2,Number(block.level)||2));return <Tag id={'block-'+key} className="document-heading"><TermText text={block.text} parts={block.termParts}/></Tag>;}
 if(block.type==='paragraph')return <>{block.textBlocks?text:<p className="source-paragraph">{text}</p>}<Why text={block.why}/></>;
 if(block.type==='safety')return <Callout kind={block.severity||'note'}>{block.textBlocks?text:<p>{text}</p>}{children.length>0&&<BlockList blocks={children} media={media} onZoom={onZoom} depth={depth+1} seen={seen}/>}</Callout>;
 if(block.type==='step')return <section className={'repair-step '+(depth?'nested-step':'')} id={'block-'+key}><div className="step-rail"><span>{Number.isFinite(Number(block.number))?Number(block.number):''}</span></div><div className="step-main"><div className="step-instruction">{text}</div><Why text={block.why}/>{children.length>0&&<BlockList blocks={children} media={media} onZoom={onZoom} depth={depth+1} seen={seen}/>}</div></section>;
 if(block.type==='list'){const Tag=block.ordered?'ol':'ul';return <Tag className="source-list" start={block.ordered?block.start:undefined}>{(block.items||[]).map((item,index)=><li key={item.id||index} value={block.ordered?item.number:undefined}><BlockText block={item} media={media} onZoom={onZoom} depth={depth}/>{item.children?.length>0&&<BlockList blocks={item.children} media={media} onZoom={onZoom} depth={depth+1} seen={seen}/>}</li>)}</Tag>;}
 if(block.type==='table')return <div className={'table-scroll'+(block.connectorPins?' connector-pin-table':'')} tabIndex={0} role="region" aria-label={block.caption||(block.connectorPins?'Connector pin assignments, scroll horizontally for all columns':'Reference table, scroll horizontally if needed')}>{block.caption&&<div className="table-label"><ClipboardList size={14}/>{block.caption}</div>}{block.connectorPins&&<div className="table-scroll-hint"><ArrowRight size={13}/> Scroll horizontally to see all pin details.</div>}<table><tbody>{(block.rows||[]).map((row,index)=><tr key={row.id||index}>{(row.cells||[]).map((cell,n)=>{const Tag=cell.header?'th':'td';return <Tag key={cell.id||n} data-column={cell.columnKey} colSpan={cell.colSpan||undefined} rowSpan={cell.rowSpan||undefined} scope={cell.header?'col':undefined}>{cell.text&&<BlockText block={cell} media={media} onZoom={onZoom} depth={depth}/>}<BlockList blocks={cell.blocks||[]} media={media} onZoom={onZoom} depth={depth+1} seen={seen}/></Tag>;})}</tr>)}</tbody></table></div>;
 if(block.type==='media'){const figure=media.get(block.mediaId);return figure?<Figure figure={figure} onZoom={onZoom}/>:<div className="missing-media"><Info size={15}/> Illustration unavailable.</div>;}
 if(block.type==='missing-media')return <div className="missing-media"><Info size={15}/>{'Illustration unavailable.'}</div>;
 if(block.text)return <p><TermText text={block.text} parts={block.termParts}/></p>;
 return children.length?<BlockList blocks={children} media={media} onZoom={onZoom} depth={depth} seen={seen}/>:null;
}
export function BlockList({blocks=[],media=new Map(),onZoom,depth=0,seen=new Set()}){const glossary=useGlossary();const prepared=useMemo(()=>depth===0?annotateSourceTerms(blocks,glossary?.matcher):blocks,[blocks,glossary?.matcher,depth]);return <>{prepared.map((block,index)=>{if(block.type==='heading')seen=new Set();return <Block key={block.id||index} block={block} media={media} onZoom={onZoom} depth={depth} seen={seen}/>;})}</>;}
function collect(blocks,type,result=[]){for(const block of blocks||[]){if(block.type===type)result.push(block);collect(block.children,type,result);for(const item of block.items||[])collect(item.children,type,result);for(const row of block.rows||[])for(const cell of row.cells||[])collect(cell.blocks,type,result);}return result;}
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
 const headings=useMemo(()=>collect(blocks,'heading').filter(item=>Number(item.level||2)<=3),[blocks]);
 const usedMedia=useMemo(()=>new Set(collect(blocks,'media').map(item=>item.mediaId)),[blocks]);
 const remainingMedia=[...media.values()].filter(item=>!usedMedia.has(item.id));
 const saved=bookmarks.some(item=>item.id===id),learningContext=topicContextForView(data);
 async function copy(){try{await navigator.clipboard.writeText(window.location.href);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{}}
 function jump(blockId){document.getElementById(blockId)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
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
  {mismatch?<section className="engine-mismatch"><Info size={24}/><h2>This article belongs to a different engine.</h2><p>It covers {data.engines.join(', ')}. Your filter is set to {engine}. Choose All or a matching engine in the top-right selector to read it.</p><a className="text-link" href={'#/library?system='+encodeURIComponent(data.systemId)}>Find articles for your engine <ArrowRight size={16}/></a></section>:<div className="document-layout">
   <article className="article-body" aria-label="Workshop article">
    {learningContext&&<TopicContext context={learningContext}/>}
    {!learningContext&&!data.introduction&&data.kind==='overview'&&<SystemLearning system={system} expanded/>}
    {!learningContext&&data.introduction&&<section className="article-introduction"><span className="eyebrow">UNDERSTAND THE JOB</span><Markdown body={typeof data.introduction==='string'?data.introduction:data.introduction.body||data.introduction.text}/></section>}
    <Requirements items={data.requirements}/>
    {calculatorType&&<TorqueCalculator calculatorType={calculatorType}/>}
    <div className="document-blocks"><BlockList blocks={blocks} media={media} onZoom={onZoom}/></div>
    {remainingMedia.length>0&&<section className="additional-figures"><div className="section-title"><span className="eyebrow">A CLOSER LOOK</span><h2>See the details.</h2></div><FigureGrid figures={remainingMedia} onZoom={onZoom}/></section>}
    <PartsPanel data={data.parts} onZoom={onZoom}/>
    {data.related?.length>0&&<section className="related-references"><div className="section-title"><span className="eyebrow">KEEP GOING</span><h2>Connected articles.</h2></div>{data.related.map(doc=><a href={'#/document/'+encodeURIComponent(doc.id)} key={doc.id}>{doc.thumbnail&&<img className="related-thumbnail" src={doc.thumbnail.url} alt="" loading="lazy"/>}<span><small>{categoryName(doc.kind)}</small><strong>{readableTitle(doc.title)}</strong></span><ArrowRight size={17}/></a>)}</section>}
   </article>
   <aside className="reader-aside"><div className="reader-aside-inner"><span className="eyebrow">IN THIS ARTICLE</span><nav aria-label="On this page">{learningContext&&<button onClick={()=>jump('understand-topic')}>Understand this topic</button>}{data.requirements?.length>0&&<button onClick={()=>jump('requirements')}>What you’ll need</button>}{headings.map((heading,index)=><button key={heading.id||index} onClick={()=>jump('block-'+heading.id)}>{readableTitle(heading.text)}</button>)}{data.parts&&<button onClick={()=>jump('parts-and-diagrams')}>Parts & diagrams</button>}</nav><div className="reference-facts"><span className="eyebrow">AT A GLANCE</span><dl><div><dt>System</dt><dd>{system?.title||categoryName(data.systemId)}</dd></div><div><dt>Article type</dt><dd>{categoryName(data.kind)}</dd></div><div><dt>Illustrations</dt><dd>{data.media?.length||0}</dd></div><div><dt>Engine</dt><dd>{engineLabel}</dd></div></dl></div><div className="reader-hint"><Lightbulb size={18}/><strong>Curious about a part?</strong><p>Underlined component names open a quick explanation. Your place stays right here.</p><span className="term-example">steering gear <span>i</span></span></div></div></aside>
  </div>}
 </div></GlossaryProvider>;
}

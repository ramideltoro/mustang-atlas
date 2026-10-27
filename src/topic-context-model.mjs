import {articleSummary} from '../shared/summary.mjs';
export function topicContextForView(document,view='guide'){
 const context=document?.learningContext;
 return view==='guide'&&context?.status==='complete'&&typeof context.summary==='string'&&context.summary.trim()&&Array.isArray(context.sections)&&context.sections.length?context:null;
}


export function contextRelatedTerms(terms=[]){
 const seen=new Set();
 return terms.filter(term=>{if(!term?.id||!term.name||seen.has(term.id))return false;seen.add(term.id);return true;});
}
import {marked} from 'marked';


// Detailed explanations and reference tables need a readable full-width line,
// rather than being squeezed into the compact two-card layout.
export function contextReadingLayout(sections=[]){
 const hasTable=tokens=>(tokens||[]).some(token=>token.type==='table'||hasTable(token.tokens)||token.items?.some(item=>hasTable(item.tokens)));
 return sections.some(section=>{
  const body=String(section.body||'');
  return body.trim().split(/\s+/).length>100||hasTable(marked.lexer(body));
 });
}

export function documentRowSummary(document={}){
 const fallback=document.section?.title||'Open the complete article.';
 return articleSummary(document.learningStatus==='complete'?(document.learningContext?.summary||document.summary||fallback):(document.snippet||document.summary||fallback));
}
export function documentExplanationLabel(document={}){
 return document.teachingStatus==='complete'?'Explained':document.learningStatus==='complete'?'Topic explained':null;
}

export function showArticleIntroduction(document){return Boolean(document?.introduction&&(document.editorial?.teachingVersion==='enthusiast-v2'||(!topicContextForView(document)&&!document.circuitContext)));}

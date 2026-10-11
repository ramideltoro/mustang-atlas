export function topicContextForView(document,view='guide'){
 const context=document?.learningContext;
 return view==='guide'&&context?.status==='complete'&&typeof context.summary==='string'&&context.summary.trim()&&Array.isArray(context.sections)&&context.sections.length?context:null;
}

export function readerEditorialText(status,view,hasContext=false){
 if(view==='source')return 'Original manual content, arranged for on-screen reading.';
 if(status==='complete')return 'A plain-language Atlas guide, grounded in the source manual.';
 if(status==='partial')return hasContext?'A plain-language introduction, followed by explained passages and original source instructions.':'This reference combines explained passages with original source instructions.';
 return hasContext?'Plain-language context comes first. Technical details below retain the original manual wording.':'Original source instructions, organized for easier reading. A plain-language guide has not yet been added.';
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

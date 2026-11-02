import React,{useMemo} from 'react';
import {useGlossary} from './Glossary.jsx';
import './local-article.css';

const ALLOWED=new Set('article section header footer nav aside div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd table caption colgroup col thead tbody tfoot tr th td strong b em i u s small sub sup code pre blockquote hr br a img figure figcaption details summary abbr'.split(' '));
const DROP=new Set('script style iframe object embed svg math template form input button textarea select link meta base noscript'.split(' '));
function url(value,image=false){const v=String(value||'').trim();if(!v||/[\u0000-\u0020\u007f\\]/.test(v))return null;if(image)return /^\/media\/[a-zA-Z0-9._/-]+$/.test(v)&&!v.includes('..')?v:null;return /^(https?:\/\/|\/[^/]|#)/i.test(v)?v:null;}
export function sanitizeLocalArticle(html,matcher){
 if(typeof DOMParser==='undefined')return '';
 const parsed=new DOMParser().parseFromString(String(html||''),'text/html');
 const doc=document.implementation.createHTMLDocument(''),root=doc.createElement('div');
 function copy(node,parent){
  if(node.nodeType===3){parent.append(doc.createTextNode(node.textContent));return;}
  if(node.nodeType!==1)return;
  const tag=node.tagName.toLowerCase();if(DROP.has(tag))return;
  if(!ALLOWED.has(tag)){for(const child of node.childNodes)copy(child,parent);return;}
  const out=doc.createElement(tag);for(const name of ['title','alt','aria-label'])if(node.hasAttribute(name))out.setAttribute(name,node.getAttribute(name));
  if(node.id)out.id='local-article-'+node.id;
  if(tag==='a'){const href=url(node.getAttribute('href'));if(href){out.setAttribute('href',href.startsWith('#')&&!href.startsWith('#/')?'#local-article-'+href.slice(1):href);if(/^https?:/i.test(href)){out.target='_blank';out.rel='noopener noreferrer';}}}
  if(tag==='img'){const src=url(node.getAttribute('src'),true);if(!src)return;out.src=src;out.loading='lazy';out.decoding='async';if(!out.hasAttribute('alt'))out.alt='';}
  for(const name of ['colspan','rowspan','start','value','width','height'])if(node.hasAttribute(name)&&/^\d{1,4}$/.test(node.getAttribute(name)))out.setAttribute(name,node.getAttribute(name));
  if(tag==='th'&&['col','row','colgroup','rowgroup'].includes(node.getAttribute('scope')))out.setAttribute('scope',node.getAttribute('scope'));
  for(const child of node.childNodes)copy(child,out);parent.append(out);
 }
 for(const child of parsed.body.childNodes)copy(child,root);
 for(const table of [...root.querySelectorAll('table')]){const wrap=doc.createElement('div');wrap.className='local-article-table';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',table.querySelector('caption')?.textContent||'Article table; scroll horizontally for all columns');table.replaceWith(wrap);wrap.append(table);}
 if(matcher){const walker=doc.createTreeWalker(root,4),nodes=[];while(walker.nextNode())if(!walker.currentNode.parentElement.closest('a,abbr,code,pre,h1,h2,h3,h4,h5,h6,nav'))nodes.push(walker.currentNode);const seen=new Set();for(const text of nodes){const parts=matcher(text.textContent,seen)||[];if(!parts.some(p=>p.term))continue;const fragment=doc.createDocumentFragment();for(const part of parts){if(part.term){const button=doc.createElement('button');button.type='button';button.className='term-link';button.dataset.localTerm=part.term.id;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-label','Explain '+(part.term.name||part.text));button.textContent=part.text;fragment.append(button);}else fragment.append(doc.createTextNode(part.text));}text.replaceWith(fragment);}}
 return root.innerHTML;
}
export default function LocalArticle({article}){
 const glossary=useGlossary();
 const html=useMemo(()=>sanitizeLocalArticle(article?.articleHtml,glossary?.open?glossary.matcher:null),[article?.articleHtml,glossary?.matcher,glossary?.open]);
 const onClick=event=>{const term=event.target.closest('[data-local-term]');if(term){glossary?.open?.(term.dataset.localTerm);return;}const link=event.target.closest('a[href^="#local-article-"]');if(link){event.preventDefault();event.stopPropagation();const id=link.getAttribute('href').slice(1),target=[...event.currentTarget.querySelectorAll('[id]')].find(node=>node.id===id);if(target){target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});target.tabIndex=-1;target.focus({preventScroll:true});}}};
 return <section className="local-article" aria-label="Local editorial article">{article?.review?.kind==='local-model-review'&&<p className="local-article-review">Technical review by local model{article.review.model?` · ${article.review.model}`:''}</p>}<div className="local-article-content" onClick={onClick} dangerouslySetInnerHTML={{__html:html}}/></section>;
}

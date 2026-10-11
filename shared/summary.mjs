import {marked} from 'marked';
export function articleSummary(value,limit=240){
 function plain(tokens){return (tokens||[]).map(token=>{
  if(token.type==='html'||token.type==='image')return '';
  if(token.tokens)return plain(token.tokens);
  if(token.items)return token.items.map(item=>plain(item.tokens)).join(' ');
  return token.text??token.raw??'';
 }).join('');}
 const text=plain(marked.lexer(String(value||''))).replace(/\s+/g,' ').trim();
 if(text.length<=limit)return text;
 const prefix=text.slice(0,limit+1),space=prefix.lastIndexOf(' ');
 return prefix.slice(0,space>limit*.6?space:limit).replace(/[ ,;:—–-]+$/,'')+'…';
}

// Presentation only: recognize explicit torque units and sequences without
// converting values, supplying missing units, or inferring tightening actions.
const unitSource=String.raw`(?:N\s*[.·*]?\s*m|lb[s]?\s*[.·*\-]?\s*(?:ft|in)|(?:ft|in)\s*[.·*\-]?\s*lb[s]?|newton[ -]met(?:er|re)s?|pound[ -](?:feet|foot|inches?))`;
const valuePattern=new RegExp(String.raw`\b\d[\d,.]*(?:\s*[-–—]\s*\d[\d,.]*)?\s*${unitSource}\b`,'i');
const unitHeader=new RegExp(String.raw`^\s*${unitSource}\s*$`,'i');
const stagePattern=/^\s*(?:\*\*)?Stage\s+\d+\b/i;
const anglePattern=/\d(?:[\d,.]*)\s*(?:°|degrees?\b|turns?\b)/i;
export const hasTorqueValue=value=>valuePattern.test(String(value||''));
const plain=value=>String(value||'').replace(/\*\*|__/g,'').trim();

export function torqueSegments(value){
 const text=String(value||''),lines=text.match(/[^\n]*(?:\n|$)/g)?.filter(Boolean)||[],selected=lines.map(hasTorqueValue);
 const label=line=>/^[\p{L}\p{N} ()/&.,–—-]{1,70}:\s*$/u.test(plain(line));
 const action=line=>/^(?:loosen|tighten|rotate|turn)\s*:?/i.test(plain(line))&&anglePattern.test(line);
 const standaloneAngle=line=>/^\s*(?:\d[\d,.]*\s*(?:°|degrees?|turns?))[.\s]*$/i.test(plain(line));
 for(let index=0;index<lines.length;index++){
  if(/^Torque(?:\s+(?:specifications?|values?))?\s*:/i.test(plain(lines[index]))){
   let end=index+1,hasValue=hasTorqueValue(lines[index])||anglePattern.test(lines[index]);
   while(end<lines.length){const line=lines[end];if(!line.trim()||hasTorqueValue(line)||stagePattern.test(plain(line))||label(line)||action(line)||standaloneAngle(line)){hasValue||=hasTorqueValue(line)||anglePattern.test(line);end++;}else break;}
   if(hasValue)for(let n=index;n<end;n++)selected[n]=true;
  }
  if(stagePattern.test(plain(lines[index]))){
   let end=index+1;while(end<lines.length&&!lines[end].trim())end++;
   if(hasTorqueValue(lines[index])||anglePattern.test(lines[index]))selected[index]=true;
   else if(end<lines.length&&(hasTorqueValue(lines[end])||action(lines[end])||standaloneAngle(lines[end])))for(let n=index;n<=end;n++)selected[n]=true;
  }
 }
 // Keep blank lines within an explicit sequence, but do not consume unrelated prose.
 for(let index=0;index<lines.length;index++)if(!lines[index].trim()&&selected[index-1]){let end=index+1;while(end<lines.length&&!lines[end].trim())end++;if(selected[end])for(let n=index;n<end;n++)selected[n]=true;}
 const result=[];
 lines.forEach((line,index)=>{const torque=selected[index],last=result.at(-1);if(last&&last.torque===torque)last.text+=line;else result.push({text:line,torque});});
 return result;
}

export function torqueLineKind(text){const value=plain(text);if(!value)return 'space';if(stagePattern.test(value))return 'stage';if(hasTorqueValue(value)||anglePattern.test(value))return 'value';if(value.endsWith(':'))return 'label';return 'text';}

/** Metadata for existing tables; cells, spans, values and row order are untouched. */
export function torqueTable(rows=[]){
 const text=cell=>String(cell.text||'')+' '+(cell.blocks||[]).map(block=>block.text||'').join(' ');
 const cells=row=>row.cells||row;
 const first=cells(rows[0]||[]),headers=first.map(text),all=rows.flatMap(row=>cells(row).map(text));
 const columns=headers.flatMap((header,index)=>unitHeader.test(plain(header))||/^torque(?:\s+(?:specifications?|values?))?(?:\s*\([^)]*\))?$/i.test(plain(header))?[index]:[]);
 const stages=headers.some(header=>/^stage$/i.test(plain(header)))&&all.some(hasTorqueValue);
 return {active:columns.length>0||stages,columns,stages};
}

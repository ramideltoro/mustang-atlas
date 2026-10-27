// Narrow, evidence-bound wording clarification before independent review.
// Never changes source action blocks or diagnostic operating-state instructions.
export const GENERAL_SAFETY_HASH='b8df890dc5cbc1d8cfa5ead5ac004d186b3cddeb6e6577248a2f269c41c69c6a';
export function clarifyStartupPreparation(draft,{kind,supportingSourceRefs=[]}={}) {
 const changes=[];
 if(kind!=='repair'||!supportingSourceRefs.some(r=>r.documentId==='G1693189'&&r.sourceHash===GENERAL_SAFETY_HASH&&!r.navigationOnly))return changes;
 for(const group of draft.requirements||[])for(const item of group.items||[]){
  const before=item.detail;if(typeof before!=='string')continue;
  let after=before.replace(/remove the key\b(?: from the vehicle)?/gi,(match,offset)=>{
   const prefix=before.slice(Math.max(before.lastIndexOf('.',offset),before.lastIndexOf('\n',offset))+1,offset);
   if(/ignition\s+off|(?:switch|turn)\s+off\s+(?:the\s+)?ignition/i.test(prefix+' '+item.name))return match;
   return (match[0]==='R'?'Switch':'switch')+' the ignition OFF and remove the key from the vehicle';
  });
  after=after.replace(/disable (the )?remote start( feature)? (using|through)/i,(match,the='',feature='',via,offset)=>{
   const prefix=after.slice(Math.max(after.lastIndexOf('.',offset),after.lastIndexOf('\n',offset))+1,offset);
   if(/if equipped|when equipped|if fitted/i.test(prefix+' '+item.name))return match;
   return match.slice(0,1)+'isable '+the+'remote start'+feature+', if equipped, '+via;
  });
  if(after!==before){item.detail=after;changes.push({category:group.category,item:item.name,before,after});}
 }
 return changes;
}

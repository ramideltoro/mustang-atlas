import {validateEdits,validateGuide,VALIDATION_VERSION} from '../server/guide-validation.mjs';
export function documentEvents(blocks){const events=[];function visit(items){for(const b of items||[]){if(b.mediaId)events.push({mediaId:b.mediaId});if(b.id&&b.text?.trim()&&['heading','paragraph','safety','step','list-item'].includes(b.type))events.push({blockId:b.id});visit(b.children);for(const item of b.items||[]){if(item.id&&item.text?.trim())events.push({blockId:item.id});visit(item.children);}for(const row of b.rows||[])for(const cell of row.cells||[])visit(cell.blocks);}}visit(blocks);return events;}
export function chunkMedia(doc,leaves){
 if(!doc.media?.length)return [];
 if(!doc.leaves.length||leaves.length===doc.leaves.length)return doc.media;
 const events=doc.events||documentEvents(doc.blocks),selected=new Set(leaves.map(l=>l.id));const starts=events.map((e,i)=>selected.has(e.blockId)?i:-1).filter(i=>i>=0);if(!starts.length)return [];
 let start=starts[0],end=starts.at(-1)+1;while(end<events.length&&!events[end].blockId)end++;
 if(doc.leaves[0]?.id===leaves[0]?.id)start=0;
 const ids=new Set(events.slice(start,end).map(e=>e.mediaId).filter(Boolean));
 // Include the nearest preceding illustration as explicitly identified context.
 for(let i=start-1;i>=0;i--)if(events[i].mediaId){ids.add(events[i].mediaId);break;}
 return doc.media.filter(m=>ids.has(m.id));
}
export function selectChunk(doc,remaining,{maxChars=22000,maxImages=12}={}){
 const leaves=[];let chars=0,media=doc.leaves.length?[]:doc.media||[];
 for(const leaf of remaining){const proposed=[...leaves,leaf],nextMedia=chunkMedia(doc,proposed);if(leaves.length&&(chars+leaf.text.length>maxChars||nextMedia.length>maxImages))break;leaves.push(leaf);chars+=leaf.text.length;media=nextMedia;}
 return {doc,leaves,chars,media};
}
export function validPublishedGuide(doc,guide){return validateGuide(doc,guide,{curatedContext:doc.teachingContext}).passed;}
export function resumeCheckpoint(doc,previous){
 if(!previous||previous.sourceHash!==doc.source_hash)return null;
 const evidence=doc.evidence;const safe={...previous,edits:{}};let changed=previous.validationVersion!==VALIDATION_VERSION;
 const metadata=validateEdits([],{edits:[],title:previous.title,introduction:previous.introduction,requirements:previous.requirements},{evidence});if(!metadata.passed)return null;
 for(const leaf of doc.leaves){const edit=previous.edits?.[leaf.id];if(edit){if(validateEdits([leaf],{edits:[edit]},{evidence,checkMetadata:false}).passed)safe.edits[leaf.id]=edit;else changed=true;}}
 if(Object.keys(safe.edits).length!==Object.keys(previous.edits||{}).length)changed=true;
 if(changed){safe.attempts=0;delete safe.error;}
 safe.validationVersion=VALIDATION_VERSION;return safe;
}

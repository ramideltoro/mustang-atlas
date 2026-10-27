import {sourceUnits} from './reference-editorial-lib.mjs';

// Complete evidence packages follow direct authenticated edges. Navigation-only
// nodes establish a route; their prose is never supplied as teaching evidence.
export function buildSupportingPackage(primary,documents,{maxChars=40000,maxImages=6,maxDepth=3}={}) {
  const byId=new Map(documents.map(d=>[d.id,d]));
  const selected=[],supportingSourceRefs=[],unavailableSupportingReferences=[],contextualReferences=[];
  const seen=new Set([primary.id]),imageUrls=new Set(),engineScopes=new Map([[primary.id,primary.engines||[]]]);let characters=0;
  function add(target,parent,depth,{navigationOnly=false,recurse=true}={}){
    if(seen.has(target.id))return true;
    const base={documentId:target.id,sourceReference:target.id,referencedBy:parent.id,title:target.title};
    if(!parent.related?.includes(target.id)){unavailableSupportingReferences.push({...base,reason:'No direct authenticated source-reference edge'});return false;}
    const inherited=engineScopes.get(parent.id)||parent.engines||[],scope=inherited.length&&target.engines?.length?inherited.filter(e=>target.engines.includes(e)):inherited.length?inherited:target.engines||[];if(inherited.length&&target.engines?.length&&!scope.length){unavailableSupportingReferences.push({...base,reason:'Source destination has incompatible engine qualifiers'});return false;}
    if(navigationOnly){seen.add(target.id);engineScopes.set(target.id,scope);supportingSourceRefs.push({documentId:target.id,sourceHash:target.source_hash||target.sourceHash,referencedBy:parent.id,sourceReference:target.id,navigationOnly:true});contextualReferences.push({...base,navigationOnly:true,role:'Authenticated navigation bridge only; its unreviewed text and images are not teaching evidence.'});return true;}
    const units=sourceUnits(target),size=JSON.stringify(units).length,newImages=(target.media||[]).filter(m=>!imageUrls.has(m.url));const uniqueNew=new Set(newImages.map(m=>m.url));
    if(depth>maxDepth||characters+size>maxChars||imageUrls.size+uniqueNew.size>maxImages){unavailableSupportingReferences.push({...base,reason:'Complete supporting text and illustrations exceed this package budget; retain referral without inventing operations',sourceCharacters:size,mediaCount:target.media?.length||0});return false;}
    seen.add(target.id);engineScopes.set(target.id,scope);characters+=size;for(const url of uniqueNew)imageUrls.add(url);selected.push(target);
    supportingSourceRefs.push({documentId:target.id,sourceHash:target.source_hash||target.sourceHash,referencedBy:parent.id,sourceReference:target.id,sourceUnitCount:units.length,mediaCount:target.media?.length||0});
    if(recurse)visit(target,depth+1);
    return true;
  }
  function visit(parent,depth){for(const reference of parent.related||[]){if(reference==='G1693180')continue;const target=byId.get(reference);if(!target){unavailableSupportingReferences.push({reference,referencedBy:parent.id,reason:'Unresolved or ambiguous source destination'});continue;}add(target,parent,depth);}}
  visit(primary,1);
  if(['repair','diagnosis','general'].includes(primary.kind)){
    const about=byId.get('G1693180'),general=byId.get('G1693189'),anchor=[primary,...selected].find(d=>d.related?.includes('G1693180'));
    if(about&&general&&anchor&&add(about,anchor,1,{navigationOnly:true})&&add(general,about,1,{recurse:false})){
      const operationText=[primary,...selected.filter(d=>d.kind==='repair')].map(d=>d.text||'').join('\n');
      const operationSafety=/\bbrake[-\s]+booster\b/i.test(operationText)?'brake booster':'';
      const text=[primary.title,primary.section_title,...selected.map(d=>d.title),operationSafety].join(' ').toLowerCase();
      const candidates=[[/battery/,'G1693181'],[/climate|refrigerant|air conditioning/,'G1693184'],[/brake|clutch|stoplamp switch/,'G1693183'],[/coolant|cooling|radiator|thermostat|water pump|cylinder head temperature/,'G1693187'],[/fuel charging|fuel tank|fuel delivery|fuel system|fuel injector|fuel rail|evaporative|gasoline/,'G1693188'],[/airbag|restraint|pretensioner|pyrotechnic/,'G1693191'],[/wheels and tires|wheel and tire|wheel hub|wheel bearing|front wheel|rear wheel|road wheel|wheel nuts|wheel alignment|tire|tyre/,'G1693193'],[/body repair|body closures|paint|weld/,'G1693182']];
      for(const [pattern,id]of candidates)if(pattern.test(text)){const target=byId.get(id);if(target)add(target,general,1,{recurse:false});else unavailableSupportingReferences.push({documentId:id,referencedBy:general.id,reason:'Task-specific safety source missing'});}
    }else unavailableSupportingReferences.push({documentId:'G1693189',reason:'Complete applicable general service precautions are not available through an authenticated source path in this package'});
  }
  return {documents:selected,supportingSourceRefs,completeSupportingReferences:selected.map(d=>({documentId:d.id,title:d.title,engines:d.engines,units:sourceUnits(d)})),unavailableSupportingReferences,contextualReferences,characters,images:imageUrls.size};
}

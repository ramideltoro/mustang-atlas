// Source-bound recovery for the actual alignment procedures, not generic suspension work.
export const ALIGNMENT_HASHES={
 G2361399:'de9bb40c44010377b4a939b594ec352b94ade0920c9c542774062f9be21fcb27',
 G2361400:'986bc6e6d154a43d37ccf33ae13254ca54ef48fb205cc58c7648f17fe376316c',
 G2361401:'b8304ac832c589310e08e51f6a14be69850503e5d6ea5fb3a609d9fe48e6c7b4'
};
export function alignmentDependencies(primaryIds,byId,{prior,retry=false}={}){
 if(prior?.status&&!prior.alignmentEvidence&&!retry&&!['reserved','pair-fallback'].includes(prior.status))return [];
 const selected=[...primaryIds].filter(id=>Object.hasOwn(ALIGNMENT_HASHES,id));
 if(!selected.length)return [];
 const checked=(id,sha)=>{const d=byId.get(id);if(d?.source_hash!==sha)throw Error('Alignment evidence changed: '+id);return d;};
 for(const id of selected)checked(id,ALIGNMENT_HASHES[id]);
 const docs=[checked('G1686608','d0c2fcf21e269805645390d412f95b3bceb6772c617df06866fadb28c64cc70f')];
 if(primaryIds.has('G2361400'))docs.push(checked('G2361401',ALIGNMENT_HASHES.G2361401));
 return docs; // Preserve complete tables, qualifications and actual dependent operation.
}
export const ALIGNMENT_CONSTRAINT='The complete G1686608 table was checked against both original PDF pages (2015 header, revision07/13/2016). Measurements are at curb load: full service fluids/full fuel/no passengers/no cargo. Keep standard, GT350 and GT350R rows distinct. Columns are Item, LH, RH, Total/Split; front toe is TOTAL, not a per-wheel target. Rear toe has both per-wheel and total values; preserve printed values rather than re-summing rounded numbers. These tables do not imply optional wheel removal or unloaded suspension measurement. Rear camber requires checking rear toe; actual G2361401 is supplied for necessary correction. Its conditional LDW/IPMA camera alignment must retain the source requirement and an honest unresolved boundary if the supplied scan-guided directions do not establish executable completion. Do not invent camera calibration prerequisites or a road-test protocol.';

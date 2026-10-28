// Exact coupe stoplamp recovery; the existing full private lowering supplement supplies pages/figures.
export const STOPLAMP_PRIMARY='G1694146';
export const STOPLAMP_SOURCES=[
 ['G1694146','076c2829aef6eb163c9e0e5aa4c3dfafa36e53473b34cb2fa6d4b5c2cb1ebb26'],
 ['G1692599','e955f950433a0ff56587495c0b865069bb28943eb9a2a767e443882b2af0eac7'],
 ['G1692603','78735e8e975ea36c3a5bac8394a93302736af5d238bec91f8e37ca043d5b5b8b'],
 ['G1692601','2847e9563c9a229f73ddf693fcd4289c603a27e762b0465c20cb38f06815fff9'],
 ['G1692168','e859a3d899f61bd64e7e6a410b02982447e4171ca473a4bb96e235abec7a09a7']
];
export function stoplampEnrolled(primary,prior,retry=false){return primary.has(STOPLAMP_PRIMARY)&&(prior?.stoplampHeadlinerEvidence===true||!prior?.status||['reserved','pair-fallback'].includes(prior.status)||retry);}
export function stoplampDependencies(primary,byId,{prior,retry=false,supplement}={}){
 if(!stoplampEnrolled(primary,prior,retry))return [];
 if(!supplement||supplement.documentId!=='external-2015-headliner-lowering'||supplement.sourceHash!=='c2d62c1ce9371b5cb38ae011457ad96617cb3cfe1cac1bbb0324d982c2b26a31'||supplement.textHash!=='dcd789413b8eeba0c4b1429b314c98e7b31fc3bd7755c8ea733f55a5bbe088f8'||JSON.stringify(supplement.physicalPages)!=='[2422,2423,2424]')throw Error('Stoplamp lowering supplement changed');
 return STOPLAMP_SOURCES.map(([id,sha])=>{const d=byId.get(id);if(d?.source_hash!==sha)throw Error('Stoplamp access source changed: '+id);return d;});
}
export const STOPLAMP_CONSTRAINT='The indexed coupe stoplamp G1694146 explicitly prints 2015 Mustang and matches the same supplied 2015 workshop book physical pages 419–420, including E186578/E221922 and 4.1 Nm. The complete matching Headliner - Lowering pages 2422–2424 and full A-pillar, rear-quarter, loadspace and rear-cushion access sources are supplied. Teach the complete actual lowering/restoration, not full headliner removal or a shortcut through unsupplied trim. Position both front seats fully forward and fully reclined before ignition OFF/key removal and electrical disconnection; during access verify existing position rather than operating powered seats with wiring disconnected. Restore seats only after complete reassembly using normal stationary controls. Keep parked automatic Park/manual parked gear and parking restraint. Preserve each once-only shared C/D-pillar panel/tether operation, seatbelt 40 Nm and untwisted accessible belts/buckles. Preserve stoplamp four nuts, connector, two tabs, two-sided seal tape and actual adhesive-remover then alcohol-pad preparation; do not invent a tape reuse/renewal policy. Teach ordinary stationary brake-pedal lamp observation only after full reconnection/reassembly, with OFF/keyout before any failed-check connector reinspection. Keep coupe/rear-seat-fitted applicability honest; no unsupported seat-delete access. Public citations are prose publication/page references only; no external DB IDs or original artwork.';

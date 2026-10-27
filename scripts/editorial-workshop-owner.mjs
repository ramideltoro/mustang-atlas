import fs from 'node:fs';
import path from 'node:path';
import {hash} from './workshop-author-lib.mjs';
export const OWNER_ID='OWNER2015-START-CONTROLS';
export const OWNER_PDF='ac87ae04eeac51835aa226f11ba963dafaf3d462f4e57fc6c2ff1b51a4fcb592';
export const OWNER_TEXT='8530c5085edd5ae888c195276bf7e120e5617328342bda54b06d471676c712be';
export const OWNER_IMAGES=['85f04982240d0ce5f9e6becf4cc67c6f2097cb71e830d6e8a420d411c3e90ac7','b5d85b6ff5fc0d163a0139384867a77a54edec2a6747ea79fec44b36605382ee'];
// Explicit reviewed task families with actual ignition, gear-selection or powered completion controls.
// This is deliberately not a title/keyword classifier and never applies to a bench measurement.
const PRIMARY_IDS=new Set(`G1698173 G1693271 G1693272 G1693273 G1694287 G1694288 G1694272 G1694273 G1945794 G1694275 G1702525 G1702526 G1688199 G1693924 G1694094 G1694045 G1693889 G1704850 G1704852 G1704856 G1694052 G1693900 G1694054 G1693902 G1694166 G1694148 G1794146 G1694115 G1694114 G1694116 G1694118 G1694119 G1694120 G1694146 G1694122 G1694123 G1694124 G1694126 G1694125 G1694127 G1694128 G1694129 G1693220 G1943335 G1693249 G1692615 G1945075 G1695513 G1695933 G1695934 G1957566 G1695949 G1695936 G1695937 G1695939 G1695938 G1693973 G1693976 G1693977 G1693975 G1693978 G1695900 G1695906 G1695907 G1695905 G1695893 G1694629 G1694630 G1694635 G1694632 G1694633 G1708677 G1708674 G1695924 G1697267 G1695925 G1937621 G1694121 G1695926 G1694055 G1693903 G1672936 G1672937 G1794233 G1794234 G1721912 G1721916 G1725743 G1827246 G1693222 G1827245 G1692149 G1839772 G1802208 G1704008 G1704005 G1695512 G1912327 G1695506 G1692611 G1660469 G1681526 G1685328 G1698171 G1820640 G1693766 G2086104 G1708676 G2401442 G1723914 G1708672 G1708673 G1723917 G1692034 G1686637 G1693942 G1839609 G1818028 G1692541 G1692139 G1692247 G1692275 G1802180 G1692144 G1692251 G1692279 G1802184 G1692055 G1809313 G1692581 G1692582`.split(' '));
export function needsOwnerControls(primaryIds,years){return Array.isArray(years)&&years.length>0&&years.every(y=>y===2015)&&[...primaryIds].some(id=>PRIMARY_IDS.has(id));}
export function enrollOwnerControls(prior,retry=false){return prior?.ownerControlsEvidence===true||!prior?.status||['reserved','pair-fallback'].includes(prior.status)||retry;}
export function loadOwnerControls(root){
 const file=path.join(root,'work/editorial-workshop/evidence/owner-ignition/controls-supplement.json');
 if(!fs.existsSync(file))return null;
 const d=JSON.parse(fs.readFileSync(file,'utf8'));
 if(d.documentId!==OWNER_ID||d.sourceHash!==OWNER_PDF||hash(fs.readFileSync(d.pdfPath))!==OWNER_PDF||d.textHash!==OWNER_TEXT||hash(d.text)!==OWNER_TEXT)throw Error('Owner controls source changed');
 if(d.images.length!==2||JSON.stringify(d.physicalPages)!=='[124,125]')throw Error('Incomplete owner controls pages');
 for(const [i,m]of d.images.entries()){const file=path.resolve(root,m.privatePath);if(!file.startsWith(path.join(root,'work')+path.sep)||m.sha256!==OWNER_IMAGES[i]||hash(fs.readFileSync(file))!==OWNER_IMAGES[i])throw Error('Owner controls illustration changed');}
 return d;
}
export function ownerEvidence(d,engines){return [
 {nodeId:OWNER_ID+':text',documentId:OWNER_ID,sourceHash:OWNER_PDF,sectionId:'owner-start-controls',title:d.title,role:'dependency',engines,start:0,end:d.text.length,text:d.text,images:[]},
 {nodeId:OWNER_ID+':figures',documentId:OWNER_ID,sourceHash:OWNER_PDF,sectionId:'owner-start-controls-figures',title:d.title,role:'dependency-image',engines,text:'Review complete owner printed pages121–122. Only actual ignition controls, ordinary start prerequisites and ventilation are relevant. The backup-key fallback continues beyond these pages and is not supplied as a complete procedure; do not teach it. Original page images remain private.',images:d.images.map(m=>({...m,documentId:OWNER_ID,sourceHash:OWNER_PDF}))}
];}
export const OWNER_CONSTRAINT='The complete supplied2015owner printed121–122 establishes actual keyless controls. Cite publication/page in prose, never create a document route or put the external ID in procedures/sourceRefs. Distinguish known OFF, engine-off ignition ON (button without pedals), and engine start (automatic P with brake / manual Neutral with clutch; valid key inside). Handle remote-start settings/powered positioning before final OFF/key-out and disconnection. Preserve source-required engine-running tests; arrange ventilation and accessible grounded controls, never entry into a raised cabin. Maintain parking/ground restraints across pedal release, Neutral and hoist transitions; keep manual clutch depressed during stationary Reverse tests unless the actual primary explicitly requires otherwise. Final ordinary powered checks require full reassembly first and unconditional OFF/key-out afterward; renewed connector work starts OFF. Do not invent keyed LOCK restrictions. Do not add an engine-running step to an ignition-only completion check, or expand into backup-key/start-failure procedures from these contextual pages.';
export function pairExternalAllowed(contract,nodes){
 const refs=contract.externalSources||[];if(!refs.length)return true;
 if(refs.length!==1||refs[0].documentId!==OWNER_ID||refs[0].sourceHash!==OWNER_PDF||refs[0].textHash!==OWNER_TEXT||JSON.stringify(refs[0].physicalPages)!=='[124,125]')return false;
 const ns=nodes.filter(n=>n.documentId===OWNER_ID),t=ns.find(n=>n.nodeId===OWNER_ID+':text'),im=ns.find(n=>n.nodeId===OWNER_ID+':figures');
 return ns.length===2&&t?.sourceHash===OWNER_PDF&&hash(t.text)===OWNER_TEXT&&im?.sourceHash===OWNER_PDF&&im.images.length===2&&im.images.every((m,i)=>m.id===OWNER_ID+'-p'+(124+i)&&m.sha256===OWNER_IMAGES[i]);
}

export function enrollServicePrerequisites(prior,retry=false){return prior?.servicePrerequisiteEvidence===true||!prior?.status||['reserved','pair-fallback'].includes(prior.status)||retry;}

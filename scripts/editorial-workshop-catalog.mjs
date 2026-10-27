import fs from 'node:fs';
import path from 'node:path';
import {createMaintenanceGuideCatalog} from '../server/maintenance-guides.mjs';
import {hash} from './workshop-author-lib.mjs';
import {VERSION} from './editorial-workshop-lib.mjs';
export function validateStagedCatalog(db,records,{directory=path.resolve('work/editorial-workshop'),contentDir=path.resolve('content')}={}){
 const current=JSON.parse(fs.readFileSync(path.join(contentDir,'workshop-guides.json'),'utf8'));
 const replacements=new Map(records.map(r=>[r.guide.id,r]));const errors=[];
 for(const [id,r]of replacements){if(r.guide.authoring?.editorialVersion!==VERSION)errors.push({id,reason:'obsolete-editorial-contract'});const old=current.guides.find(g=>g.id===id);if(!old||(hash(JSON.stringify(old))!==r.baseHash&&JSON.stringify(old)!==JSON.stringify(r.guide)))errors.push({id,reason:'base-guide-changed'});
  for(const ref of r.guide.sourceRefs||[]){const row=db.prepare('select source_hash from documents where id=?').get(ref.documentId);if(row?.source_hash!==ref.sourceHash)errors.push({id,reason:'source-changed',documentId:ref.documentId});}
 }
 const check=fs.mkdtempSync(path.join(directory,'catalog-check-'));
 try{for(const name of fs.readdirSync(contentDir))if(name!=='workshop-guides.json')fs.symlinkSync(path.join(contentDir,name),path.join(check,name));
 const merged={...current,guides:current.guides.map(g=>replacements.get(g.id)?.guide||g)};fs.writeFileSync(path.join(check,'workshop-guides.json'),JSON.stringify(merged));
 const report=createMaintenanceGuideCatalog(db,{contentDir:check}).report();const affected=report.errors.filter(e=>!e.id||replacements.has(e.id));errors.push(...affected);
 return{checkedAt:new Date().toISOString(),staged:records.length,valid:errors.length===0,errors,allCatalogErrors:report.errors,guides:report.guides,workshopGuides:report.workshopGuides};
 }finally{fs.rmSync(check,{recursive:true,force:true});}
}

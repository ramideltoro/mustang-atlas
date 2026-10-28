import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {openDb} from '../server/db.mjs';
import {validateStagedCatalog} from './editorial-workshop-catalog.mjs';
const directory=path.resolve('work/editorial-workshop-care');
const primary=path.resolve('work/editorial-workshop/reviewed');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const reservationFiles=['work/editorial-workshop/care-reserved-subset.json','work/editorial-workshop/care-reserved-subset-2.json','work/editorial-workshop/care-reserved-subset-3.json','work/editorial-workshop/care-reserved-subset-4.json','work/editorial-workshop/care-reserved-subset-5.json','work/editorial-workshop/care-reserved-subset-6.json','work/editorial-workshop/care-reserved-subset-7.json','work/editorial-workshop/care-reserved-subset-8.json','work/editorial-workshop/care-reserved-subset-9.json','work/editorial-workshop/care-reserved-subset-10.json','work/editorial-workshop/care-reserved-subset-11.json','work/editorial-workshop/care-reserved-subset-12.json','work/editorial-workshop/care-reserved-subset-13.json','work/editorial-workshop/care-reserved-subset-14.json','work/editorial-workshop/care-reserved-subset-15.json','work/editorial-workshop/care-reserved-subset-16.json','work/editorial-workshop/care-reserved-subset-17.json','work/editorial-workshop/care-reserved-subset-18.json'];
const allowed=new Set(reservationFiles.filter(file=>fs.existsSync(file)).flatMap(file=>read(file).ids));
const statusFile=path.join(directory,'promotion-progress.json');
fs.mkdirSync(directory,{recursive:true});
const db=openDb({readOnly:true});
function promote(){
  const reviewed=path.join(directory,'reviewed');
  const pending=[];
  const approvalsFile=path.join(directory,'supervisory-approvals.json');
  const approvals=fs.existsSync(approvalsFile)?read(approvalsFile):{};
  for(const name of fs.existsSync(reviewed)?fs.readdirSync(reviewed).filter(n=>n.endsWith('.json')):[]){
    const source=path.join(reviewed,name),bytes=fs.readFileSync(source),record=JSON.parse(bytes),id=record.guide?.id;
    if(!allowed.has(id)||!record.guide.authoring?.independentSourceReview)throw Error('Unreserved or unreviewed record '+id);
    if(!path.resolve(record.reviewFolder).startsWith(directory+path.sep)||!fs.existsSync(record.reviewFolder))throw Error('Missing secondary review provenance '+id);
    const destination=path.join(primary,id+'.json');
    if(fs.existsSync(destination)){
      if(JSON.stringify(read(destination).guide)===JSON.stringify(record.guide))continue;
      throw Error('Conflicting primary reviewed record '+id);
    }
    if(approvals[id]?.guideHash!==hash(JSON.stringify(record.guide)))continue;
    pending.push({source,destination,bytes,record,id,sha256:hash(bytes)});
  }
  if(pending.length){
    const report=validateStagedCatalog(db,pending.map(x=>x.record),{directory});
    fs.writeFileSync(path.join(directory,'promotion-validation.json'),JSON.stringify(report,null,2)+'\n');
    if(!report.valid)throw Error('Secondary staged catalog rejected: '+JSON.stringify(report.errors));
    for(const item of pending){
      fs.writeFileSync(item.destination+'.care.tmp',item.bytes);
      fs.renameSync(item.destination+'.care.tmp',item.destination);
    }
    const ledgerFile=path.join(directory,'promotions.json');
    const ledger=fs.existsSync(ledgerFile)?read(ledgerFile):[];
    ledger.push(...pending.map(({source,destination,id,sha256})=>({source,destination,id,sha256,promotedAt:new Date().toISOString(),status:'reviewed-staged-only'})));
    fs.writeFileSync(ledgerFile,JSON.stringify(ledger,null,2)+'\n');
    console.log('STAGED '+pending.map(x=>x.id).join(','));
  }
  fs.writeFileSync(statusFile,JSON.stringify({state:'running',pid:process.pid,updatedAt:new Date().toISOString(),newlyStaged:pending.length},null,2)+'\n');
}
try{
  do{promote();if(!process.argv.includes('--watch')||fs.existsSync(path.join(directory,'stop-promotion')))break;await new Promise(resolve=>setTimeout(resolve,60000));}while(true);
}catch(error){fs.writeFileSync(statusFile,JSON.stringify({state:'attention-required',updatedAt:new Date().toISOString(),error:error.message},null,2)+'\n');throw error;}finally{db.close();}

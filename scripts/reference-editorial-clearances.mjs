import fs from 'node:fs';
import path from 'node:path';
import {hash} from './reference-editorial-lib.mjs';
const root=path.resolve('work/editorial-references'),file=path.join(root,'supervisory-clearances.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const exists=fs.existsSync(file),map=exists?read(file):{version:1,createdAt:new Date().toISOString(),clearances:{}};
const add=(id,sha,evidence,basis)=>{map.clearances[id]??={};map.clearances[id][sha]??={recordedAt:new Date().toISOString(),evidence,basis};};
if(!exists){
 if(!process.argv.includes('--seed-live'))throw Error('First initialization requires explicit --seed-live');
 for(const name of fs.readdirSync('content/guides')){if(!name.endsWith('.json'))continue;const p=path.resolve('content/guides',name),bytes=fs.readFileSync(p,'utf8'),g=JSON.parse(bytes);if(g.referenceEditorialVersion==='enthusiast-v2')add(g.documentId,hash(bytes),p,'Existing public exact-artifact baseline at coordinator-requested gate initialization; not a newly claimed review');}
 map.baselineSeededAt=new Date().toISOString();
}
// The publisher formats JSON. Bridge only formatting differences to the frozen live baseline.
if(process.argv.includes('--seed-live-equivalents')&&!map.equivalentSeededAt){
 const candidates=fs.readdirSync(path.join(root,'accepted')).filter(n=>n.endsWith('.json')).map(n=>path.join(root,'accepted',n));
 for(const n of fs.readdirSync(path.join(root,'revisions'))){const p=path.join(root,'revisions',n,'accepted.json');if(fs.existsSync(p))candidates.push(p);}
 for(const candidate of candidates){const bytes=fs.readFileSync(candidate,'utf8'),g=JSON.parse(bytes),live=path.resolve('content/guides',g.documentId+'.json');if(!fs.existsSync(live))continue;const liveBytes=fs.readFileSync(live,'utf8'),liveSha=hash(liveBytes);if(!map.clearances[g.documentId]?.[liveSha])continue;if(JSON.stringify(g)!==JSON.stringify(JSON.parse(liveBytes)))continue;add(g.documentId,hash(bytes),live,'Complete parsed artifact equals frozen existing-live baseline; only JSON file formatting differs; live SHA '+liveSha);}
 map.equivalentSeededAt=new Date().toISOString();
}
// Only explicit exact-artifact approval records qualify. Technical CLI verdicts alone do not.
for(const folder of ['revisions','supervisory-reviews']){
 const base=path.join(root,folder);if(!fs.existsSync(base))continue;
 for(const name of fs.readdirSync(base)){
  const dir=path.join(base,name);if(!fs.statSync(dir).isDirectory())continue;
  const candidate=folder==='revisions'?path.join(dir,'accepted.json'):path.join(root,'accepted',name+'.json');
  if(!fs.existsSync(candidate))continue;
  const bytes=fs.readFileSync(candidate,'utf8'),g=JSON.parse(bytes),sha=hash(bytes);
  for(const record of fs.readdirSync(dir).filter(n=>/approval\.json$/.test(n))){
   const p=path.join(dir,record),approval=read(p);
   if(approval.approved===true&&(approval.acceptedSha===sha||approval.sha256===sha))add(g.documentId,sha,p,'Recorded exact-artifact supervisory approval');
  }
 }
}
map.updatedAt=new Date().toISOString();fs.writeFileSync(file+'.tmp',JSON.stringify(map,null,2));fs.renameSync(file+'.tmp',file);
console.log(JSON.stringify({documents:Object.keys(map.clearances).length,artifacts:Object.values(map.clearances).reduce((n,v)=>n+Object.keys(v).length,0),file}));

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {createLearningContextCatalog} from '../server/learning-context.mjs';

const watch=process.argv.includes('--watch');
const excludeIndex=process.argv.indexOf('--exclude-topics');
const excluded=new Set(excludeIndex>=0?String(process.argv[excludeIndex+1]||'').split(',').filter(Boolean):[]);
const root=path.resolve('work/topic-context-jobs');fs.mkdirSync(root,{recursive:true});
const host=process.env.ATLAS_DEPLOY_HOST||'65.75.201.18';
const destination=process.env.ATLAS_DEPLOY_CONTENT||'/srv/mustang-atlas/content/';
if(!/^[a-zA-Z0-9@.-]+$/.test(host)||!/^\/[a-zA-Z0-9/_-]+\/$/.test(destination))throw Error('Invalid deployment destination');
const lock=path.join(root,'publisher.pid');
if(fs.existsSync(lock)){try{process.kill(Number(fs.readFileSync(lock)),0);throw Error('Context publisher already running');}catch(e){if(e.code!=='ESRCH')throw e;}}
fs.writeFileSync(lock,String(process.pid));
const db=new DatabaseSync(path.resolve(process.env.DATA_DIR||'data','atlas.sqlite'),{readOnly:true});
const snapshot=path.join(root,'publication');fs.mkdirSync(snapshot,{recursive:true});
const catalog=createLearningContextCatalog(db,{contentDir:snapshot});
const command=(cmd,args)=>new Promise(resolve=>{const p=spawn(cmd,args,{stdio:'inherit'});p.on('error',()=>resolve(false));p.on('exit',code=>resolve(code===0));});
let stopped=false,lastHash='',failures=0;
process.on('SIGTERM',()=>stopped=true);process.on('SIGINT',()=>stopped=true);
const workerAlive=()=>{try{process.kill(Number(fs.readFileSync(path.join(root,'worker.pid'))),0);return true;}catch{return false;}};
async function transfer(){
 const input=JSON.parse(fs.readFileSync('content/topic-contexts.json','utf8'));
 if(excluded.size){input.topics=input.topics.filter(t=>!excluded.has(t.id));input.documents=Object.fromEntries(Object.entries(input.documents).filter(([,v])=>!excluded.has(v.topicId)));}
 const content=JSON.stringify(input);
 const hash=crypto.createHash('sha256').update(content).digest('hex');
 if(hash===lastHash)return true;
 fs.writeFileSync(path.join(snapshot,'topic-contexts.json'),content);
 fs.copyFileSync('content/glossary.json',path.join(snapshot,'glossary.json'));
 const report=catalog.report();
 if(report.errors.length)throw Error('Context publication rejected: '+JSON.stringify(report.errors.slice(0,8)));
 const target=destination+`.topic-contexts.${process.pid}.tmp`;
 if(!await command('rsync',['-az','--no-owner','--no-group','-e','ssh -o BatchMode=yes -o ConnectTimeout=15',path.join(snapshot,'topic-contexts.json'),host+':'+target]))return false;
 if(!await command('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=15',host,`mv -- ${target} ${destination}topic-contexts.json`]))return false;
 lastHash=hash;console.log(JSON.stringify({time:new Date().toISOString(),published:report.contextualizedDocuments,documents:report.documents}));return true;
}
try{
 do{
  const ok=await transfer();failures=ok?0:failures+1;
  if(ok&&(!watch||!workerAlive()))break;
  if(failures>=8){process.exitCode=1;break;}
  for(let elapsed=0;elapsed<30&&!stopped;elapsed+=5)await delay(5000);
 }while(!stopped);
}finally{db.close();try{fs.unlinkSync(lock);}catch{}}

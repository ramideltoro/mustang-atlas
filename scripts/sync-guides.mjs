import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {setTimeout as delay} from 'node:timers/promises';
const data=path.resolve(process.env.DATA_DIR||'data'),watch=process.argv.includes('--watch');
const host=process.env.ATLAS_DEPLOY_HOST||'65.75.201.18',destination=process.env.ATLAS_DEPLOY_DATA||'/srv/mustang-atlas/data/';
if(!/^[a-zA-Z0-9@.-]+$/.test(host)||!/^\/[a-zA-Z0-9/_-]+\/$/.test(destination))throw Error('Invalid deployment destination');
const lock=path.join(data,'rewrite','publisher.pid');fs.mkdirSync(path.dirname(lock),{recursive:true});
if(fs.existsSync(lock)){try{process.kill(Number(fs.readFileSync(lock)),0);throw Error('Publisher already running');}catch(e){if(e.code!=='ESRCH')throw e;}}
fs.writeFileSync(lock,String(process.pid));let stopped=false;process.on('SIGTERM',()=>stopped=true);process.on('SIGINT',()=>stopped=true);
function transfer(){return new Promise(resolve=>{const sources=[path.join(data,'guides'),path.join(data,'rewrite-progress.json')].filter(fs.existsSync);if(!sources.length)return resolve(true);const p=spawn('rsync',['-az','--no-owner','--no-group','--include=*/','--include=*.json','--exclude=*','-e','ssh -o BatchMode=yes -o ConnectTimeout=15',...sources,host+':'+destination],{stdio:'inherit'});p.on('error',()=>resolve(false));p.on('exit',code=>resolve(code===0));});}
function workerAlive(){try{process.kill(Number(fs.readFileSync(path.join(data,'rewrite','worker.pid'))),0);return true;}catch{return false;}}
let failures=0;
try{do{
 const ok=await transfer();failures=ok?0:failures+1;
 console.log(JSON.stringify({time:new Date().toISOString(),synced:ok,consecutiveFailures:failures}));
 if(ok&&(!watch||!workerAlive()))break;
 if(failures>=8&&(!watch||!workerAlive())){process.exitCode=1;console.error('Guide publication failed after eight transfer attempts. Local guides remain intact.');break;}
 const seconds=ok?30:Math.min(60,5*2**(failures-1));
 for(let elapsed=0;elapsed<seconds&&!stopped;elapsed+=5)await delay(Math.min(5,seconds-elapsed)*1000);
}while(!stopped);if(stopped)process.exitCode=1;}finally{try{fs.unlinkSync(lock);}catch{}}

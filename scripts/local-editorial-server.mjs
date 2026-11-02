#!/usr/bin/env node
/** Prepare private immutable input, deploy a server worker, and collect drafts; never publishes. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ssh,sudoSsh,upload,shellQuote,REMOTE_ROOT} from './local-editorial-transport.mjs';
import {sha,atomic} from './local-editorial-worker.mjs';
const args=process.argv.slice(2),command=args[0],opt=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const runDir=path.resolve(opt('--run','work/local-editorial/run-1')),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const remote=REMOTE_ROOT+'/runs/'+path.basename(runDir);
if(!/^[a-zA-Z0-9._-]+$/.test(path.basename(runDir)))throw Error('Invalid run name');
if(command==='prepare'){
 const pilot=path.resolve(opt('--pilot','work/local-editorial/pilot')),manifest=read(path.join(pilot,'manifest.json'));
 const jobs=manifest.jobs.map(entry=>{
  const filename=entry.jobPath||entry.path||path.join(entry.id,'job.json');
  const jobPath=path.resolve(pilot,filename),job=read(jobPath),base=path.dirname(jobPath);
  const resolve=f=>path.isAbsolute(f)?f:path.resolve(base,f);
  const packets=(job.authorPackets||[{promptPath:job.authorPromptPath,schemaPath:job.authorSchemaPath}]).map(p=>({prompt:fs.readFileSync(resolve(p.promptPath),'utf8'),schema:read(resolve(p.schemaPath)),sourceIds:p.sourceIds||[],oversized:!!p.oversized}));
  const evidence=fs.readFileSync(resolve(job.fullEvidencePath),'utf8');
  return {id:job.id||entry.id,jobPath,title:job.title||entry.title,category:job.category||entry.category,authorEligible:job.authorEligible,packets,fullEvidenceText:evidence,jobHash:sha(job),sourceHash:sha(evidence)};
 });
 if(jobs.length!==10||new Set(jobs.map(j=>j.id)).size!==10)throw Error('Benchmark requires exactly ten distinct articles');
 const config={version:1,pilotManifestHash:sha(manifest),createdAt:new Date().toISOString(),ollamaUrl:'http://127.0.0.1:11434',models:['qwen2.5:14b','qwen2.5:32b'],options:{num_ctx:8192,num_thread:8,num_predict:3072,temperature:0.3,seed:42},jobs};
 if(fs.existsSync(path.join(runDir,'queue.json')))throw Error('Run already exists; use a new run ID');
 atomic(path.join(runDir,'queue.json'),config);atomic(path.join(runDir,'transport.json'),{remote,publicationEligible:false,pilot});
 console.log(JSON.stringify({runDir,jobs:jobs.length,calls:jobs.reduce((s,j)=>s+j.packets.length,0)*2,remote}));
}else if(command==='deploy'){
 read(path.join(runDir,'queue.json'));
 await ssh('test ! -e '+shellQuote(remote+'/queue.json'));
 await upload({'queue.json':path.join(runDir,'queue.json'),'worker.mjs':fileURLToPath(new URL('./local-editorial-worker.mjs',import.meta.url))},remote);
 // Dedicated system unit survives logout/reboot. Ollama inference uses its existing service;
 // num_thread is the inference limit, while these controls bound only our coordinator.
 const unit='mustang-editorial-'+path.basename(runDir)+'.service',quoted=shellQuote(remote);
 const service=['[Unit]','Description=Mustang Atlas private local drafting pilot','After=network-online.target ollama.service','Wants=network-online.target','StartLimitIntervalSec=3600','StartLimitBurst=3','','[Service]','Type=simple','User=rami','WorkingDirectory='+remote,'ExecStart=/usr/bin/node '+remote+'/worker.mjs '+remote,'Restart=on-failure','RestartSec=60','Nice=10','MemoryMax=2G','UMask=0077','NoNewPrivileges=yes','PrivateTmp=yes','','[Install]','WantedBy=multi-user.target',''].join('\n');
 const result=await sudoSsh('test ! -f /etc/systemd/system/'+unit+' && printf %s '+shellQuote(service)+' > /etc/systemd/system/'+unit+' && systemctl daemon-reload && systemctl enable --now '+shellQuote(unit));
 atomic(path.join(runDir,'deployment.json'),{remote,unit,uploadedAt:new Date().toISOString(),queueHash:sha(fs.readFileSync(path.join(runDir,'queue.json'),'utf8'))});console.log(result||'Server drafting service started');
}else if(command==='status'){
 console.log(await ssh('cat '+shellQuote(remote+'/state.json')+'; systemctl show '+shellQuote('mustang-editorial-'+path.basename(runDir)+'.service')+' -p ActiveState -p SubState -p ExecMainStatus'));
}else if(command==='collect'){
 // JSON only: generated artifacts contain private evidence/prose and stay in ignored work/.
 const script=`const fs=require('fs'),path=require('path');const root=${JSON.stringify(remote)};const out={};function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const f=path.join(d,e.name);if(e.isDirectory()&&e.name==='results')walk(f);else if(e.isDirectory()&&d.includes('/results'))walk(f);else if(e.isFile()&&e.name.endsWith('.json')&&e.name!=='queue.json')out[path.relative(root,f)]=JSON.parse(fs.readFileSync(f,'utf8'));}}walk(root);console.log(JSON.stringify(out));`;
 const artifacts=JSON.parse(await ssh('/usr/bin/node -e '+shellQuote(script),{timeout:120000}));
 for(const [name,value]of Object.entries(artifacts)){if(name.includes('..')||path.isAbsolute(name))throw Error('Invalid artifact path');atomic(path.join(runDir,name),value);}
 console.log(JSON.stringify({collected:Object.keys(artifacts).length,runDir}));
}else throw Error('Usage: local-editorial-server.mjs prepare|deploy|status|collect --run <private-run> [--pilot <pilot>]');

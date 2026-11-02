#!/usr/bin/env node
/** Private serial draft/review/revision orchestration. No publication or model selection. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {watchRun,reviewOne,summarizeRun,runProcess,cleanEnvironment,modelSlug,digest} from './local-editorial-review.mjs';
import {prepareRevision,revisionDirectory} from './local-editorial-revision.mjs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const save=(f,v)=>{fs.writeFileSync(f+'.tmp',JSON.stringify(v,null,2)+'\n',{mode:0o600});fs.renameSync(f+'.tmp',f);};
export function acquireLock(file){try{const fd=fs.openSync(file,'wx',0o600);fs.writeSync(fd,JSON.stringify({pid:process.pid,at:new Date().toISOString()}));fs.closeSync(fd);return;}catch(e){if(e.code!=='EEXIST')throw e;}const old=read(file);try{process.kill(old.pid,0);throw Error('Controller already active: '+old.pid);}catch(e){if(e.code!=='ESRCH')throw e;}fs.renameSync(file,file+'.stale-'+Date.now());acquireLock(file);}
const defaultCommand=async(command,run)=>{const r=await runProcess(process.execPath,[fileURLToPath(new URL('./local-editorial-server.mjs',import.meta.url)),command,'--run',run],{env:cleanEnvironment(),timeoutMs:180000});if(r.code!==0)throw Error(command+' failed: '+r.stderr);return r;};
export async function tick(run,state,deps={}){
 const watch=deps.watch||watchRun,review=deps.review||reviewOne,prepare=deps.prepare||prepareRevision,command=deps.command||defaultCommand,summary=deps.summary||summarizeRun;
 const queue=read(path.join(run,'queue.json'));
 if(state.activeRevision){const a=state.activeRevision;
  if(!a.deployed){if(a.deployAttempted&&!fs.existsSync(path.join(a.run,'deployment.json')))throw Error('Prior deployment outcome uncertain; inspect remote service before resuming');if(!fs.existsSync(path.join(a.run,'deployment.json'))){a.deployAttempted=true;deps.persist?.();await command('deploy',a.run);}a.deployed=true;deps.persist?.();}
  await command('collect',a.run);const child=read(path.join(a.run,'state.json')),key=modelSlug(a.model)+'/'+a.jobId,s=child.jobs?.[key];
  if(child.state?.startsWith('blocked')||child.state==='paused')throw Error('Revision worker '+child.state);
  if(child.state!=='drafting-complete')return {phase:'revision-drafting'};
  if(s?.status!=='drafted')throw Error('Revision draft did not complete: '+(s?.error||s?.status||'missing'));
  const job=queue.jobs.find(j=>j.id===a.jobId);const result=await review({job:job.jobPath,candidate:path.join(a.run,'results',key,'candidate.json'),output:path.join(run,'reviews',key),model:a.model,revision:a.revision});
  if(result.executionErrors?.length||result.gate?.disposition==='review-error')throw Error('Independent review unavailable: '+result.executionErrors?.join('; '));
  state.completedRevisions.push({...a,disposition:result.gate.disposition,finishedAt:new Date().toISOString()});state.activeRevision=null;deps.persist?.();
 }
 const report=await watch({run,once:true});
 if(report.slots.some(s=>['review-error','review-input-error','candidate-changed'].includes(s.disposition)))throw Error('Independent review blocked; inspect exact review report. No fallback authorized.');
 const main=read(path.join(run,'state.json'));if(main.state?.startsWith('blocked')||main.state==='paused')throw Error('Main drafting worker '+main.state);
 if(main.state!=='drafting-complete')return {phase:'main-drafting',report};
 const pending=report.slots.find(s=>s.disposition==='revision-required');
 if(pending){const revision=(pending.revision??0)+1;if(revision>2)throw Error('Revision ceiling violated');const output=revisionDirectory(run,revision,pending.model,pending.jobId),feedback=path.join(run,'reviews',modelSlug(pending.model),pending.jobId,'revision-'+(revision-1),'feedback.json');
  if(fs.existsSync(output)){const p=read(path.join(output,'revision.json'));if(p.mainRun!==run||p.jobId!==pending.jobId||p.model!==pending.model||p.revision!==revision||p.feedbackHash!==digest(fs.readFileSync(feedback)))throw Error('Existing revision identity mismatch');}
  else {try{const original=queue.jobs.find(j=>j.id===pending.jobId);if(original.authorEligible===false)throw Error('Author input is ineligible for complete local drafting');prepare({run,job:pending.jobId,model:pending.model,feedback,output});}catch(e){if(!/Revision context budget exceeded|Author input is ineligible/.test(e.message))throw e;const file=path.join(run,'revision-dispositions.json'),overrides=fs.existsSync(file)?read(file):{};overrides[modelSlug(pending.model)+'/'+pending.jobId]={disposition:'held-context',qualityGate:false,jobId:pending.jobId,model:pending.model,revision,reportHash:digest(fs.readFileSync(path.join(path.dirname(feedback),'report.json'))),feedbackHash:digest(fs.readFileSync(feedback)),candidateHash:read(feedback).candidateHash,error:e.message,at:new Date().toISOString()};save(file,overrides);return {phase:'context-held',report:summary(run)};}}
  state.activeRevision={run:output,jobId:pending.jobId,model:pending.model,revision,deployed:false,deployAttempted:false};deps.persist?.();return {phase:'revision-prepared',report};
 }
 const final=summary(run);return {phase:final.benchmarkComplete?'complete':'awaiting-review',report:final};
}
export async function orchestrate({run,once=false,intervalMs=30000},deps={}){
 run=path.resolve(run);const lock=path.join(run,'.orchestrator.lock');acquireLock(lock);const file=path.join(run,'orchestrator.json');let state=fs.existsSync(file)?read(file):{version:1,completedRevisions:[],activeRevision:null};let stop=false;const signal=()=>{stop=true;};process.on('SIGTERM',signal);process.on('SIGINT',signal);const persist=()=>save(file,{...state,pid:process.pid,updatedAt:new Date().toISOString(),publicationAuthorized:false,modelSelectionAuthorized:false});
 try{if(fs.existsSync(path.join(run,'.review-watch.lock'))){const owner=read(path.join(run,'.review-watch.lock'));try{process.kill(owner.pid,0);throw Error('Existing review watcher active');}catch(e){if(e.code!=='ESRCH')throw e;}fs.renameSync(path.join(run,'.review-watch.lock'),path.join(run,'.review-watch.lock.stale-'+Date.now()));}
  do{state.phase='working';persist();const result=await tick(run,state,{...deps,persist});state.phase=result.phase;state.lastError=null;if(result.report)save(path.join(run,'review-summary.json'),result.report);persist();if(once||stop||state.phase==='complete')return state;await new Promise(r=>setTimeout(r,Math.max(1000,Math.min(60000,intervalMs))));}while(!stop);return state;
 }catch(e){state.phase='blocked';state.lastError=e.message;persist();throw e;}finally{process.off('SIGTERM',signal);process.off('SIGINT',signal);fs.unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const args=process.argv.slice(2),get=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;if(!get('--run'))throw Error('Required --run');orchestrate({run:get('--run'),once:args.includes('--once'),intervalMs:Number(get('--interval-ms')||30000)}).then(s=>console.log(JSON.stringify(s))).catch(e=>{console.error(e.message);process.exitCode=1;});}

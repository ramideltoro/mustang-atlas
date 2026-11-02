import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepareRevision,revisionDirectory} from './local-editorial-revision.mjs';
import {digest} from './local-editorial-review.mjs';
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'editorial-revision-')),run=path.join(root,'main'),job='one',model='qwen2.5:14b',dir=path.join(run,'results/qwen2.5-14b/one/review/revision-0');
 const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v)+'\n');};
 const candidate={status:'ok',text:'Supported text'},candidatePath=path.join(run,'results/qwen2.5-14b/one/candidate.json');write(candidatePath,candidate);write(path.join(dir,'candidate.json'),candidate);
 const hashes={candidate:digest(fs.readFileSync(candidatePath)),job:'jobhash',fullEvidence:digest('Full immutable evidence')};
 const review={verdict:'revise',issues:[{reason:'Clarify existing supported statement'}]},gate={passed:false,disposition:'revision-required',errors:['Unclear statement']};write(path.join(dir,'review.json'),review);
 const report={version:'test',hashes,model,reviewModel:null,revision:0,jobId:job,review,gate,executionErrors:[],reviewHash:digest(fs.readFileSync(path.join(dir,'review.json')))};report.fingerprint=digest({version:report.version,hashes,model,reviewModel:null,revision:0});write(path.join(dir,'report.json'),report);
 const feedback={jobId:job,model,revision:0,candidateHash:hashes.candidate,accepted:false,revisionAllowed:true,nextRevision:1,errors:gate.errors,issues:review.issues,coverage:[]};write(path.join(dir,'feedback.json'),feedback);
 const jobPath=path.join(root,'job.json'),jobRecord={authorPackets:[{promptPath:'a.txt',schemaPath:'schema.json'},{promptPath:'b.txt',schemaPath:'schema.json'}]};fs.writeFileSync(path.join(root,'a.txt'),'First complete source');fs.writeFileSync(path.join(root,'b.txt'),'Second complete source');write(path.join(root,'schema.json'),{});write(jobPath,jobRecord);
 const queue={models:[model,'qwen2.5:32b'],jobs:[{id:job,jobPath,jobHash:digest(jobRecord),sourceHash:digest('Full immutable evidence'),packets:[{prompt:'First complete source',schema:{},sourceIds:[],oversized:false},{prompt:'Second complete source',schema:{},sourceIds:[],oversized:false}],fullEvidenceText:'Full immutable evidence'}]};write(path.join(run,'queue.json'),queue);
 return {root,run,dir,write,feedback,report,queue,hashes,options:{run,job,model,feedback:path.join(dir,'feedback.json')},deps:{loadInputs:()=>({hashes,job:jobRecord})},close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('prepares private single-model revision with immutable source and bounded instructions',()=>{const f=fixture();try{const before=fs.readFileSync(path.join(f.run,'queue.json'));const result=prepareRevision(f.options,f.deps),q=JSON.parse(fs.readFileSync(path.join(result.runDir,'queue.json')));assert.deepEqual(q.jobs[0].packets,f.queue.jobs[0].packets);assert.equal(q.jobs[0].initialDraft.text,'Supported text');assert.equal(q.jobs[0].fullEvidenceText,f.queue.jobs[0].fullEvidenceText);assert.deepEqual(q.models,['qwen2.5:14b']);assert.equal(q.publicationEligible,false);assert.deepEqual(fs.readFileSync(path.join(f.run,'queue.json')),before);assert.throws(()=>prepareRevision(f.options,f.deps),/new isolated/);}finally{f.close();}});
for(const [name,change,pattern]of [
 ['accepted feedback',f=>f.feedback.accepted=true,/authorize/],
 ['third revision',f=>{f.feedback.nextRevision=3;f.feedback.revision=2;},/authorize/],
 ['wrong model',f=>f.feedback.model='qwen2.5:32b',/identity/],
 ['missing evidence',f=>f.report.gate.disposition='held-evidence',/missing evidence/],
 ['failed review execution',f=>f.report.executionErrors=['timeout'],/completed quality/],
 ['changed issues',f=>f.feedback.issues=[],/differs/],
 ['changed source hashes',f=>f.deps.loadInputs=()=>({hashes:{...f.hashes,fullEvidence:'changed'}}),/hashes differ/],
 ['stale candidate',f=>f.write(path.join(f.run,'results/qwen2.5-14b/one/candidate.json'),{text:'changed'}),/candidate changed/],
 ['changed source packet',f=>f.queue.jobs[0].packets[0].prompt='x'.repeat(24000),/packet binding mismatch/],
 ['unsafe job',f=>f.options.job='../escape',/Unsafe/]
])test('rejects '+name+' without creating a revision',()=>{const f=fixture();try{change(f);f.write(path.join(f.dir,'feedback.json'),f.feedback);f.write(path.join(f.dir,'report.json'),f.report);f.write(path.join(f.run,'queue.json'),f.queue);assert.throws(()=>prepareRevision(f.options,f.deps),pattern);assert.equal(fs.existsSync(revisionDirectory(f.run,1,'qwen2.5:14b','one')),false);}finally{f.close();}});
test('rejects tampered reviewer bytes even if feedback unchanged',()=>{const f=fixture();try{f.write(path.join(f.dir,'review.json'),{verdict:'pass'});assert.throws(()=>prepareRevision(f.options,f.deps),/integrity/);}finally{f.close();}});
test('second revision binds to first revision provenance and current revised candidate',()=>{const f=fixture();try{
 const first=prepareRevision(f.options,f.deps),candidatePath=path.join(first.runDir,'results/qwen2.5-14b/one/candidate.json'),dir=path.join(f.run,'results/qwen2.5-14b/one/review/revision-1');const candidate={text:'Revised supported draft'};f.write(candidatePath,candidate);f.write(path.join(dir,'candidate.json'),candidate);f.write(path.join(dir,'review.json'),f.report.review);
 const hashes={...f.hashes,candidate:digest(fs.readFileSync(candidatePath))},report={...f.report,revision:1,hashes};report.fingerprint=digest({version:report.version,hashes,model:report.model,reviewModel:null,revision:1});f.write(path.join(dir,'report.json'),report);f.write(path.join(dir,'feedback.json'),{...f.feedback,revision:1,nextRevision:2,candidateHash:hashes.candidate});
 const loadInputs=()=>({...f.deps.loadInputs(),hashes});const result=prepareRevision({...f.options,feedback:path.join(dir,'feedback.json')},{loadInputs});assert.equal(result.revision,2);assert.equal(JSON.parse(fs.readFileSync(path.join(result.runDir,'queue.json'))).jobs[0].initialDraft.text,candidate.text);
 }finally{f.close();}});
test('large exact review instructions fail budget check without truncating evidence',()=>{const f=fixture();try{f.feedback.issues=[{reason:'x'.repeat(25000)}];f.report.review.issues=f.feedback.issues;f.write(path.join(f.dir,'review.json'),f.report.review);f.report.reviewHash=digest(fs.readFileSync(path.join(f.dir,'review.json')));f.write(path.join(f.dir,'report.json'),f.report);f.write(path.join(f.dir,'feedback.json'),f.feedback);assert.throws(()=>prepareRevision(f.options,f.deps),/budget exceeded/);}finally{f.close();}});
test('budget matches worker disclosure and correction labels at exact byte boundary',()=>{const f=fixture();try{
 const first=prepareRevision(f.options,f.deps);const q=JSON.parse(fs.readFileSync(path.join(first.runDir,'queue.json'))),j=q.jobs[0];fs.rmSync(first.runDir,{recursive:true});
 const suffix='\nThe local author cannot see original images. Do not invent image content or claim visual inspection; the independent reviewer receives the originals.\n'+'Previous draft; retain every supported earlier section:\n'+JSON.stringify(j.initialDraft)+'\nIndependent review corrections:\n'+j.revisionInstructions;
 const prompt='x'.repeat(24000-Buffer.byteLength(suffix));f.queue.jobs[0].packets[1].prompt=prompt;fs.writeFileSync(path.join(f.root,'b.txt'),prompt);f.write(path.join(f.run,'queue.json'),f.queue);
 const exact=prepareRevision(f.options,f.deps);assert.equal(exact.revision,1);fs.rmSync(exact.runDir,{recursive:true});
 f.queue.jobs[0].packets[1].prompt+='x';fs.appendFileSync(path.join(f.root,'b.txt'),'x');f.write(path.join(f.run,'queue.json'),f.queue);assert.throws(()=>prepareRevision(f.options,f.deps),/budget exceeded/);
 }finally{f.close();}});

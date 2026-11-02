#!/usr/bin/env node
/** Prepare an isolated local revision. No inference, transport, acceptance or publication. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,loadReviewInputs} from './local-editorial-review.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const segment=s=>{if(typeof s!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(s)||s==='..')throw Error('Unsafe job/path segment');return s;};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const revisionDirectory=(run,n,model,job)=>run+'-rev'+n+'-'+model.replaceAll(':','-')+'-'+segment(job);
export function prepareRevision({run,job,model,feedback,output},{loadInputs=loadReviewInputs}={}){
 run=path.resolve(run);segment(job);
 if(!['qwen2.5:14b','qwen2.5:32b'].includes(model))throw Error('Unsupported local model');
 feedback=path.resolve(feedback);const dir=path.dirname(feedback),f=read(feedback),reportPath=path.join(dir,'report.json'),report=read(reportPath);
 if(f.accepted!==false||f.revisionAllowed!==true||![1,2].includes(f.nextRevision)||f.revision!==f.nextRevision-1)throw Error('Feedback does not authorize a bounded revision');
 if(f.jobId!==job||f.model!==model||report.jobId!==job||report.model!==model||report.revision!==f.revision)throw Error('Feedback/report identity mismatch');
 if(report.gate?.passed!==false||report.gate?.disposition!=='revision-required'||report.executionErrors?.length||report.review?.verdict==='needs-evidence')throw Error('Only completed quality reviews may authorize revision; missing evidence remains held');
 const reviewFile=path.join(dir,'review.json');if(!report.reviewHash||digest(fs.readFileSync(reviewFile))!==report.reviewHash||!same(read(reviewFile),report.review))throw Error('Review integrity mismatch');
 if(!same(f.issues,report.review?.issues||[])||!same(f.errors,report.gate.errors||[])||!same(f.coverage,report.review?.coverage||report.review?.coveredUnitIds||[]))throw Error('Feedback differs from exact review report');
 const queuePath=path.join(run,'queue.json'),queue=read(queuePath);const jobs=queue.jobs.filter(j=>j.id===job);
 if(jobs.length!==1||!queue.models.includes(model)||queue.revision)throw Error('Expected original main queue and unique job/model');
 const sourceJob=jobs[0];const priorRun=f.revision===0?run:revisionDirectory(run,f.revision,model,job);
 const candidatePath=path.join(priorRun,'results',model.replaceAll(':','-'),job,'candidate.json');const candidateBytes=fs.readFileSync(candidatePath),candidate=JSON.parse(candidateBytes);
 if(digest(candidateBytes)!==f.candidateHash||f.candidateHash!==report.hashes?.candidate||digest(fs.readFileSync(path.join(dir,'candidate.json')))!==f.candidateHash)throw Error('Feedback is stale or candidate changed');
 const inputs=loadInputs(sourceJob.jobPath,candidatePath);
 if(!same(inputs.hashes,report.hashes))throw Error('Current source/review input hashes differ from prior report');
 if(sourceJob.jobHash!==digest(inputs.job)||sourceJob.sourceHash!==digest(sourceJob.fullEvidenceText)||digest(sourceJob.fullEvidenceText)!==inputs.hashes.fullEvidence)throw Error('Original queue source binding mismatch');
 const base=path.dirname(sourceJob.jobPath),resolve=p=>path.resolve(base,p);
 const packets=(inputs.job.authorPackets||[{promptPath:inputs.job.authorPromptPath,schemaPath:inputs.job.authorSchemaPath}]).map(p=>({prompt:fs.readFileSync(resolve(p.promptPath),'utf8'),schema:read(resolve(p.schemaPath)),sourceIds:p.sourceIds||[],oversized:!!p.oversized}));
 if(!same(packets,sourceJob.packets))throw Error('Original source packet binding mismatch');
 const identity={version:report.version,hashes:report.hashes,model:report.model,reviewModel:report.reviewModel||null,revision:report.revision};
 if(digest(identity)!==report.fingerprint)throw Error('Report fingerprint mismatch');
 if(f.revision===1){const previous=read(path.join(priorRun,'revision.json'));if(previous.mainRun!==run||previous.jobId!==job||previous.model!==model||previous.revision!==1||previous.mainQueueHash!==digest(fs.readFileSync(queuePath)))throw Error('Previous revision provenance mismatch');}
 const instructions='Independent review revision '+f.nextRevision+' of at most 2. Correct the issues below using only the complete supplied evidence. Preserve supported earlier content. Missing evidence must remain an explicit hold; never invent a repair. Return the complete candidate JSON.\n'+JSON.stringify({issues:f.issues,errors:f.errors,coverage:f.coverage});
 if(!sourceJob.packets?.length)throw Error('No original source packets');
 if(sourceJob.authorEligible===false||sourceJob.packets.some(p=>p.oversized))throw Error('Original source is not eligible for bounded authoring');
 // The worker carries the prior candidate once per request; do not copy it into every stored packet.
 for(let i=0;i<sourceJob.packets.length;i++){const prompt=sourceJob.packets[i].prompt+'\nThe local author cannot see original images. Do not invent image content or claim visual inspection; the independent reviewer receives the originals.\n'+'Previous draft; retain every supported earlier section:\n'+JSON.stringify(candidate)+(i===sourceJob.packets.length-1?'\nIndependent review corrections:\n'+instructions:'');if(Buffer.byteLength(prompt)>24000)throw Error('Revision context budget exceeded; requires a complete repacketization, not truncation');}
 output=path.resolve(output||revisionDirectory(run,f.nextRevision,model,job));
 if(output===run||output.startsWith(run+path.sep)||fs.existsSync(output))throw Error('Revision output must be a new isolated sibling directory');
 const provenance={version:1,mainRun:run,mainQueueHash:digest(fs.readFileSync(queuePath)),jobId:job,model,revision:f.nextRevision,feedbackPath:feedback,feedbackHash:digest(fs.readFileSync(feedback)),reportHash:digest(fs.readFileSync(reportPath)),candidateHash:f.candidateHash,sourceHashes:inputs.hashes,publicationEligible:false};
 const next={...queue,createdAt:new Date().toISOString(),models:[model],revision:f.nextRevision,jobs:[{...sourceJob,initialDraft:candidate,revisionInstructions:instructions}],publicationEligible:false};
 fs.mkdirSync(output,{mode:0o700});
 try{for(const [name,data]of Object.entries({'queue.json':next,'revision.json':provenance,'feedback.json':f,'prior-report.json':report}))fs.writeFileSync(path.join(output,name),JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});}catch(e){throw Error('Incomplete private revision output retained for inspection: '+e.message);}
 return {runDir:output,jobId:job,model,revision:f.nextRevision,packets:sourceJob.packets.length,publicationEligible:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){if(!['--run','--job','--model','--feedback','--output'].includes(args[i])||!args[i+1])throw Error('Use --run --job --model --feedback [--output]');options[args[i].slice(2)]=args[i+1];}
 for(const k of ['run','job','model','feedback'])if(!options[k])throw Error('Missing --'+k);
 console.log(JSON.stringify(prepareRevision(options),null,2));
}

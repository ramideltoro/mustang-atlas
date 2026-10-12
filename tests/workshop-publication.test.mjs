import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {readStableWorkshopSnapshot,validateWorkshopSnapshot,deploymentTarget,remotePublicationScript} from '../scripts/sync-workshop-guides.mjs';

const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-workshop-sync-test-')),contentDir=path.join(root,'content'),dataDir=path.join(root,'data');fs.mkdirSync(contentDir);fs.mkdirSync(path.join(dataDir,'media'),{recursive:true});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('CREATE TABLE documents(id,title,kind,system_id,section_code,section_title,engines,source_hash,media,blocks,text)');
 const image=Buffer.from('immutable image fixture'),imageHash=sha(image),url='/media/'+imageHash+'.jpg';fs.writeFileSync(path.join(dataDir,url.slice(1)),image);
 for(const[id,kind,engine]of[['G1','repair','3.7L'],['G2','diagnosis','3.7L'],['G3','diagnosis','3.7L']])db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,id,kind,'engine','303-01','Engine '+engine,JSON.stringify([engine]),sha(id),JSON.stringify([{id:id+'-m1',url,width:580,height:400,mime:'image/jpeg'}]),JSON.stringify([{id:id+'-b1',type:'media',mediaId:id+'-m1'}]),'Inspect the component and measure its condition.');
 const guide={id:'test-guide',title:'Inspect the component',summary:'Find the confirmed condition.',categoryId:'advanced',ruleIds:[],systemId:'engine',taskType:'diagnostics',difficulty:'advanced',applicability:{engines:['3.7L'],years:[2015]},sourceRefs:[{documentId:'G1',sourceHash:sha('G1')}],primaryDocumentIds:['G1'],evidence:[],hero:{documentId:'G1',mediaId:'G1-m1'},introduction:'Inspect the fitted component.',why:'Confirm the cause before replacing it.',when:{summary:'When a fault has been identified.',notes:[]},prepare:[],steps:[{title:'Inspect',body:'Follow [the component check](#/document/G1).'}],watchFor:[],notes:[],procedures:[{documentId:'G1',purpose:'Perform the full inspection.'}],relatedGuideIds:[]};
 const seed={version:1,title:'Care and repair',description:'Engine-specific procedures.',categories:[{id:'advanced',title:'Advanced',description:'Condition-based service.'}],guides:[],evidence:{}};
 const workshop={version:1,guides:[guide],evidence:{}},coverage={version:1,documents:[{documentId:'G1',sourceHash:sha('G1'),status:'covered',guideIds:[guide.id],sections:[{id:'complete',start:0,end:46,guideId:guide.id,status:'covered'}]},{documentId:'G2',sourceHash:sha('G2'),status:'pending',guideIds:[],sections:[{id:'complete',start:0,end:46,guideId:'future-guide',status:'pending'}]},{documentId:'G3',sourceHash:sha('G3'),status:'pointer',guideIds:[guide.id],sections:[],destinationIds:['G1'],destinationCoverage:'covered'}]};
 const write=()=>{for(const[name,v]of Object.entries({'maintenance-guides.json':seed,'workshop-guides.json':workshop,'workshop-coverage.json':coverage}))fs.writeFileSync(path.join(contentDir,name),JSON.stringify(v));};write();
 const validate=()=>{write();return validateWorkshopSnapshot(db,{snapshot:readStableWorkshopSnapshot(contentDir),dataDir});};return{root,contentDir,dataDir,db,guide,seed,workshop,coverage,validate,url};
}
test('stable accepted snapshot permits pending work and source-bound pointer coverage',t=>{const f=fixture(t),r=f.validate();assert.equal(r.ok,true,JSON.stringify(r.issues));assert.equal(r.workshopGuides,1);assert.equal(r.coverageDocuments,3);assert.deepEqual(r.assets,[f.url]);assert.equal(r.hashes['workshop-guides.json'].length,64);assert.equal(fs.existsSync(path.join(f.contentDir,'publisher.pid')),false);});
test('stale sources and split guide/coverage snapshots cannot be published',t=>{for(const mutate of[f=>f.guide.sourceRefs[0].sourceHash='stale',f=>f.coverage.documents[0].sourceHash='stale',f=>{f.coverage.documents[0].status='pending';f.coverage.documents[0].guideIds=[];f.coverage.documents[0].sections[0].status='pending';f.coverage.documents[2].guideIds=[];f.coverage.documents[2].destinationCoverage='pending';},f=>f.coverage.documents[0].sections[0].end=9999]){const f=fixture(t);mutate(f);const r=f.validate();assert.equal(r.ok,false);assert.ok(r.issues.length);}});
test('broken inline articles, private PDF links, unknown images and related guides fail closed',t=>{for(const mutate of[f=>f.guide.steps[0].body='See [other](#/document/G2).',f=>f.guide.steps[0].body='See [PDF](/source/G1.pdf).',f=>f.guide.steps[0].body='![Image](/media/'+('b'.repeat(64))+'.jpg)',f=>f.guide.relatedGuideIds=['missing'],f=>f.guide.hero.mediaId='not-here',f=>fs.unlinkSync(path.join(f.dataDir,f.url.slice(1)))]){const f=fixture(t);mutate(f);assert.equal(f.validate().ok,false);}});
test('duplicate guide IDs and engine-incompatible pointer propagation are rejected',t=>{const f=fixture(t);f.workshop.guides.push(structuredClone(f.guide));assert.equal(f.validate().ok,false);f.workshop.guides.pop();f.db.prepare('UPDATE documents SET engines=?,section_title=? WHERE id=?').run('["5.2L"]','Engine 5.2L','G3');assert.ok(f.validate().issues.some(e=>e.reason==='pointer-guide-engine-mismatch'));});
test('partial coverage separates bound supported spans from explicitly unsupported execution',t=>{
 const f=fixture(t),r=f.coverage.documents[0];r.status='partial';r.sections[0].end=20;r.sections.push({id:'unresolved-branch',start:20,end:46,status:'unsupported',reason:'The branch contradicts its test result; no supported next action.'});f.coverage.documents[2].destinationCoverage='partial';
 const result=f.validate();assert.equal(result.ok,true,JSON.stringify(result.issues));assert.equal(result.coveredDocuments,0);assert.equal(result.partialDocuments,1);
 for(const mutate of[r=>r.sections[1].guideId='test-guide',r=>r.sections[1].reason='',r=>r.sections[0].end=21,r=>r.status='covered',r=>r.sections.pop()]){const saved=structuredClone(r);mutate(r);assert.equal(f.validate().ok,false);Object.assign(r,saved);}
});
test('unsupported execution cannot carry a guide or disguise supported spans',t=>{
 const f=fixture(t),r=f.coverage.documents[1];r.status='unsupported';r.reason='Execution details are absent.';r.sections=[{id:'unavailable',start:0,end:46,status:'unsupported',reason:r.reason}];assert.equal(f.validate().ok,true);
 r.sections[0].status='pending';assert.equal(f.validate().ok,false);
});
test('snapshot limits and deployment destinations reject unsafe input',t=>{const f=fixture(t);fs.truncateSync(path.join(f.contentDir,'workshop-guides.json'),32*1024*1024+1);assert.throws(()=>readStableWorkshopSnapshot(f.contentDir),/size/);for(const env of[{ATLAS_DEPLOY_HOST:'-oProxyCommand=bad'},{ATLAS_DEPLOY_CONTENT:'/srv/atlas;bad/'},{ATLAS_DEPLOY_DATA:'/srv/../data/'}])assert.throws(()=>deploymentTarget(env),/destination/);});
test('remote baseline/image checks occur before atomic replacement and leave old content intact on failure',t=>{
 const f=fixture(t),report=f.validate();assert.equal(report.ok,true,JSON.stringify(report.issues));fs.writeFileSync(path.join(f.dataDir,'atlas.sqlite'),'database fixture');const databaseHash=sha('database fixture'),target=deploymentTarget({ATLAS_DEPLOY_HOST:'localhost',ATLAS_DEPLOY_CONTENT:f.contentDir+'/',ATLAS_DEPLOY_DATA:f.dataDir+'/'}),tempName='.workshop-guides.'+'a'.repeat(20)+'.tmp';
 const candidate=fs.readFileSync(path.join(f.contentDir,'workshop-guides.json'));fs.writeFileSync(path.join(f.contentDir,'workshop-guides.json'),'old published content');fs.writeFileSync(path.join(f.contentDir,tempName),candidate);
 const script=remotePublicationScript({target,hashes:report.hashes,databaseHash:'0'.repeat(64),assets:report.assets,tempName});assert.ok(script.indexOf('sha256sum')<script.indexOf('mv --'));
 // The production host uses GNU sha256sum; this portable wrapper enables the
 // same shell transaction test on macOS without connecting to any server.
 const bin=path.join(f.root,'bin');fs.mkdirSync(bin);fs.writeFileSync(path.join(bin,'sha256sum'),'#!/bin/sh\nexec shasum -a 256 "$@"\n',{mode:0o755});const env={...process.env,PATH:bin+':'+process.env.PATH};
 assert.notEqual(spawnSync('sh',['-s'],{input:script,env}).status,0);assert.equal(fs.readFileSync(path.join(f.contentDir,'workshop-guides.json'),'utf8'),'old published content');assert.equal(fs.existsSync(path.join(f.contentDir,tempName)),false);
 fs.writeFileSync(path.join(f.contentDir,tempName),candidate);const good=remotePublicationScript({target,hashes:report.hashes,databaseHash,assets:report.assets,tempName});const result=spawnSync('sh',['-s'],{input:good,env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(fs.readFileSync(path.join(f.contentDir,'workshop-guides.json')),candidate);assert.equal(fs.existsSync(path.join(f.contentDir,tempName)),false);
 fs.writeFileSync(path.join(f.contentDir,'workshop-guides.json'),'previous release');fs.writeFileSync(path.join(f.contentDir,tempName),candidate);fs.writeFileSync(path.join(f.dataDir,f.url.slice(1)),'corrupt asset');assert.notEqual(spawnSync('sh',['-s'],{input:good,env}).status,0);assert.equal(fs.readFileSync(path.join(f.contentDir,'workshop-guides.json'),'utf8'),'previous release');
});

test('application-specific partial coverage stays partial without inventing an excluded text span',t=>{
 const f=fixture(t),r=f.coverage.documents[0];
 r.status='partial';r.supportedEngines=['3.7L'];r.supportedApplications=[{engines:['3.7L'],guideIds:[f.guide.id]}];r.unsupportedApplications=[{engines:['5.2L'],scope:'Complete removal',reason:'The available procedure omits the application-specific removal steps.'}];f.coverage.documents[2].destinationCoverage='partial';
 const result=f.validate();assert.equal(result.ok,true,JSON.stringify(result.issues));assert.equal(result.partialDocuments,1);assert.equal(result.coveredDocuments,0);assert.equal(result.unsupportedApplications,1);
 for(const mutate of[r=>r.status='covered',r=>r.unsupportedApplications[0].reason='',r=>r.unsupportedApplications[0].engines=['3.7L'],r=>r.unsupportedApplications[0].guideIds=[f.guide.id],r=>r.supportedApplications[0].guideIds=[],r=>r.supportedEngines=['5.0L'],r=>r.sourceHash='stale']){
  const saved=structuredClone(r);mutate(r);assert.equal(f.validate().ok,false);Object.keys(r).forEach(k=>delete r[k]);Object.assign(r,saved);
 }
 f.guide.applicability.engines.push('5.2L');f.db.prepare('UPDATE documents SET engines=?,section_title=? WHERE id=?').run('["3.7L","5.2L"]','Engine','G1');
 assert.ok(f.validate().issues.some(e=>e.reason==='guide-claims-unsupported-application'));
});

test('application partial coverage allows pending supported work without claiming an available guide',t=>{
 const f=fixture(t),r=f.coverage.documents[1];r.status='partial';r.supportedApplications=[{engines:['3.7L'],guideIds:[]}];r.unsupportedApplications=[{engines:['5.2L'],scope:'Complete removal',reason:'No supported removal sequence for this application.'}];
 const result=f.validate();assert.equal(result.ok,true,JSON.stringify(result.issues));assert.equal(result.pendingSections,1);assert.equal(result.unsupportedApplications,1);
 r.status='pending';assert.ok(f.validate().issues.some(e=>e.reason==='application-exclusion-needs-partial-status'));
});

test('partial source spans may remain pending alongside an explicit excluded branch',t=>{
 const f=fixture(t),r=f.coverage.documents[1];r.status='partial';r.sections[0].end=20;r.sections.push({id:'excluded',start:20,end:46,status:'unsupported',reason:'Conflicting result branch; no supported execution.'});
 const result=f.validate();assert.equal(result.ok,true,JSON.stringify(result.issues));assert.equal(result.pendingSections,1);
});

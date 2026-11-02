import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,numericAudit,sha,run,atomic,request} from './local-editorial-worker.mjs';
import {shellQuote} from './local-editorial-transport.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
test('local draft schema rejects incomplete or expanded records',()=>{
 const schema={type:'object',required:['id','steps'],additionalProperties:false,properties:{id:{type:'string'},steps:{type:'array',minItems:1,items:{type:'integer'}}}};
 assert.deepEqual(validate({id:'one',steps:[1]},schema),[]);
 assert.match(validate({id:1,steps:[],extra:true},schema).join(' '),/expected string/);
 assert.match(validate({id:'one'},schema).join(' '),/missing steps/);
 assert.match(validate({id:'one',steps:[1],extra:true},schema).join(' '),/unexpected extra/);
});
test('new technical quantities are review flags rather than silently accepted',()=>{
 const check=numericAudit('Torque 10 Nm. Gap 2 mm.',{detail:'Use 12 Nm and 2 mm.'});
 assert.deepEqual(check.unmatchedDraftQuantities,['12nm']);assert.equal(check.requiresReview,true);
});
test('cache identity changes with model or evidence',()=>{
 assert.notEqual(sha({model:'14b',source:'a'}),sha({model:'32b',source:'a'}));
 assert.notEqual(sha({model:'14b',source:'a'}),sha({model:'14b',source:'b'}));
});
test('shell quoting keeps literal substitutions and apostrophes',()=>{
 assert.equal(shellQuote("a'$(printf bad)"),"'a'\\''$(printf bad)'");
});
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'mustang-worker-test-')),dir=path.join(root,'runs','pilot');const schema={type:'object',required:['text'],additionalProperties:false,properties:{text:{type:'string'}}};atomic(path.join(dir,'queue.json'),{ollamaUrl:'http://127.0.0.1:11434',models:['qwen2.5:14b'],options:{num_ctx:8192},jobs:[{id:'a',packets:[{prompt:'Source: 10 Nm.',schema}],fullEvidenceText:'10 Nm.'}]});return{root,dir,state:()=>JSON.parse(fs.readFileSync(path.join(dir,'state.json'))),clear:()=>fs.rmSync(root,{recursive:true,force:true})};}
function probes(reply={text:'10 Nm.'}){const p={calls:0,memory:()=>({availableBytes:32*1024**3,load1:1}),health:async()=>({ok:true,elapsedMs:1})};p.request=async(url,body)=>{if(url.endsWith('/version'))return{version:'test'};if(url.endsWith('/tags'))return{models:[{name:'qwen2.5:14b',digest:'test-digest'}]};if(url.endsWith('/ps'))return{models:[]};p.calls++;return{message:{content:JSON.stringify(reply)},done_reason:'stop',eval_count:10,prompt_eval_count:10};};return p;}
test('completed server drafts resume without a second model call',async()=>{const f=fixture(),p=probes();try{await run(f.dir,{probes:p});await run(f.dir,{probes:p});assert.equal(p.calls,1);assert.equal(f.state().jobs['qwen2.5-14b/a'].status,'drafted');assert.equal(f.state().state,'drafting-complete');}finally{f.clear();}});
test('invalid model output stays failed and never emits a final candidate',async()=>{const f=fixture(),p=probes({wrong:'value'});try{await run(f.dir,{probes:p});assert.equal(f.state().jobs['qwen2.5-14b/a'].status,'failed');assert.equal(fs.existsSync(path.join(f.dir,'results/qwen2.5-14b/a/candidate.json')),false);}finally{f.clear();}});
test('unhealthy existing service stops the entire run before generation',async()=>{const f=fixture(),p=probes();p.health=async()=>({ok:false});try{await run(f.dir,{probes:p});assert.equal(f.state().state,'blocked-service-health');assert.equal(p.calls,0);}finally{f.clear();}});
test('a shared live-worker lock prevents a second run',async()=>{const f=fixture();fs.mkdirSync(path.join(f.root,'draft-worker.lock'));fs.writeFileSync(path.join(f.root,'draft-worker.lock/pid'),String(process.pid));try{await assert.rejects(run(f.dir,{probes:probes()}),/already running/);}finally{f.clear();}});
test('non-loopback and unapproved models fail before inference',async()=>{const f=fixture();try{const c=JSON.parse(fs.readFileSync(path.join(f.dir,'queue.json')));c.ollamaUrl='https://example.com';atomic(path.join(f.dir,'queue.json'),c);await assert.rejects(run(f.dir,{probes:probes()}),/loopback/);c.ollamaUrl='http://127.0.0.1:11434';c.models=['cloud-model'];atomic(path.join(f.dir,'queue.json'),c);await assert.rejects(run(f.dir,{probes:probes()}),/approved list/);}finally{f.clear();}});
test('CPU inference transport honors its explicit deadline and delayed responses',async()=>{
 const server=http.createServer((req,res)=>{req.resume();setTimeout(()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end('{"done":true}');},70);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/api/chat';
 try{assert.deepEqual(await request(url,{model:'test'},500),{done:true});await assert.rejects(request(url,{model:'test'},15),/deadline exceeded/);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

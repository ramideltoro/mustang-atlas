/** Local-model-reviewed articles only. No Codex/OpenAI client or legacy approval-map writes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {load} from 'cheerio';
export const hash=value=>crypto.createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const safeId=id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,150}$/.test(id);
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
const json=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{mode:0o600,flag:'wx'});
const bytes=file=>fs.existsSync(file)?fs.readFileSync(file):null;
const bytesHash=b=>b===null?null:hash(b);
const directoryHash=dir=>{if(!fs.existsSync(dir))return null;const walk=d=>fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>{const f=path.join(d,e.name);if(e.isSymbolicLink())throw Error('Article directory symlinks prohibited');return [e.name,e.isDirectory()?walk(f):hash(fs.readFileSync(f))];});return hash(walk(dir));};
export const candidateHash=a=>hash({id:a.id,kind:a.kind,title:a.title,articleHtml:a.articleHtml,sourceBindings:a.sourceBindings});
export function validateArticle(root,item){
 root=fs.realpathSync(root);const a=item.artifact;
 if(!a||!safeId(item.id)||item.id!==a.id||item.kind!==a.kind||!['reference','workshop','care'].includes(a.kind))throw Error('Invalid article identity');
 if(typeof a.title!=='string'||!a.title.trim()||typeof a.articleHtml!=='string'||!a.articleHtml.trim())throw Error('Missing article title or HTML');
 if(!Array.isArray(a.sourceBindings)||!a.sourceBindings.length)throw Error('Complete source bindings required');
 const seen=new Set();for(const b of a.sourceBindings){
  if(typeof b.path!=='string'||path.isAbsolute(b.path)||b.path.split(/[\\/]/).includes('..')||!/^(work|data|content)\//.test(b.path)||!/^[a-f0-9]{64}$/.test(b.sha256)||b.path.startsWith('content/local-articles/')||seen.has(b.path))throw Error('Invalid or duplicate source binding');
  const file=fs.realpathSync(path.join(root,b.path));if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())throw Error('Source path escaped root');
  if(hash(fs.readFileSync(file))!==b.sha256)throw Error('Source hash mismatch: '+b.path);seen.add(b.path);
 }
 const r=a.review;if(r?.kind!=='local-model-review'||r.passed!==true||typeof r.model!=='string'||!r.model.trim()||!Array.isArray(r.issues)||r.issues.length||r.candidateSha256!==candidateHash(a)||r.sourceBindingsSha256!==hash(a.sourceBindings))throw Error('Exact passing local-model review required');
 if(a.deterministicChecks?.passed!==true||!Array.isArray(a.deterministicChecks.checks)||a.deterministicChecks.checks.some(c=>c?.passed===false))throw Error('Passing deterministic checks required');
 if(a.referenceReview||a.authoring?.independentSourceReview||a.authoring?.independentTechnicalReview||a.humanReviewed===true||r.humanReviewed===true||r.independentCodex===true)throw Error('False independent/human provenance prohibited');
 const $=load(a.articleHtml,null,false);
 if($('script,iframe,object,embed,form,input,button,textarea,select,base,meta,link,style,svg,math').length)throw Error('Active HTML prohibited');
 $('*').each((_,el)=>{for(const [k,v]of Object.entries(el.attribs||{})){
  if(/^on/i.test(k)||['srcdoc','style','srcset'].includes(k.toLowerCase()))throw Error('Active HTML attribute prohibited');
  if(['href','src','xlink:href','action','formaction'].includes(k.toLowerCase())){
   const u=v.replace(/[\u0000-\u0020\u007f]/g,'');if(!u||!(/^(https?:\/\/|#|\/(?!\/))/.test(u)))throw Error('Unsafe article URL');
  }
 }});
 return structuredClone(a);
}
export function createPublicationTransport(root,release,manifest,{execute=execFileSync,fetchImpl=fetch}={}){
 const git=process.env.ATLAS_GIT||'/Users/ramideltoro/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/git';
 const run=(cmd,args,options={})=>execute(cmd,args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,...options});
 const g=(args,options={})=>run(git,args,options);
 const remoteGit=args=>run(process.execPath,[path.resolve(root,'../gh-run.mjs'),git,'-c','credential.helper=','-c','credential.helper=!gh auth git-credential',...args]);
 const sudo=script=>run(process.execPath,[path.resolve(root,'../backend-root.mjs'),script]);
 const remote='/srv/mustang-atlas-local-'+manifest.id,tmp='/tmp/mustang-local-'+manifest.id,lock='/srv/mustang-atlas/.standalone-publish.lock';
 let base,commit,remoteLocked=false,swapped=false,pushed=false;const index=path.join(release,'git-index'),env={...process.env,GIT_INDEX_FILE:index};
 const syncIndex=ref=>{for(const f of manifest.files){const row=g(['ls-tree',ref,'--',f.path]).trim();if(!row)g(['update-index','--force-remove','--',f.path]);else {const [mode,,blob]=row.split(/\s+/);g(['update-index','--add','--cacheinfo',mode,blob,f.path]);}}};
 const rollbackGit=()=>{if(!pushed)return;const remoteHead=remoteGit(['ls-remote','origin','refs/heads/main']).trim().split(/\s/)[0];if(remoteHead===base){pushed=false;return;}if(remoteHead!==commit)throw Error('Concurrent remote Git update: automatic rollback refused');const head=g(['rev-parse','refs/heads/main']).trim();if(head!==base&&head!==commit)throw Error('Concurrent Git update: automatic rollback refused');const tree=g(['rev-parse',base+'^{tree}']).trim();const rollback=g(['commit-tree',tree,'-p',commit],{input:'Rollback local article release '+manifest.id+'\n'}).trim();remoteGit(['push','origin',rollback+':refs/heads/main']);g(['update-ref','refs/heads/main',rollback,head]);syncIndex(rollback);pushed=false;};
 return {
  prepare(){
   if(g(['symbolic-ref','--short','HEAD']).trim()!=='main')throw Error('Publication requires main branch');
   if(g(['remote','get-url','origin']).trim()!=='https://github.com/ramideltoro/mustang-atlas.git')throw Error('Unexpected GitHub repository');
   base=g(['rev-parse','HEAD']).trim();const remoteHead=remoteGit(['ls-remote','origin','refs/heads/main']).trim().split(/\s/)[0];if(remoteHead!==base)throw Error('GitHub main differs from local HEAD');
   for(const f of manifest.files){if(g(['diff','--cached','--name-only','--',f.path]).trim())throw Error('Target article has staged edits: '+f.path);let tracked=null;try{tracked=g(['show',base+':'+f.path],{encoding:'buffer'});}catch(e){if(!g(['ls-tree',base,'--',f.path]).trim())tracked=null;else throw e;}if(bytesHash(tracked)!==f.beforeSha256)throw Error('Target article has uncommitted local edits: '+f.path);}
   g(['read-tree',base],{env});for(const f of manifest.files){const blob=g(['hash-object','-w','--stdin'],{input:fs.readFileSync(path.join(release,'files',f.path))}).trim();g(['update-index','--add','--cacheinfo','100644',blob,f.path],{env});}
   const tree=g(['write-tree'],{env}).trim();commit=g(['commit-tree',tree,'-p',base],{input:'Publish locally reviewed articles '+manifest.id+'\n'}).trim();
   run('tar',['-czf',path.join(release,'articles.tar.gz'),'-C',path.join(release,'files'),'content/local-articles']);
   run('ssh',['65.75.201.18','mkdir '+quote(tmp)]);run('scp',[path.join(release,'articles.tar.gz'),'65.75.201.18:'+tmp+'/']);
   sudo('set -eu\nmkdir '+lock);remoteLocked=true;
   const stale=manifest.files.map(f=>{const p='/srv/mustang-atlas/'+f.path;return f.beforeSha256?'test "$(sha256sum '+quote(p)+" | cut -d ' ' -f 1)"+'" = '+quote(f.beforeSha256):'test ! -e '+quote(p);}).join('\n');
   sudo('set -eu\n'+stale+'\nmkdir '+remote+'\ncp -a /srv/mustang-atlas/content '+remote+'/candidate\ntar -xzf '+quote(tmp+'/articles.tar.gz')+' -C '+remote+'\nmkdir -p '+remote+'/candidate/local-articles\ncp -a '+remote+'/content/local-articles/. '+remote+'/candidate/local-articles/');
  },
  publishGit(){pushed=true;remoteGit(['push','origin',commit+':refs/heads/main']);return commit;},
  activate(){swapped=true;sudo('set -eu\nmv /srv/mustang-atlas/content '+remote+'/content-before\nif mv '+remote+'/candidate /srv/mustang-atlas/content; then :; else mv '+remote+'/content-before /srv/mustang-atlas/content; exit 1; fi');swapped=true;sudo('cd /srv/mustang-atlas && docker compose up -d --no-build --force-recreate web');},
  async verify(){for(let n=0;n<20;n++){try{const h=await fetchImpl('https://mustangatlas.ramideltoro.com/healthz',{signal:AbortSignal.timeout(5000)});if(h.ok){let valid=true;for(const f of manifest.files){const response=await fetchImpl('https://mustangatlas.ramideltoro.com/api/v1/local-articles/'+f.id,{signal:AbortSignal.timeout(5000)});if(!response.ok){valid=false;break;}const a=await response.json();if(a.artifactSha256!==f.afterSha256){valid=false;break;}}if(valid)return;}}catch{}await new Promise(r=>setTimeout(r,1500));}throw Error('Live exact article verification failed');},
  finalize(){g(['update-ref','refs/heads/main',commit,base]);syncIndex(commit);},
  rollback(){const errors=[];if(swapped)try{sudo('set -eu\nif test -d '+remote+'/content-before; then\nmv /srv/mustang-atlas/content '+remote+'/failed-content\nmv '+remote+'/content-before /srv/mustang-atlas/content\ncd /srv/mustang-atlas && docker compose up -d --no-build --force-recreate web\nfi');}catch(e){errors.push('Remote rollback failed: '+e.message);}try{rollbackGit();}catch(e){errors.push('Git rollback failed: '+e.message);}if(errors.length)throw Error(errors.join('; '));},
  cleanup(){if(remoteLocked)sudo('rmdir '+lock);}
 };
}
export async function publishApproved({root,items,log=()=>{}},{transportFactory=createPublicationTransport}={}){
 root=fs.realpathSync(root);if(!Array.isArray(items)||!items.length)throw Error('Nonempty approved batch required');
 const ids=new Set();const articles=items.map(item=>{if(ids.has(item.id))throw Error('Duplicate article ID');ids.add(item.id);return validateArticle(root,item);});
 const work=path.join(root,'work/standalone-publications');fs.mkdirSync(work,{recursive:true});const lock=path.join(work,'publisher.lock');fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,'pid'),String(process.pid));
 const id=Date.now()+'-'+crypto.randomBytes(5).toString('hex'),release=path.join(work,id);fs.mkdirSync(release);const manifest={id,createdAt:new Date().toISOString(),status:'prepared',reviewMethod:'local-model-review',files:[]};let transport,localActivated=false,backup;
 try{
  const target=path.join(root,'content/local-articles'),stage=path.join(release,'local-after'),localBeforeHash=directoryHash(target);fs.mkdirSync(stage);fs.chmodSync(stage,0o755);if(fs.existsSync(target))fs.cpSync(target,stage,{recursive:true});
  for(const a of articles){const rel='content/local-articles/'+a.id+'.json',file=path.join(release,'files',rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.chmodSync(path.dirname(file),0o755);json(file,a);fs.chmodSync(file,0o644);fs.copyFileSync(file,path.join(stage,a.id+'.json'));manifest.files.push({id:a.id,path:rel,beforeSha256:bytesHash(bytes(path.join(root,rel))),afterSha256:hash(fs.readFileSync(file))});}
  json(path.join(release,'manifest.json'),manifest);transport=transportFactory(root,release,manifest);await transport.prepare();
  // Recheck exact evidence immediately before committing the batch.
  for(const artifact of articles)validateArticle(root,{id:artifact.id,kind:artifact.kind,artifact});manifest.gitCommit=await transport.publishGit();await transport.activate();await transport.verify();
  if(directoryHash(target)!==localBeforeHash)throw Error('Concurrent local article directory modification');
  for(const f of manifest.files)if(bytesHash(bytes(path.join(root,f.path)))!==f.beforeSha256)throw Error('Concurrent local article modification');
  backup=path.join(release,'local-before');if(fs.existsSync(target))fs.renameSync(target,backup);try{fs.renameSync(stage,target);localActivated=true;}catch(e){if(fs.existsSync(backup))fs.renameSync(backup,target);throw e;}
  await transport.finalize();manifest.status='live';manifest.verifiedAt=new Date().toISOString();fs.writeFileSync(path.join(release,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');log({event:'published',id,count:items.length});return manifest;
 }catch(error){const failures=[];if(localActivated){try{fs.renameSync(path.join(root,'content/local-articles'),path.join(release,'local-failed'));if(fs.existsSync(backup))fs.renameSync(backup,path.join(root,'content/local-articles'));}catch(e){failures.push(e.message);}}try{await transport?.rollback();}catch(e){failures.push(e.message);}manifest.status=failures.length?'rollback-failed':'failed';manifest.error=error.message;manifest.rollbackErrors=failures;fs.writeFileSync(path.join(release,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');throw Error(error.message+(failures.length?'; '+failures.join('; '):''));
 }finally{try{await transport?.cleanup();}catch(e){manifest.cleanupError=e.message;fs.writeFileSync(path.join(release,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');try{log({event:'cleanup-warning',id,error:e.message});}catch{}}finally{if(manifest.status!=='rollback-failed')fs.rmSync(lock,{recursive:true});}}
}

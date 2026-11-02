/** Private LAN transport. Secrets are inherited only by ssh/askpass, never sent to the host. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
export const SERVER='rami@192.168.1.115';
export const REMOTE_ROOT='/home/rami/mustang-atlas-editorial';
export const shellQuote=s=>"'"+String(s).replaceAll("'","'\\''")+"'";
function environment(){
 const file=process.env.MUSTANG_CREDENTIALS_FILE||'/Users/ramideltoro/credentials.env';
 const line=fs.readFileSync(file,'utf8').split(/\r?\n/).find(s=>/^\s*(?:export\s+)?LOCAL_SERVER_PASSWORD=/.test(s));
 if(!line)throw Error('LOCAL_SERVER_PASSWORD is missing');
 const value=line.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mustang-ssh-'));fs.chmodSync(dir,0o700);
 const askpass=path.join(dir,'askpass');fs.writeFileSync(askpass,'#!/bin/sh\nprintf \'%s\\n\' "$MUSTANG_SSH_PASSWORD"\n',{mode:0o700});
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(?:KEY|TOKEN|SECRET|PASSWORD|PASSPHRASE)$/i.test(k)));
 return {env:{...env,MUSTANG_SSH_PASSWORD:value,SSH_ASKPASS:askpass,SSH_ASKPASS_REQUIRE:'force',DISPLAY:':0'},cleanup:()=>fs.rmSync(dir,{recursive:true,force:true}),secret:value};
}
export async function ssh(command,{input,timeout=60000}={}){
 const auth=environment();
 try{return await new Promise((resolve,reject)=>{
  const p=spawn('/usr/bin/ssh',['-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15',SERVER,command],{env:auth.env,stdio:['pipe','pipe','pipe']});
  let out='',err='';const timer=setTimeout(()=>{p.kill('SIGTERM');reject(Error('Server SSH timed out'));},timeout);
  p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);
  p.on('error',reject);p.on('close',code=>{clearTimeout(timer);const clean=s=>s.split(auth.secret).join('[REDACTED]');code===0?resolve(clean(out)):reject(Error('Server SSH failed ('+code+'): '+clean(err).slice(-1500)));});
  if(input?.pipe)input.pipe(p.stdin);else p.stdin.end(input);
 });}finally{auth.cleanup();}
}
export async function upload(files,remoteDirectory){
 if(!remoteDirectory.startsWith(REMOTE_ROOT+'/'))throw Error('Upload destination outside editorial root');
 await ssh('umask 077; mkdir -p '+shellQuote(remoteDirectory));
 const staged=fs.mkdtempSync(path.join(os.tmpdir(),'mustang-upload-'));fs.chmodSync(staged,0o700);
 try{for(const [name,source]of Object.entries(files)){if(!/^[a-zA-Z0-9._-]+$/.test(name))throw Error('Invalid upload filename');fs.copyFileSync(source,path.join(staged,name));}
  const tar=spawn('/usr/bin/tar',['-czf','-','-C',staged,'.'],{env:{...process.env,COPYFILE_DISABLE:'1'},stdio:['ignore','pipe','pipe']});
  const complete=new Promise((resolve,reject)=>{tar.on('error',reject);tar.on('close',c=>c===0?resolve():reject(Error('Archive upload failed')));});
  await Promise.all([ssh('umask 077; tar -xzf - -C '+shellQuote(remoteDirectory),{input:tar.stdout,timeout:120000}),complete]);
 }finally{fs.rmSync(staged,{recursive:true,force:true});}
}
export async function sudoSsh(command){
 const auth=environment();
 try{return await ssh('sudo -S -p "" /bin/sh -c '+shellQuote(command),{input:auth.secret+'\n'});}finally{auth.cleanup();}
}
export function connectTunnel(port=11439){
 const auth=environment();const child=spawn('/usr/bin/ssh',['-N','-L',`127.0.0.1:${port}:127.0.0.1:11434`,'-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=20','-o','ServerAliveCountMax=3','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15',SERVER],{env:auth.env,stdio:['ignore','ignore','pipe']});
 let error='';child.stderr.on('data',b=>error=(error+b).slice(-2000));child.on('close',()=>auth.cleanup());
 return {child,getError:()=>error.split(auth.secret).join('[REDACTED]'),close:()=>child.kill('SIGTERM')};
}

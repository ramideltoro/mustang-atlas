import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const data=path.resolve(process.env.DATA_DIR||'data');
const host=process.env.ATLAS_DEPLOY_HOST||'65.75.201.18';
const destination=process.env.ATLAS_DEPLOY_DATA||'/srv/mustang-atlas/data/';
if(!/^[a-zA-Z0-9@.-]+$/.test(host)||!/^\/[a-zA-Z0-9/_-]+\/$/.test(destination))throw Error('Invalid deployment destination');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-media-'));
function run(command,args){return new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(command+' failed with exit '+code)));});}
try{
 // Snapshot the complete map before transferring assets. New upgrades can continue
 // locally; only this snapshot becomes public after all its files arrive.
 const bytes=fs.readFileSync(path.join(data,'media-quality.json'));
 const map=JSON.parse(bytes);if(map.version!==1||!map.assets)throw Error('Invalid quality map');
 const files=[...new Set(Object.values(map.assets).map(asset=>{
  if(!/^\/media\/[a-f0-9]{64}\.(jpg|jpeg|png|gif|webp|svg)$/.test(asset.url))throw Error('Unsafe asset path');
  const relative=asset.url.slice(1);if(!fs.statSync(path.join(data,relative)).isFile())throw Error('Missing native asset');return relative;
 }))];
 const list=path.join(temporary,'files.txt'),snapshot=path.join(temporary,'media-quality.json');
 fs.writeFileSync(list,files.join('\n')+'\n');fs.writeFileSync(snapshot,bytes);
 const ssh=['-o','BatchMode=yes','-o','ConnectTimeout=15'];
 await run('rsync',['-a','--no-owner','--no-group','--files-from='+list,'-e','ssh '+ssh.join(' '),data+'/',host+':'+destination]);
 const incoming='media-quality.incoming-'+process.pid+'.json';
 await run('rsync',['-a','--no-owner','--no-group','-e','ssh '+ssh.join(' '),snapshot,host+':'+destination+incoming]);
 await run('ssh',[...ssh,host,'mv '+destination+incoming+' '+destination+'media-quality.json']);
 console.log(JSON.stringify({synced:true,upgradedAssets:Object.keys(map.assets).length,uniqueFiles:files.length}));
}finally{fs.rmSync(temporary,{recursive:true,force:true});}

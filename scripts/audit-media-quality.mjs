import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import {digest,isLargerOriginal} from './upgrade-media-lib.mjs';
const data=path.resolve(process.env.DATA_DIR||'data');
const map=JSON.parse(fs.readFileSync(path.join(data,'media-quality.json')));
const db=new DatabaseSync(path.join(data,'atlas.sqlite'),{readOnly:true});
const docs=db.prepare('SELECT id,media FROM documents').all().map(d=>({...d,media:JSON.parse(d.media)}));
const originals=new Map(docs.flatMap(d=>d.media).map(m=>[m.url,m]));db.close();
const queue=Object.entries(map.assets),issues=[],comparisons=[];
async function thumbnail(bytes){return sharp(bytes).flatten({background:'#fff'}).resize(128,128,{fit:'fill'}).removeAlpha().toColourspace('srgb').raw().toBuffer();}
async function worker(){while(queue.length){const [url,asset]=queue.shift();try{
 const old=originals.get(url);if(!old)throw Error('Unknown catalog image');
 const bytes=fs.readFileSync(path.join(data,asset.url.slice(1))),meta=await sharp(bytes,{limitInputPixels:150000000}).metadata();
 if(digest(bytes)!==path.basename(asset.url).split('.')[0])throw Error('Asset hash differs from filename');
 if(meta.width!==asset.width||meta.height!==asset.height||!isLargerOriginal(old,meta))throw Error('Image dimensions do not support upgrade');
 const a=await thumbnail(fs.readFileSync(path.join(data,url.slice(1)))),b=await thumbnail(bytes);
 if(a.length!==b.length)throw Error('Pixel channel mismatch');
 let sum=0;for(let i=0;i<a.length;i++)sum+=(a[i]-b[i])**2;
 const rmse=Math.sqrt(sum/a.length);comparisons.push({originalUrl:url,url:asset.url,rmse,width:asset.width,height:asset.height});
 // Pixel differences rank human inspection; JPEG resampling is not a content validator.
 }catch(error){issues.push({originalUrl:url,error:error.message});}}}
await Promise.all(Array.from({length:3},worker));
comparisons.sort((a,b)=>b.rmse-a.rmse);
const allMedia=docs.flatMap(d=>d.media),unresolved=[...originals.values()].filter(m=>m.mime!=='image/svg+xml'&&!map.assets[m.url]);
const result={checkedAt:new Date().toISOString(),catalogImages:originals.size,upgradedAssets:Object.keys(map.assets).length,upgradedPlacements:allMedia.filter(m=>map.assets[m.url]).length,vectorAssets:[...originals.values()].filter(m=>m.mime==='image/svg+xml').length,unresolvedRasterAssets:unresolved.length,issues,highestDifferences:comparisons.slice(0,12),unresolved:unresolved.map(m=>({...m,documents:docs.filter(d=>d.media.some(x=>x.url===m.url)).map(d=>d.id)}))};
fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/media-quality-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,issues:issues.slice(0,10),issueCount:issues.length,highestDifferences:result.highestDifferences.slice(0,3),unresolved:undefined},null,2));
if(issues.length)process.exitCode=1;

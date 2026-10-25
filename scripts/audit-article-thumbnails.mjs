import fs from'node:fs/promises';
const base=process.argv[2]||'http://127.0.0.1:3186';
const get=async path=>{const r=await fetch(base+path);if(!r.ok)throw Error(`${r.status} ${path}`);return r.json();};
const report={checkedAt:new Date().toISOString(),base,articles:0,guides:0,originalArticleIllustrations:0,originalGuideIllustrations:0,uniqueThumbnails:0,errors:[]};const urls=new Set();
for(const [route,key]of [['documents','articles'],['maintenance','guides']]){
 let offset=0,total=Infinity;
 while(offset<total){const data=await get(`/api/v1/${route}?engine=all&limit=100&offset=${offset}`);total=data.total;if(!data.items.length)throw Error('Empty page before catalog end');for(const item of data.items){report[key]++;const image=route==='maintenance'?item.cardThumbnail||item.thumbnail:item.thumbnail;if(!image?.url)report.errors.push(`${route}/${item.id}: missing cover`);else {urls.add(image.url);if(image.generated)report[route==='maintenance'?'originalGuideIllustrations':'originalArticleIllustrations']++;}}offset+=data.items.length;}
}
const list=[...urls];for(let i=0;i<list.length;i+=12){await Promise.all(list.slice(i,i+12).map(async url=>{const r=await fetch(base+url,{method:'HEAD'});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))report.errors.push(`${url}: ${r.status}`);}));}
report.uniqueThumbnails=urls.size;await fs.mkdir('work/appearance-release',{recursive:true});await fs.writeFile('work/appearance-release/thumbnail-audit.json',JSON.stringify(report,null,2)+'\n');console.log(report);if(report.errors.length)process.exitCode=1;

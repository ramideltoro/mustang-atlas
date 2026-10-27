import fs from 'node:fs';
import {load} from 'cheerio';
const dir='work/editorial-care/evidence';fs.mkdirSync(dir,{recursive:true});
async function collect(id,title,url){const response=await fetch(url);if(!response.ok)throw Error(`${id}: HTTP ${response.status}`);const page=load(await response.text());page('script,style,noscript').remove();const body=page('.ClassContentBody');if(!body.length)throw Error('No article '+id);const tables=body.find('table').toArray().map(table=>page(table).find('tr').toArray().map(row=>page(row).children('td,th').toArray().map(cell=>({text:page(cell).text().replace(/\s+/g,' ').trim(),colspan:Number(page(cell).attr('colspan')||1),rowspan:Number(page(cell).attr('rowspan')||1)}))));body.find('tr').each((i,e)=>{page(e).append('\n');page(e).find('td,th').append(' | ');});body.find('p,div,li,h1,h2,h3,h4').append('\n');const text=body.text().replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();const record={title,url,checkedAt:new Date().toISOString(),extraction:'Complete .ClassContentBody; table cells separated with pipes; structured table spans retained',text,tables};fs.writeFileSync(`${dir}/owner-${id}.json`,JSON.stringify(record,null,2)+'\n');console.log(id,text.length);return record;}
const catalog=JSON.parse(fs.readFileSync('content/maintenance-guides.json','utf8'));
for(const [id,evidence]of Object.entries(catalog.evidence))await collect(id,evidence.title,evidence.url);
const seed=JSON.parse(fs.readFileSync(dir+'/owner-oil-check.json','utf8'));
const $=load(await(await fetch(seed.url)).text());
const wanted=[['parts',/^Motorcraft Parts$/],['specs-23',/^Capacities and Specifications - 2.3/],['specs-37',/^Capacities and Specifications - 3.7/],['specs-50',/^Capacities and Specifications - 5.0/]];
for(const [id,test]of wanted){const a=$('a').toArray().find(e=>test.test($(e).text().trim()));if(!a)throw Error('Missing '+id);await collect(id,$(a).text().trim(),new URL($(a).attr('href'),seed.url).href);}

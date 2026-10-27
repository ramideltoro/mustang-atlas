import fs from 'node:fs';
import {load} from 'cheerio';
const dir='work/editorial-care/evidence';
const seed=JSON.parse(fs.readFileSync(dir+'/owner-oil-check.json','utf8'));
const $=load(await(await fetch(seed.url)).text());
const wanted=[['parts',/^Motorcraft Parts$/],['specs-23',/^Capacities and Specifications - 2.3/],['specs-37',/^Capacities and Specifications - 3.7/],['specs-50',/^Capacities and Specifications - 5.0/]];
for(const [id,test]of wanted){const a=$('a').toArray().find(e=>test.test($(e).text().trim()));if(!a)throw Error('Missing '+id);const url=new URL($(a).attr('href'),seed.url).href,title=$(a).text().trim(),page=load(await(await fetch(url)).text());page('script,style,noscript').remove();const body=page('.ClassContentBody');if(!body.length)throw Error('No article '+id);body.find('tr').each((i,e)=>{page(e).append('\n');page(e).find('td,th').append(' | ');});body.find('p,div,li,h1,h2,h3,h4').append('\n');const text=body.text().replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();fs.writeFileSync(`${dir}/owner-${id}.json`,JSON.stringify({title,url,checkedAt:new Date().toISOString(),extraction:'Complete .ClassContentBody; table cells separated with pipes',text},null,2)+'\n');console.log(id,text.length);}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {load} from 'cheerio';
import {sanitizeSvg,saveAsset,hash} from '../server/parser.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const wrap=value=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1100 850"><image id="MAIN_IMAGE" width="800" height="603" xlink:href="${value}"/><text>C226A</text></svg>`;

test('MIME-omitted embedded source PNG becomes an explicit raster URI with identical pixels and geometry',async()=>{
 const output=await sanitizeSvg(wrap(`data:;base64,${png.toString('base64')}`));
 const $=load(output,{xml:true});
 assert.equal($('#MAIN_IMAGE').attr('xlink:href'),`data:image/png;base64,${png.toString('base64')}`);
 assert.equal($('#MAIN_IMAGE').attr('width'),'800');
 assert.equal($('#MAIN_IMAGE').attr('height'),'603');
 assert.equal($('svg').attr('viewBox'),'0 0 1100 850');
 assert.equal($('text').text(),'C226A');
 assert.deepEqual(await sharp(png).raw().toBuffer(),await sharp(Buffer.from($('#MAIN_IMAGE').attr('xlink:href').split(',')[1],'base64')).raw().toBuffer());
});

test('MIME-omitted supported rasters are decoded; malformed, truncated, misdeclared and active content is rejected',async()=>{
 const jpeg=await sharp({create:{width:2,height:2,channels:3,background:'#c68d46'}}).jpeg().toBuffer();
 let $=load(await sanitizeSvg(wrap(`data:;base64,${jpeg.toString('base64')}`)),{xml:true});
 assert.equal($('#MAIN_IMAGE').attr('xlink:href'),`data:image/jpeg;base64,${jpeg.toString('base64')}`);
 const active=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
 const html=Buffer.from('<html><script>alert(1)</script></html>');
 for(const value of [
  `data:;base64,${png.toString('base64').slice(0,20)}!${png.toString('base64').slice(20)}`,
  `data:;base64,${png.subarray(0,24).toString('base64')}`,
  `data:image/jpeg;base64,${png.toString('base64')}`,
  `data:image/svg+xml;base64,${active.toString('base64')}`,
  `data:image/png;base64,${active.toString('base64')}`,
  `data:;base64,${active.toString('base64')}`,
  `data:;base64,${html.toString('base64')}`,
  'https://example.test/remote.png',
  'file:///private/image.png',
 ]){
  $=load(await sanitizeSvg(wrap(value)),{xml:true});
  assert.equal($('#MAIN_IMAGE').attr('xlink:href'),undefined,value.slice(0,64));
  assert.equal($('text').text(),'C226A');
 }
 const animated=await sanitizeSvg('<svg><image href="#safe"><set attributeName="href" to="https://example.test/remote.svg"/><animate attributeName="href" values="https://example.test/remote.svg"/></image></svg>');
 assert.doesNotMatch(animated,/<set|<animate|example\.test/);
 const styled=await sanitizeSvg(`<svg><style>.a { fill: url(#safe); background: url(data:image/svg+xml;base64,${active.toString('base64')}); }</style><path style="fill:url(https://example.test/remote.svg)" stroke="url('#safe')"/></svg>`);
 assert.match(styled,/url\(#safe\)/);
 assert.doesNotMatch(styled,/data:image|example\.test/);
});

test('saving a repaired SVG hashes the sanitized asset without altering its supplied source bytes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-svg-repair-'));
 try{
  const raw=Buffer.from(wrap(`data:;base64,${png.toString('base64')}`));
  const before=hash(raw);
  const asset=await saveAsset(raw,'image/svg+xml',dir);
  const saved=await fs.readFile(path.join(dir,asset.url.slice(1)));
  assert.equal(hash(raw),before);
  assert.equal(asset.url,`/media/${hash(saved)}.svg`);
  assert.equal(asset.mime,'image/svg+xml');
  assert.match(saved.toString(),/xlink:href="data:image\/png;base64,/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('SVG namespace prefixes preserve valid image data without bypassing active-content filtering',async()=>{
 const output=await sanitizeSvg(`<s:svg xmlns:s="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><s:script>bad()</s:script><s:foreignObject>bad</s:foreignObject><s:image xlink:href="data:;base64,${png.toString('base64')}"><s:set attributeName="href" to="https://example.test/a.svg"/></s:image><s:style>.wire {stroke: red;fill:url(#safe)} .bad {fill:url(https://example.test/a.svg)}</s:style></s:svg>`);
 assert.match(output,/<s:image xlink:href="data:image\/png;base64,/);
 assert.match(output,/stroke: red/);
 assert.match(output,/url\(#safe\)/);
 assert.doesNotMatch(output,/<s:script|<s:foreignObject|<s:set|bad\(\)|example\.test/);
});

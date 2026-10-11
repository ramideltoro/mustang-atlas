import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {auditSvgRepair} from '../scripts/audit-media-quality.mjs';
import {sanitizeSvg} from '../server/parser.mjs';

const raster=async background=>sharp({create:{width:2,height:2,channels:3,background}}).png().toBuffer();
const svg=href=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1100" height="850"><image id="MAIN_IMAGE" x="150" y="123" width="800" height="604"${href?` xlink:href="${href}"`:''}/><text x="1" y="20">Original label</text></svg>`;

test('SVG audit validates exact original embedded raster bytes and unchanged placement',async()=>{
 const png=await raster('red'),rawSource=Buffer.from(svg('data:;base64,'+png.toString('base64')));
 const bytes=Buffer.from(await sanitizeSvg(rawSource.toString())),oldBytes=Buffer.from(await sanitizeSvg(svg('')));
 assert.deepEqual(await auditSvgRepair({bytes,oldBytes,rawSource}),{restoredImages:1,sourceVerified:true});
 assert.deepEqual(await auditSvgRepair({bytes,oldBytes}),{restoredImages:1,sourceVerified:false});
 const otherPng=await raster('blue');
 const changed=Buffer.from(await sanitizeSvg(svg('data:;base64,'+otherPng.toString('base64'))));
 await assert.rejects(auditSvgRepair({bytes:changed,oldBytes,rawSource}),/differs from sanitized original/);
 await assert.rejects(auditSvgRepair({bytes:Buffer.from(bytes.toString().replace('x="150"','x="151"')),oldBytes,rawSource}),/geometry changed/);
});

test('SVG audit refuses active content, unsafe payloads and repairs that restore nothing',async()=>{
 const png=await raster('white'),rawSource=Buffer.from(svg('data:;base64,'+png.toString('base64')));
 const bytes=Buffer.from(await sanitizeSvg(rawSource.toString())),oldBytes=Buffer.from(await sanitizeSvg(svg('')));
 const dangerous=[bytes.toString().replace('</svg>','<script>alert(1)</script></svg>'),svg('data:image/svg+xml;base64,'+Buffer.from('<svg/>').toString('base64')),svg('data:image/png;base64,'+Buffer.from('<html>not a raster</html>').toString('base64'))];
 for(const content of dangerous)await assert.rejects(auditSvgRepair({bytes:Buffer.from(content),oldBytes,rawSource}),/not safely normalized/);
 await assert.rejects(auditSvgRepair({bytes,oldBytes:bytes,rawSource}),/restores no missing image/);
});

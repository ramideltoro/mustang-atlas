import test from 'node:test';
import assert from 'node:assert/strict';
import {imageGeometry,fitImageScale,nextImageZoom} from './image-model.mjs';

test('unupgraded raster previews never stretch beyond their intrinsic pixels',()=>{
 const small=imageGeometry({width:99,height:73,mime:'image/jpeg'});
 assert.equal(small.thumbnail,true);assert.equal(small.previewWidth,99);assert.equal(small.previewHeight,73);assert.equal(small.maxPreviewWidth,131);
 const diagram=imageGeometry({width:580,height:381,mime:'image/jpeg'});
 assert.equal(diagram.thumbnail,false);assert.equal(diagram.maxPreviewWidth,612);
 assert.equal(fitImageScale(diagram,{width:1100,height:700}),1);
});
test('source thumbnail dimensions keep a native-resolution tool compact without limiting zoom',()=>{
 const tool=imageGeometry({width:1902,height:1403,sourceWidth:99,sourceHeight:73,mime:'image/jpeg',quality:'native-source'});
 assert.equal(tool.thumbnail,true);assert.equal(tool.previewWidth,144);assert.equal(tool.maxPreviewWidth,176);assert.equal(tool.width,1902);
 const mobileScale=fitImageScale(tool,{width:347,height:400});
 assert.equal(mobileScale,315/1902);assert(mobileScale*tool.width<=315);
 assert.equal(tool.width*1,1902,'100% uses the native image, not the old 99-pixel thumbnail');
});
test('desktop and mobile fit preserve aspect ratio and fit both viewport dimensions',()=>{
 const diagram=imageGeometry({width:1902,height:1249,sourceWidth:580,sourceHeight:381,mime:'image/jpeg'});
 assert.equal(diagram.thumbnail,false);assert.equal(diagram.maxPreviewWidth,1934);
 for(const viewport of [{width:1040,height:620},{width:347,height:400},{width:270,height:300}]){
  const scale=fitImageScale(diagram,viewport),width=diagram.width*scale,height=diagram.height*scale;
  assert(width<=viewport.width-32+.001);assert(height<=viewport.height-32+.001);assert(Math.abs(width/height-1902/1249)<.00001);assert(scale<=1);
 }
 const tall=imageGeometry({width:500,height:2000,mime:'image/png'});
 assert.equal(fitImageScale(tall,{width:1000,height:620}),588/2000);
});
test('native image measurements win and SVGs remain scalable',()=>{
 const raster=imageGeometry({width:580,height:381,mime:'image/jpeg'},{width:1902,height:1249});
 assert.equal(raster.width,1902);assert.equal(raster.height,1249);
 const vector=imageGeometry({width:400,height:200,mime:'image/svg+xml'});
 assert.equal(vector.vector,true);assert.equal(vector.maxPreviewWidth,null);assert.equal(fitImageScale(vector,{width:1000,height:620}),968/400);
});
test('zoom steps use actual image percentages and return through fit without changing geometry',()=>{
 const fit=315/1902;
 assert.equal(nextImageZoom(fit,1,fit),.25);assert.equal(nextImageZoom(.25,-1,fit),fit);
 assert.equal(nextImageZoom(.75,1,fit),1);assert.equal(nextImageZoom(1,1,fit),1.25);
 assert.equal(nextImageZoom(4,1,fit),4);assert.equal(nextImageZoom(.1,-1,fit),.1);
});
test('percentage-sized SVGs keep catalog viewBox geometry instead of browser fallback dimensions',()=>{
 const svg=imageGeometry({url:'/media/wiring.svg',mime:'image/svg+xml',width:1100,height:850},{width:300,height:150});
 assert.equal(svg.width,1100);assert.equal(svg.height,850);assert.equal(svg.vector,true);
 const fit=fitImageScale(svg,{width:1040,height:620});
 assert.equal(fit,588/850);assert.equal(svg.width/svg.height,1100/850);
 assert(nextImageZoom(fit,1,fit,true)>fit);assert.equal(nextImageZoom(4,1,fit,true),6);
 assert(nextImageZoom(10,1,10,true)>10,'a small vector can still zoom beyond an enlarged fit');
});

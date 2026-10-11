import test from 'node:test';import assert from 'node:assert/strict';
import {originalImageUrl,isLargerOriginal,reusableDocument} from '../scripts/upgrade-media-lib.mjs';
test('native image URL removes resizing only on the verified Ford image endpoint',()=>{assert.equal(originalImageUrl('https://www.fordservicecontent.com/images/imagen/imagen2.dll?id=E187756_EUR&w=580&t=JPG'),'https://www.fordservicecontent.com/images/imagen/imagen2.dll?id=E187756_EUR&t=JPG');for(const u of ['https://evil.test/images/imagen/imagen2.dll?id=E1','https://www.fordservicecontent.com:8443/images/imagen/imagen2.dll?id=E1','https://user:password@www.fordservicecontent.com/images/imagen/imagen2.dll?id=E1','javascript:alert(1)','https://www.fordservicecontent.com/images/imagen/imagen2.dll?id='])assert.equal(originalImageUrl(u),null);});
test('upgrades require more real pixels while retaining the original diagram proportions',()=>{assert(isLargerOriginal({width:580,height:381},{width:1902,height:1250}));assert(!isLargerOriginal({width:580,height:381},{width:580,height:381}));assert(!isLargerOriginal({width:580,height:381},{width:1000,height:1000}));assert(!isLargerOriginal({width:580,height:381},{width:400,height:263}));});

test('resume revisits completed documents when their recovered media or mapping is missing',()=>{
 const doc={media:[{url:'/media/source.jpg'}]},urls=new Set(['/media/source.jpg']);
 assert(!reusableDocument(doc,'complete',{assets:{}},urls,()=>true));
 assert(!reusableDocument(doc,'complete',{assets:{'/media/source.jpg':{url:'/media/native.jpg'}}},urls,()=>false));
 assert(reusableDocument(doc,'complete',{assets:{'/media/source.jpg':{url:'/media/native.jpg'}}},urls,()=>true));
 assert(reusableDocument(doc,'complete',{assets:{}},new Set(),()=>false));
 assert(!reusableDocument(doc,'needs-review',{assets:{}},new Set(),()=>true));
});

test('very short thumbnails allow at most one pixel of source resize rounding',()=>{
 assert(isLargerOriginal({width:99,height:16},{width:7301,height:1250}));
 assert(isLargerOriginal({width:99,height:17},{width:8361,height:1500}));
 assert(isLargerOriginal({width:99,height:20},{width:5949,height:1250}));
 assert(!isLargerOriginal({width:99,height:16},{width:5000,height:1250}));
});

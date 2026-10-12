import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiCache,apiCacheLifetime} from './api-cache.mjs';

test('catalog browsing evicts least recently used responses instead of retaining every visited guide',()=>{
 let time=0;const cache=createApiCache({maxEntries:3,ttlMs:100,now:()=>time});
 cache.set('one',{title:'One'});cache.set('two',{title:'Two'});cache.set('three',{title:'Three'});
 assert.deepEqual(cache.get('one'),{title:'One'});cache.set('four',{title:'Four'});
 assert.equal(cache.size,3);assert.equal(cache.get('two'),undefined);assert.deepEqual(cache.get('one'),{title:'One'});
 for(let i=0;i<900;i++)cache.set('guide-'+i,{id:i});
 assert.equal(cache.size,3);assert.equal(cache.get('guide-0'),undefined);assert.equal(cache.get('guide-899').id,899);
});

test('live workshop lists expire without extending their lifetime on a cache hit',()=>{
 let time=0;const cache=createApiCache({now:()=>time});
 cache.set('list',{total:46},apiCacheLifetime('/maintenance?engine=all'));
 cache.set('article',{id:'G1'},apiCacheLifetime('/documents/G1'));
 time=29000;assert.equal(cache.get('list').total,46);
 time=30000;assert.equal(cache.get('list'),undefined);assert.equal(cache.get('article').id,'G1');
 cache.set('list',{total:900},apiCacheLifetime('/maintenance?q=heater'));
 assert.equal(cache.get('list').total,900);
 time=300000;assert.equal(cache.get('article'),undefined);
});

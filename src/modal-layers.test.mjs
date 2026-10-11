import test from 'node:test';
import assert from 'node:assert/strict';
import {createModalLayerManager} from './modal-layers.mjs';
function node(){const attrs=new Map();return {inert:false,getAttribute:key=>attrs.get(key)??null,setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)};}

test('opening an image isolates its glossary dialog and closing restores that dialog',()=>{
 const manager=createModalLayerManager(),root=node(),body={style:{overflow:'auto'}},term=node(),image=node();
 const closeTerm=manager.mount(term,root,body);assert(root.inert);assert.equal(body.style.overflow,'hidden');assert(!term.inert);
 const closeImage=manager.mount(image,root,body);assert(term.inert);assert.equal(term.getAttribute('aria-hidden'),'true');assert(!image.inert);assert.equal(image.getAttribute('aria-hidden'),null);
 closeImage();assert(!term.inert);assert.equal(term.getAttribute('aria-hidden'),null);assert(root.inert);assert.equal(body.style.overflow,'hidden');
 closeTerm();assert(!root.inert);assert.equal(body.style.overflow,'auto');
});
test('out-of-order modal cleanup and repeated cleanup do not unlock an active dialog background',()=>{
 const manager=createModalLayerManager(),root=node(),body={style:{overflow:''}},term=node(),image=node();
 const closeTerm=manager.mount(term,root,body),closeImage=manager.mount(image,root,body);
 closeTerm();closeTerm();assert(root.inert);assert.equal(body.style.overflow,'hidden');assert(!image.inert);
 closeImage();assert(!root.inert);assert.equal(body.style.overflow,'');
 const cleanup=manager.mount(node(),root,body);cleanup();const strictModeCleanup=manager.mount(node(),root,body);assert(root.inert);strictModeCleanup();assert(!root.inert);
});

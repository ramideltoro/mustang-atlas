import test from 'node:test';import assert from 'node:assert/strict';
import {knownFigureNote,figureInstructions,evidenceScopeInstructions} from './figure-policy.mjs';
test('only verified publication assets bypass diagram interpretation',()=>{
 assert.equal(knownFigureNote('unknown-small-technical-diagram'),null);
 assert.match(knownFigureNote('98ed7b7bd3cf82636ea32daadf1443034842813be39008fddf74b2e285a73094').observations[0],/interface icon/);
 assert.match(knownFigureNote('31a239326bf632d91b6e07a78bb33b63b0615a381aa38a2fc5eddf025699dfd9').observations[0],/Preserve.*warning/);
});
test('scope guidance retains mandatory evidence and forbids invented connections',()=>{
 assert.match(figureInstructions,/Never infer a connection from proximity/);
 assert.match(evidenceScopeInstructions,/must prevent publication/);
 assert.match(evidenceScopeInstructions,/not a removal procedure/);
});

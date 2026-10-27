import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {needsOwnerControls,enrollOwnerControls,enrollServicePrerequisites,loadOwnerControls,ownerEvidence,pairExternalAllowed,OWNER_ID,OWNER_PDF,OWNER_TEXT} from './editorial-workshop-owner.mjs';
import {reviewCoverageErrors} from './editorial-workshop-lib.mjs';
test('owner controls select explicit 2015 physical tasks, never bench or unknown year',()=>{
 assert.equal(needsOwnerControls(['G1694275'],[2015]),true);
 assert.equal(needsOwnerControls(['G1661748'],[2015]),false);
 assert.equal(needsOwnerControls(['G1694275'],[2016]),false);
 assert.equal(needsOwnerControls(['G1694275'],[]),false);
});
test('pair external exception rejects unknown sources, headliner, changed hash and missing nodes',()=>{
 assert.equal(pairExternalAllowed({},[]),true);
 for(const ref of [{documentId:'HEADLINER'},{documentId:OWNER_ID,sourceHash:'changed'},{documentId:OWNER_ID,sourceHash:OWNER_PDF,textHash:OWNER_TEXT,physicalPages:[124,125]}])assert.equal(pairExternalAllowed({externalSources:[ref]},[]),false);
});
const root=path.resolve('.'),privateFile=path.join(root,'work/editorial-workshop/evidence/owner-ignition/controls-supplement.json');
test('private complete owner text and both figures retain exact pair coverage',{skip:!fs.existsSync(privateFile)},()=>{
 const d=loadOwnerControls(root),nodes=ownerEvidence(d,['2.3L']);const contract={externalSources:[{documentId:OWNER_ID,sourceHash:OWNER_PDF,textHash:OWNER_TEXT,physicalPages:[124,125]}]};
 assert.equal(pairExternalAllowed(contract,nodes),true);
 assert.equal(pairExternalAllowed(contract,[nodes[0]]),false);
 const changed=structuredClone(nodes);changed[0].text+='changed';assert.equal(pairExternalAllowed(contract,changed),false);
 const partial=structuredClone(nodes);partial[1].images.pop();assert.equal(pairExternalAllowed(contract,partial),false);
 const other={externalSources:[...contract.externalSources,{documentId:'HEADLINER'}]};assert.equal(pairExternalAllowed(other,nodes),false);
 assert.ok(reviewCoverageErrors({coverage:[{nodeId:nodes[0].nodeId,status:'covered'}]},nodes,[]).length);
});

test('owner enrollment does not mass-retry old holds and remains stable for enriched holds',()=>{assert.equal(enrollOwnerControls({status:'needs-review'}),false);assert.equal(enrollOwnerControls({status:'reviewed'}),false);assert.equal(enrollOwnerControls({status:'failed'},true),true);assert.equal(enrollOwnerControls({status:'needs-review',ownerControlsEvidence:true}),true);assert.equal(enrollOwnerControls(undefined),true);});

test('service prerequisite enrollment includes reservations and fallback without mass retry',()=>{for(const p of [undefined,{status:'reserved'},{status:'pair-fallback'},{status:'needs-review',servicePrerequisiteEvidence:true}])assert.equal(enrollServicePrerequisites(p),true);for(const status of ['needs-review','reviewed','failed']){assert.equal(enrollServicePrerequisites({status}),false);assert.equal(enrollServicePrerequisites({status},true),true);}});

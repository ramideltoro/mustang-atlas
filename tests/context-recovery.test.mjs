import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {prepareRecoveryGroups, recoverContextJobs} from '../scripts/recover-context-jobs.mjs';

const write = (filename, value) => fs.writeFileSync(filename, JSON.stringify(value));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-context-recovery-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const jobsDir = path.join(root, 'jobs'), dataDir = path.join(root, 'data'), contentDir = path.join(root, 'content');
  for (const folder of [jobsDir, dataDir, contentDir]) fs.mkdirSync(folder);
  const documents = [
    {id:'GPRIMARY', title:'Ignition Coil', kind:'repair', system_id:'engine', section_code:'303-07A', section_title:'Ignition', engines:'["2.3L"]', source_path:'engine/Removal and Installation/Ignition Coil.html', source_hash:'a'.repeat(64), text:'The ignition coil supplies the spark plug.'},
    {id:'GOVERVIEW', title:'Ignition - Overview', kind:'overview', system_id:'engine', section_code:'303-07A', section_title:'Ignition', engines:'["2.3L"]', source_path:'engine/Description and Operation/Overview.html', source_hash:'b'.repeat(64), text:'The ignition controller coordinates the ignition coil and spark plug.'},
  ].sort((a, b) => a.id.localeCompare(b.id));
  const db = new DatabaseSync(path.join(dataDir, 'atlas.sqlite'));
  db.exec('CREATE TABLE documents (' + Object.keys(documents[0]).map(name => name + ' TEXT').join(',') + ')');
  const insert = db.prepare('INSERT INTO documents VALUES (' + Object.keys(documents[0]).map(() => '?').join(',') + ')');
  for (const document of documents) insert.run(...Object.values(document));
  db.close();
  const glossary = [{id:'ignition-coil', name:'Ignition coil', aliases:[], definition:'The coil creates spark voltage.', details:'It stores energy in a magnetic field.'}];
  write(path.join(contentDir, 'glossary.json'), {terms:glossary});
  write(path.join(contentDir, 'topic-contexts.json'), {untouched:true});
  const groups = [...prepareRecoveryGroups(documents, glossary).values()];
  const plan = groups.map(group => ({id:group.id, documents:group.documents.map(doc => doc.id), fingerprint:group.fingerprint}));
  write(path.join(jobsDir, 'plan.json'), plan);
  const group = groups.find(value => value.documents.some(doc => doc.id === 'GPRIMARY'));
  const batchDir = path.join(jobsDir, 'batch-123-' + group.id); fs.mkdirSync(batchDir);
  const input = structuredClone({topics:[{...group.input, relatedOverviews:group.input.relatedOverviews.map(d => d.documentId)}], relatedOverviewEvidence:group.input.relatedOverviews});
  const topic = {
    id:group.id, title:'How an ignition coil supplies a spark', summary:'An ignition coil changes electrical energy into high voltage for a spark plug. This context connects the coil to its controller and explains the purpose of the circuit drawing.',
    sections:['54501588-energy-to-spark', 'reading', 'purpose'].map(id => ({id, title:'Following the energy path', body:'The controller coordinates the coil with the engine cycle. Electrical energy builds in the coil before its magnetic field collapses and produces the spark voltage. The diagram separates the control connection from the power supply so each circuit has a clear purpose.'})),
    relatedTermIds:['ignition-coil'], sourceDocumentIds:['GPRIMARY'],
  };
  write(path.join(batchDir, 'input.json'), input); write(path.join(batchDir, 'output.json'), {topics:[topic]});
  return {jobsDir, dataDir, contentDir, batchDir, input, topic, group, plan};
}

test('recovery defaults to dry-run then atomically restores only missing checkpoints', t => {
  const f = fixture(t), checkpoint = path.join(f.jobsDir, 'accepted', f.group.id + '.json');
  const preview = recoverContextJobs(f);
  assert.deepEqual(preview.recoverableIds, [f.group.id]); assert.deepEqual(preview.recoveredIds, []); assert.equal(fs.existsSync(checkpoint), false);
  const applied = recoverContextJobs({...f, apply:true});
  assert.deepEqual(applied.recoveredIds, [f.group.id]);
  assert.deepEqual(JSON.parse(fs.readFileSync(checkpoint)), {fingerprint:f.group.fingerprint, topic:f.topic});
  const unchanged = fs.readFileSync(checkpoint, 'utf8');
  assert.deepEqual(recoverContextJobs({...f, apply:true}).recoveredIds, []);
  assert.equal(fs.readFileSync(checkpoint, 'utf8'), unchanged);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.contentDir, 'topic-contexts.json'))), {untouched:true});
});
test('recovery refuses apply while the worker is alive, but permits a read-only preview', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.jobsDir, 'worker.pid'), String(process.pid));
  assert.equal(recoverContextJobs(f).recoverableIds.length, 1);
  assert.throws(() => recoverContextJobs({...f, apply:true}), /worker is alive/);
});
test('recovery rejects changed full-source hashes even when evidence excerpts are identical', t => {
  const f = fixture(t), db = new DatabaseSync(path.join(f.dataDir, 'atlas.sqlite'));
  db.prepare('UPDATE documents SET source_hash=? WHERE id=?').run('c'.repeat(64), 'GPRIMARY'); db.close();
  const result = recoverContextJobs(f);
  assert.ok(result.planMismatches.includes(f.group.id)); assert.deepEqual(result.recoverableIds, []);
});
test('recovery requires exact current batch evidence and own reference whitelist', t => {
  const f = fixture(t);
  f.input.topics[0].documents[0].text += ' Different evidence.';
  write(path.join(f.batchDir, 'input.json'), f.input);
  assert.equal(recoverContextJobs(f).rejected['current-evidence-mismatch'], 1);
  f.input.topics[0].documents[0].text = f.group.input.documents[0].text;
  write(path.join(f.batchDir, 'input.json'), f.input);
  f.topic.sourceDocumentIds.push('GFOREIGN'); write(path.join(f.batchDir, 'output.json'), {topics:[f.topic]});
  assert.equal(recoverContextJobs(f).rejected['invalid-authored-context'], 1);
});
test('recovery skips obsolete group IDs and rejects incomplete or duplicate batch output', t => {
  const f = fixture(t);
  const oldId = 'topic-' + '0'.repeat(16);
  f.input.topics[0].topicId = oldId; f.topic.id = oldId;
  write(path.join(f.batchDir, 'input.json'), f.input); write(path.join(f.batchDir, 'output.json'), {topics:[f.topic]});
  assert.equal(recoverContextJobs(f).rejected['not-in-current-matching-plan'], 1);
  write(path.join(f.batchDir, 'output.json'), {topics:[]});
  assert.equal(recoverContextJobs(f).rejected['unreadable-or-invalid-batch'], 1);
  f.input.topics.push(f.input.topics[0]); write(path.join(f.batchDir, 'input.json'), f.input);
  write(path.join(f.batchDir, 'output.json'), {topics:[f.topic, f.topic]});
  assert.equal(recoverContextJobs(f).rejected['unreadable-or-invalid-batch'], 1);
});

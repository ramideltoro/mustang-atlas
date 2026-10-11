import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeContextTitle, contextGroupKey, contextTopicId, groupContextDocuments} from '../scripts/context-planning.mjs';

const doc = (title, section, phase = 'Description and Operation', extra = {}) => ({
  id: `${section}-${title}`, title, system_id: 'electrical', section_code: section,
  section_title: section, kind: 'overview', source_path: `manual/${section}/${phase}/source.html`, ...extra,
});

test('normalization and topic IDs preserve the existing saved-key format', () => {
  assert.equal(normalizeContextTitle('C226A — STEERING COLUMN CONTROL MODULE'), 'steering column control module');
  assert.equal(normalizeContextTitle('Parking Aid - Overview'), 'parking aid');
  assert.equal(normalizeContextTitle('Parking Aid - Component Location'), 'parking aid');
  assert.equal(normalizeContextTitle('Parking Aid - System Operation'), 'parking aid');
  // This longer suffix affects broad-title selection but remains in the key.
  assert.equal(normalizeContextTitle('Parking Aid - System Operation and Component Description'), 'parking aid - system operation and component description');
  const key = contextGroupKey(doc('Parking Aid - Overview', '413-13A'));
  assert.equal(key, 'electrical|413-13A|Description and Operation|parking aid');
  assert.equal(contextTopicId(key), 'topic-48e40c7c819971e6');
});

test('camera/sensor and conventional/adaptive systems keep separate section contexts', () => {
  for (const [name, sections] of [['Parking Aid', ['413-13A', '413-13B']], ['Cruise Control', ['419-03A', '419-03B']]]) {
    const documents = sections.flatMap(section => ['Overview', 'Component Location'].map(suffix => doc(`${name} - ${suffix}`, section)));
    const groups = [...groupContextDocuments(documents).values()];
    assert.equal(groups.length, 2, name);
    assert.ok(groups.every(group => group.documents.length === 2));
    assert.ok(groups.every(group => new Set(group.documents.map(d => d.section_code)).size === 1));
    const operations = sections.map(section => doc(`${name} - System Operation and Component Description`, section));
    assert.equal(groupContextDocuments(operations).size, 2, `${name} system operation`);
  }
});

test('fluid-level checks and broad transmission/engine operations keep exact variants', () => {
  const checks = ['308-03A', '307-01', '308-03B'].map(section => doc('Transmission Fluid Level Check', section, 'General Procedures', {system_id: 'transmission', kind: 'repair'}));
  assert.equal(groupContextDocuments(checks).size, 3);
  for (const suffix of ['Overview', 'System Operation and Component Description']) {
    const transmissions = ['308-03A', '308-03B'].map(section => doc(`Manual Transmission - ${suffix}`, section, undefined, {system_id: 'transmission'}));
    assert.equal(groupContextDocuments(transmissions).size, 2);
  }
  const engineControls = ['303-14A', '303-14B', '303-14C', '303-14D'].map(section => doc('Electronic Engine Controls - System Operation and Component Description', section, undefined, {system_id: 'engine'}));
  assert.equal(groupContextDocuments(engineControls).size, 4);
});

test('on-car removal and bench disassembly stay separate for every held job family', () => {
  for (const title of ['Front Strut and Spring Assembly', 'Wheel and Tire', 'Cylinder Head', 'Gearshift Lever', 'Front Bumper Cover', 'Rear Bumper Cover', 'Front Bumper Cover - Vehicles With: SVT Performance Package', 'Rear Bumper Cover - Vehicles With: SVT Performance Package']) {
    const phases = ['Removal and Installation', title === 'Cylinder Head' ? 'Disassembly and Assembly of Subassemblies' : 'Disassembly and Assembly'];
    const documents = phases.map(phase => doc(title, 'same-section', phase, {kind: 'repair'}));
    assert.equal(groupContextDocuments(documents).size, 2, title);
  }
  const fallback = doc('Wheel and Tire', '204-04A', undefined, {kind: 'repair', source_path: undefined});
  assert.equal(contextGroupKey(fallback), 'electrical|204-04A|repair|wheel and tire');
});

test('same named physical parts can retain shared purpose while source-only references remain scoped', () => {
  const oilPans = ['303-01A', '303-01C'].map(section => doc('Oil Pan', section, 'Removal and Installation', {system_id: 'engine', kind: 'repair'}));
  const groups = groupContextDocuments(oilPans);
  assert.equal(groups.size, 1);
  const group = [...groups.values()][0];
  assert.equal(group.key, 'engine|oil pan');
  assert.deepEqual(group.documents, oilPans);
  assert.equal(group.documents[0], oilPans[0], 'the evidence/fingerprint receives the original document object');
  const referenceDocs = ['Section A', 'Section B'].map(section => doc('Measuring', section, 'General Procedures', {kind: 'reference'}));
  assert.equal(groupContextDocuments(referenceDocs).size, 2);
});

test('individual connector and wiring sheets never merge by common title', () => {
  for (const kind of ['connector', 'wiring']) {
    const documents = ['A', 'B'].map(id => doc('INLINE CONNECTOR', 'Connector views', undefined, {id, kind}));
    const groups = groupContextDocuments(documents);
    assert.deepEqual([...groups.keys()], ['A', 'B']);
    assert.deepEqual([...groups.values()].map(group => group.id), ['A', 'B'].map(contextTopicId));
  }
});

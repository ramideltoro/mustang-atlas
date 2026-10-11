import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createMaintenanceCatalog, matchesMaintenanceRule } from '../server/maintenance.mjs';

const productionSeed = JSON.parse(fs.readFileSync(new URL('../content/maintenance.json', import.meta.url)));
function fixture(docs, seed = productionSeed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-care-'));
  fs.writeFileSync(path.join(dir, 'maintenance.json'), JSON.stringify(seed));
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE documents(id,title,kind,section_code,section_title,engines,source_hash)');
  const insert = db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?)');
  const recorded = new Map();
  for (const rule of seed.rules) for (const ref of rule.sourceRefs || []) recorded.set(ref.documentId, ref.sourceHash);
  for (const [id, hash] of recorded) if (!docs.some(d => d.id === id)) docs = [...docs, { id, hash, title: 'Evidence record', kind: 'general' }];
  for (const d of docs) insert.run(d.id, d.title, d.kind || 'repair', d.section || '', d.sectionTitle || '', JSON.stringify(d.engines || []), d.hash || recorded.get(d.id) || 'current');
  const catalog = createMaintenanceCatalog(db, { contentDir: dir });
  return { catalog, close() { db.close(); fs.rmSync(dir, { recursive: true }); } };
}

test('front bushing guidance preserves dry installation and the performance-package assembly distinction', () => {
  const f = fixture([{ id: 'G1692534', title: 'Front Stabilizer Bar Bushing', section: '204-01' }]);
  try {
    const result = f.catalog.forDocument('G1692534');
    const care = result.items.find(i => i.id === 'front-stabilizer-bushing-care');
    assert.equal(care.kind, 'condition-based');
    assert.match(care.when, /inspection confirms/);
    assert.ok(care.notes.some(n => /Do not apply lubricant/.test(n)));
    assert.ok(care.notes.some(n => /performance-package.*not replaced separately/.test(n)));
    const inspect = result.items.find(i => i.id === 'suspension-inspection');
    assert.match(inspect.when, /oil-change/);
    assert.deepEqual(inspect.applicability.engines, ['2.3L','3.7L','5.0L']);
    assert.deepEqual(f.catalog.forDocument('G1692534', { engine: '5.2L' }).items.map(i => i.id), ['front-stabilizer-bushing-care']);
    assert.doesNotMatch(JSON.stringify(result), /sourceHash|sourceRefs|5bd7566/);
  } finally { f.close(); }
});

test('rear bushing water-on-bracket exception never becomes a grease instruction', () => {
  const f = fixture([{ id: 'G1686652', title: 'Rear Stabilizer Bar Bushing', section: '204-02' }]);
  try {
    const item = f.catalog.forDocument('G1686652').items.find(i => i.id === 'rear-stabilizer-bushing-care');
    assert.match(item.notes.join(' '), /Water is permitted on the bracket/);
    assert.match(item.notes.join(' '), /not permission to grease/);
    assert.match(item.notes.join(' '), /slits face forward/);
  } finally { f.close(); }
});

test('scheduled maintenance cannot extend to Shelby, wrong engines, or an unverified year', () => {
  const f = fixture([
    { id: 'plug23', title: 'Spark Plugs', section: '303-07A', engines: ['2.3L'] },
    { id: 'plug52', title: 'Spark Plugs', section: '303-07D', engines: ['5.2L'] },
    { id: 'G1676759', title: 'Cabin Air Filter', section: '412-00' },
    { id: 'svt', title: 'Brake Pads - Vehicles With: SVT Performance Package', section: '206-03' }
  ]);
  try {
    assert.ok(f.catalog.forDocument('plug23'));
    assert.equal(f.catalog.forDocument('plug23', { engine: '3.7L' }), null);
    assert.equal(f.catalog.forDocument('plug23', { year: 2016 }), null);
    assert.equal(f.catalog.forDocument('plug52'), null);
    assert.equal(f.catalog.forDocument('svt'), null);
    assert.equal(f.catalog.forDocument('G1676759', { engine: '5.2L' }), null);
    assert.deepEqual(f.catalog.forDocument('G1676759').items[0].applicability.engines, ['2.3L','3.7L','5.0L']);
  } finally { f.close(); }
});

test('belt intervals are not applied to a tensioner, timing chain, sensor or safety belt', () => {
  const f = fixture([
    { id: 'belt', title: 'Accessory Drive Belt', section: '303-05B', engines: ['3.7L'] },
    { id: 'tensioner', title: 'Accessory Drive Belt Tensioner', section: '303-05B', engines: ['3.7L'] },
    { id: 'chain', title: 'Timing Chain', section: '303-01B', engines: ['3.7L'] },
    { id: 'sensor', title: 'Engine Coolant Temperature (ECT) Sensor', section: '303-14A', engines: ['2.3L'] },
    { id: 'seat', title: 'Front Seatbelt Retractor and Pretensioner', section: '501-20A' }
  ]);
  try {
    assert.deepEqual(f.catalog.forDocument('belt').items.map(i => i.id), ['belt-schedule']);
    assert.equal(f.catalog.forDocument('tensioner'), null);
    assert.equal(f.catalog.forDocument('chain'), null);
    assert.equal(f.catalog.forDocument('sensor'), null);
    assert.ok(f.catalog.forDocument('seat').items.every(i => i.id !== 'belt-schedule'));
  } finally { f.close(); }
});

test('automatic, MT82 and 3160 gearbox scopes stay separate', () => {
  const f = fixture([
    { id: 'auto', title: 'Transmission Fluid Level Check', section: '307-01', sectionTitle: 'Automatic Transmission - 6R80' },
    { id: 'mt82', title: 'Transmission Fluid Level Check', section: '308-03A', sectionTitle: 'Manual Transmission - MT82' },
    { id: 'tr3160', title: 'Transmission Fluid Level Check', section: '308-03B', sectionTitle: 'Manual Transmission - 3160' },
    { id: 'clutch', title: 'Forward Clutch Assembly', section: '307-01', sectionTitle: 'Automatic Transmission - 6R80' }
  ]);
  try {
    assert.equal(f.catalog.forDocument('auto').items[0].id, 'automatic-fluid');
    assert.equal(f.catalog.forDocument('mt82').items[0].id, 'manual-fluid');
    assert.equal(f.catalog.forDocument('tr3160'), null);
    assert.equal(f.catalog.forDocument('clutch'), null);
    assert.equal(f.catalog.forDocument('auto', { engine: '5.2L' }), null);
  } finally { f.close(); }
});

test('kind, section and component title must all match, never words in body text', () => {
  const rule = productionSeed.rules.find(r => r.id === 'spark-plug-service');
  assert.ok(matchesMaintenanceRule(rule, { id: 'G1', title: 'Spark Plugs', section_code: '303-07A', kind: 'repair' }));
  for (const doc of [
    { title: 'Spark Plugs', section_code: '303-07A', kind: 'connector' },
    { title: 'Spark Plugs', section_code: '999-00', kind: 'repair' },
    { title: 'Ignition Coil', section_code: '303-07A', kind: 'repair', text: 'Replace spark plugs' },
    { title: 'Spark Plugs - Shelby', section_code: '303-07A', kind: 'repair' }
  ]) assert.equal(matchesMaintenanceRule(rule, doc), false);
});

test('stale mechanical evidence suppresses the dependent rule without suppressing the current owner schedule', () => {
  const f = fixture([{ id: 'G1692534', title: 'Front Stabilizer Bar Bushing', section: '204-01', hash: 'changed' }]);
  try {
    assert.deepEqual(f.catalog.forDocument('G1692534').items.map(i => i.id), ['suspension-inspection']);
    assert.ok(f.catalog.report().errors.some(e => e.ruleId === 'front-stabilizer-bushing-care'));
  } finally { f.close(); }
});

test('missing guidance stays absent and public reporting excludes the hidden introduction', () => {
  const f = fixture([{ id: 'intro', title: 'About this Manual', kind: 'overview' }, { id: 'ecu', title: 'Powertrain Control Module', section: '303-14B' }], { rules: [], evidence: {} });
  try {
    assert.equal(f.catalog.forDocument('intro'), null);
    assert.equal(f.catalog.forDocument('ecu'), null);
    assert.equal(f.catalog.forDocument('missing'), null);
    assert.equal(f.catalog.report().documents, 1);
    assert.throws(() => f.catalog.forDocument('ecu', { year: 'garbage' }), /year/);
    assert.throws(() => f.catalog.forDocument('ecu', { engine: 'V12' }), /engine/);
  } finally { f.close(); }
});

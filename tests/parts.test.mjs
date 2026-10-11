import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createPartsCatalog, extractPartReferences } from '../server/parts.mjs';

const table = rows => ({ type: 'table', rows: rows.map(row => ({ cells: row.map(text => ({ text, blocks: [] })) })) });
const media = id => ({ id, url: `/media/${id}.jpg`, mime: 'image/jpeg', width: 650, height: 650 });
function fixture(docs, seed = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-parts-'));
  fs.writeFileSync(path.join(dir, 'parts-catalog.json'), JSON.stringify(seed));
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE documents(id,title,kind,section_code,section_title,engines,source_hash,blocks,media)');
  const statement = db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?,?,?,?)');
  for (const d of docs) statement.run(d.id, d.title, d.kind || 'repair', d.sectionCode || '303-01', d.sectionTitle || 'Engine', JSON.stringify(d.engines || ['3.7L']), d.hash || d.id + '-hash', JSON.stringify(d.blocks || []), JSON.stringify(d.media || []));
  return { catalog: createPartsCatalog(db, { contentDir: dir }), close() { db.close(); fs.rmSync(dir, { recursive: true }); } };
}
const part = (id, engines, years, extra = {}) => ({ id, name: 'Oil filter', number: id, fitment: { years, engines, market: 'US/Canada' }, matches: { titles: ['Oil Filter'] }, evidence: ['ford'], officialUrl: 'https://www.ford.com/parts/', ...extra });
const evidence = { ford: { url: 'https://www.fordservicecontent.com/verified-table' } };

test('labeled identifiers remain distinct from verified ordering numbers and callout numbers', () => {
  const d = { id: 'G1', blocks: [
    { type: 'heading', text: 'Special Tool(s) / General Equipment' },
    table([['303-335 (T88T-6701-A) Installer TKIT-1988-FLM', '']]),
    { type: 'heading', text: 'Materials' }, table([['Name', 'Specification'], ['Motorcraft Silicone Gasket and Sealant TA-30', 'WSE-M4G323-A4']]),
    { type: 'heading', text: 'Components' }, { type: 'media', mediaId: 'G1-m1' },
    table([['Item', 'Part Number', 'Description'], ['14', '6700', 'Crankshaft front oil seal'], ['15', '—', 'Bolt']]),
    table([['Fpn', 'Harness Id'], ['9U5T-14489-JA', '14401']]),
    table([['Base Part Number', 'part# N/A']])
  ] };
  const { identifiers } = extractPartReferences(d);
  assert.ok(identifiers.every(i => i.orderable === false));
  assert.equal(identifiers.find(i => i.number === '303-335').kind, 'special-tool');
  assert.equal(identifiers.find(i => i.number === 'T88T-6701-A').kind, 'special-tool');
  assert.equal(identifiers.find(i => i.number === 'TA-30').kind, 'material');
  assert.equal(identifiers.find(i => i.number === '9U5T-14489-JA').kind, 'engineering-or-service-unverified');
  assert.equal(identifiers.find(i => i.number === '6700').callout, '14');
  assert.equal(identifiers.find(i => i.number === '6700').mediaId, 'G1-m1');
  assert.ok(!identifiers.some(i => ['14', '15', '—', 'N/A'].includes(i.number)));
});

test('year and engine filters cannot promote a different variant or unpublished year', () => {
  const f = fixture([{ id: 'G1', title: 'Oil Filter', engines: ['3.7L'] }], { evidence, parts: [part('FL500S', ['3.7L', '5.0L'], [2015, 2016]), part('FL910S', ['2.3L'], [2015, 2016])] });
  try {
    assert.deepEqual(f.catalog.forDocument('G1').parts.map(p => p.number), ['FL500S']);
    assert.equal(f.catalog.forDocument('G1', { year: 2017 }).parts.length, 0);
    assert.equal(f.catalog.forDocument('G1', { engine: '2.3L' }).parts.length, 0);
    assert.equal(f.catalog.forDocument('missing'), null);
    assert.ok(!JSON.stringify(f.catalog.forDocument('G1')).includes('verified-table'));
  } finally { f.close(); }
});

test('tool pictures are excluded and only inspected current images receive exploded labels', () => {
  const f = fixture([{ id: 'G1', title: 'Seal', blocks: [
    { type: 'heading', text: 'Special Tool(s) / General Equipment' }, { type: 'media', mediaId: 'tool' },
    { type: 'heading', text: 'Removal' }, { type: 'media', mediaId: 'seal' }
  ], media: [media('tool'), media('seal')] }], { diagramReviews: [{ mediaId: 'seal', documentId: 'G1', sourceHash: 'old-hash', kind: 'exploded-view', title: 'Old diagram' }] });
  try {
    const result = f.catalog.forDocument('G1');
    assert.deepEqual(result.diagrams.map(d => d.id), ['seal']);
    assert.equal(result.diagrams[0].explodedVerified, false);
    assert.equal(result.diagrams[0].kind, 'procedure-illustration');
  } finally { f.close(); }
});

test('related assembly lookup matches the component and exact engine section, never generic nearby media', () => {
  const blocks = [{ type: 'media', mediaId: 'assembly' }, table([['Item', 'Part Number', 'Description'], ['14', '6700', 'Crankshaft front oil seal']])];
  const f = fixture([
    { id: 'G1', title: 'Crankshaft Front Seal' },
    { id: 'G2', title: 'Engine Component View', kind: 'overview', blocks, media: [media('assembly')] },
    { id: 'G3', title: 'Engine Component View', kind: 'overview', engines: ['5.0L'], blocks: [{ type: 'media', mediaId: 'wrong-engine' }, blocks[1]], media: [media('wrong-engine')] },
    { id: 'G4', title: 'Spark Plugs' }
  ], { diagramReviews: [{ mediaId: 'assembly', documentId: 'G2', sourceHash: 'G2-hash', kind: 'exploded-view', title: '3.7L assembly' }] });
  try {
    const result = f.catalog.forDocument('G1');
    assert.deepEqual(result.diagrams.map(d => d.id), ['assembly']);
    assert.equal(result.diagrams[0].explodedVerified, true);
    assert.equal(result.identifiers[0].number, '6700');
    assert.equal(f.catalog.forDocument('G4').diagrams.length, 0);
  } finally { f.close(); }
});

test('a connector marking remains unverified and its face is never an exploded assembly', () => {
  const f = fixture([{ id: 'C226A', title: 'C226A', kind: 'connector', engines: [], blocks: [table([['Fpn', 'Harness Id'], ['9U5T-14489-JA', '14401']]), { type: 'media', mediaId: 'face' }], media: [media('face')] }]);
  try {
    const result = f.catalog.forDocument('C226A');
    assert.equal(result.parts.length, 0);
    assert.equal(result.identifiers[0].orderable, false);
    assert.equal(result.diagrams[0].kind, 'connector-view');
    assert.equal(result.diagrams[0].explodedVerified, false);
  } finally { f.close(); }
});

test('unproven service catalog entries fail closed without empty-part or generic lookup prompts', () => {
  const f = fixture([{ id: 'G1', title: 'Oil Filter' }], { parts: [part('FAKE', ['3.7L'], [2015])] });
  try {
    assert.equal(f.catalog.forDocument('G1').parts.length, 0);
    assert.deepEqual(f.catalog.forDocument('G1').catalogLinks, []);
    assert.equal(f.catalog.forDocument('G1').availability, 'unavailable');
    assert.equal(f.catalog.forDocument('G1').fitmentNote, null);
    assert.equal(f.catalog.report().errors.length, 1);
  } finally { f.close(); }
});

test('parts panel stays bounded, prioritizes reviewed assemblies, and preserves Manual Transmission wording', () => {
  const images = Array.from({ length: 9 }, (_, n) => media('picture-' + n));
  const f = fixture([{ id: 'G1', title: 'Manual Transmission', media: images, blocks: images.map(m => ({ type: 'media', mediaId: m.id })) }], { diagramReviews: [{ documentId: 'G1', mediaId: 'picture-8', sourceHash: 'G1-hash', kind: 'exploded-view', title: 'Manual Transmission exploded components' }] });
  try {
    const result = f.catalog.forDocument('G1');
    assert.equal(result.diagrams.length, 3);
    assert.equal(result.diagrams[0].id, 'picture-8');
    assert.match(result.diagrams[0].title, /^Manual Transmission/);
    assert.equal(f.catalog.forDocument('G1', { engine: '5.0L' }).diagrams.length, 0);
  } finally { f.close(); }
});

test('exact connector binding verifies a pigtail without inventing engine/year fitment and fails on stale evidence', () => {
  const docs = [{ id: 'C226A', title: 'SCCM connector', kind: 'connector', engines: [], blocks: [table([['Service Part'], ['9U2Z-14S411-DA']])] }];
  const entry = { id: 'wpt930', number: 'WPT930', name: 'Connector repair pigtail', additionalNumbers: [{ brand: 'Ford', number: '9U2Z-14S411-DA' }], fitment: { years: [], engines: [], application: 'connector', notes: 'Connector wiring, not the SCCM.' }, fitmentStatus: 'vehicle-confirmation-required', matches: { documentIds: ['C226A'] }, documentBindings: [{ documentId: 'C226A', sourceHash: 'C226A-hash' }], evidence: ['ford'], officialUrl: 'https://www.ford.com/product/connector' };
  const f = fixture(docs, { evidence, parts: [entry] });
  try {
    const result = f.catalog.forDocument('C226A');
    assert.equal(result.parts[0].number, 'WPT930');
    assert.deepEqual(result.parts[0].fitment.engines, []);
    assert.equal(result.parts[0].fitmentStatus, 'vehicle-confirmation-required');
    assert.equal(result.identifiers.length, 0);
    assert.ok(!JSON.stringify(result).includes('C226A-hash'));
  } finally { f.close(); }
  const stale = fixture([{ ...docs[0], hash: 'new-hash' }], { evidence, parts: [entry] });
  try { assert.equal(stale.catalog.forDocument('C226A').parts.length, 0); } finally { stale.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { connectorTerminals, createCircuitContextCatalog, parseCircuitSvg } from '../server/circuit-context.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const table = data => ({ type: 'table', rows: data.map(row => ({ cells: row.map(text => ({ text, blocks: [] })) })) });
const terminals = data => [table([['Cavity', 'Circuit Number', 'Function', 'Color', 'Qualifier'], ...data])];
const svg = `<svg xmlns="http://www.w3.org/2000/svg">
  <g id="HEADER"><text>2.3L</text></g>
  <g id="COMP_DEVICE~DATA~Shutter actuator"><g id="CONN_C1651_2"><text>2</text></g><g id="CONN_C1651_3"><text>3</text></g></g>
  <g id="CIRC_VDN06B"><text>VDN06</text><text>WH-GN</text></g>
  <g id="CIRC_VDN06C"><text>VDN06</text><text>WH</text></g>
  <g id="CIRC_CBK03"><text>CBK03</text><text>GY</text></g>
  <g id="CUTWIRE_A"><g id="PAGEREF_33-1"><text>33-1</text></g></g>
  <g id="GROUND_G104"><g id="PAGEREF_10-3"><text>10-3</text></g></g>
  <g id="PAGEREF_151-1"><text>151-1</text></g>
  <g id="SPLICE_S128"><text>S128</text></g>
</svg>`;

function fixture({ drawing = svg, seed = { circuits: [] }, missing = false, extraDocs = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-circuit-'));
  fs.mkdirSync(path.join(dir, 'media'));
  if (!missing) fs.writeFileSync(path.join(dir, 'media', 'diagram.svg'), drawing);
  fs.writeFileSync(path.join(dir, 'circuit-contexts.json'), JSON.stringify(seed));
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE documents(id,title,kind,source_hash,blocks,media)');
  const insert = db.prepare('INSERT INTO documents VALUES(?,?,?,?,?,?)');
  const docs = [
    { id: 'wiring-033-002', kind: 'wiring', media: [{ url: '/media/diagram.svg', mime: 'image/svg+xml' }] },
    { id: 'wiring-033-001', kind: 'wiring' }, { id: 'wiring-010-003', kind: 'wiring' }, { id: 'wiring-151-001', kind: 'wiring' },
    { id: 'connector-C1651', kind: 'connector', blocks: terminals([
      ['2', 'VDN06', 'LIN BUS # PCM1', 'WH-GN', '2.3L'],
      ['3', 'CBK03', 'FUSE - 42 OR CIRCUIT BREAKER', 'GY', '2.3L'],
      ['4', 'VDN06', 'LIN BUS alternative cavity', 'WH', 'Other equipment'],
      ['3', 'ABC44', 'Unrelated equipment circuit', 'RD', 'Other equipment']
    ]) },
    { id: 'overview', kind: 'overview' }, ...extraDocs
  ];
  for (const d of docs) insert.run(d.id, d.title || d.id, d.kind, d.hash || `${d.id}-hash`, JSON.stringify(d.blocks || []), JSON.stringify(d.media || []));
  const catalog = createCircuitContextCatalog(db, { contentDir: dir, dataDir: dir, learningContexts: { get(id) { return { summary: `Helpful context for ${id}.` }; } } });
  return { catalog, close() { db.close(); fs.rmSync(dir, { recursive: true }); } };
}

test('visible circuit labels, not SVG instance suffixes, identify the circuit', () => {
  const parsed = parseCircuitSvg(svg);
  assert.deepEqual(parsed.circuits.map(c => c.id), ['VDN06', 'VDN06', 'CBK03']);
  assert.deepEqual(parsed.components[0].connectorIds, ['C1651']);
  assert.deepEqual(parsed.qualifiers, ['2.3L']);
  assert.deepEqual(parsed.grounds, ['G104']);
  assert.deepEqual(parsed.splices, ['S128']);
});

test('only drawn cavities with a printed matching circuit are joined, retaining variant qualifiers', () => {
  const f = fixture();
  try {
    const value = f.catalog.forDocument('wiring-033-002');
    assert.equal(value.circuits.length, 2);
    const lin = value.circuits.find(c => c.id === 'VDN06');
    assert.deepEqual(lin.wireColors.map(c => c.code), ['WH-GN', 'WH']);
    assert.deepEqual(lin.terminals.map(t => [t.pin, t.qualifier]), [['2', '2.3L']]);
    assert.equal(lin.category, 'communication');
    assert.equal(value.circuits.find(c => c.id === 'CBK03').category, 'power');
    assert.equal(value.coverage.terminalReferenceCount, 2);
    assert.deepEqual(value.connections, []);
    assert.equal(value.coverage.topologyVerified, false);
    assert.deepEqual(value.components[0].documentIds, ['connector-C1651']);
  } finally { f.close(); }
});

test('continuation markers differ from ground and location references', () => {
  const f = fixture();
  try {
    const refs = f.catalog.forDocument('wiring-033-002').continuations;
    assert.deepEqual(refs.map(r => [r.documentId, r.kind]), [
      ['wiring-033-001', 'circuit-continuation'], ['wiring-010-003', 'ground-reference'], ['wiring-151-001', 'component-reference']
    ]);
    assert.match(refs[0].description, /continuation A/);
  } finally { f.close(); }
});

test('unlabeled and multi-circuit SVG groups never invent circuit IDs or color associations', () => {
  const parsed = parseCircuitSvg('<svg><g id="CIRC_NULL01"><text>USB CABLE</text><text>BK</text></g><g id="CIRC_RET33A"><text>RET33</text><text>VET33</text><text>YE</text><text>BK</text></g></svg>');
  assert.equal(parsed.circuits[0].label, 'USB CABLE');
  assert.equal(parsed.circuits[0].unnumbered, true);
  assert.ok(!parsed.circuits.some(c => c.id.startsWith('NULL')));
  assert.deepEqual(parsed.circuits.slice(1).map(c => [c.id, c.wireColors]), [['RET33', []], ['VET33', []]]);
});

test('connector table parser excludes unassigned cavities without losing duplicate qualified assignments', () => {
  const found = connectorTerminals(terminals([
    ['1', 'GD120', 'GROUND', 'BK-GN', 'Coupe'], ['1', 'GD120', 'GROUND', 'BK-GN', 'Convertible'], ['2', '-', 'Not used', '-', '']
  ]));
  assert.equal(found.length, 2);
  assert.deepEqual(found.map(v => v.qualifier), ['Coupe', 'Convertible']);
});

test('curated topology requires the current document, SVG and every supporting source hash', () => {
  const record = { documentId: 'wiring-033-002', sourceHash: 'wiring-033-002-hash', svgHash: sha(svg), sourceRefs: [{ documentId: 'overview', sourceHash: 'overview-hash' }], mode: 'curated', title: 'Verified paths', connections: [{ from: 'PCM', to: 'Actuator', circuit: 'VDN06', description: 'LIN communication', via: [] }] };
  for (const variation of [{}, { sourceHash: 'old' }, { svgHash: 'old' }, { sourceRefs: [{ documentId: 'overview', sourceHash: 'old' }] }]) {
    const f = fixture({ seed: { circuits: [{ ...record, ...variation }] } });
    try {
      const value = f.catalog.forDocument(record.documentId), valid = !Object.keys(variation).length;
      assert.equal(value.coverage.topologyVerified, valid);
      assert.equal(value.connections.length, valid ? 1 : 0);
      assert.equal('sourceHash' in value, false);
      assert.equal('sourceRefs' in value, false);
      assert.equal('svgHash' in value, false);
      assert.equal(f.catalog.report().errors.length, valid ? 0 : 1);
    } finally { f.close(); }
  }
});

test('missing vectors and reference-only sheets never claim verified wiring topology', () => {
  const f = fixture({ missing: true });
  try {
    const value = f.catalog.forDocument('wiring-033-002');
    assert.equal(value.mode, 'reference-map');
    assert.deepEqual(value.connections, []);
    assert.equal(f.catalog.report().errors[0].reason, 'vector-unavailable');
    assert.equal(f.catalog.forDocument('overview'), null);
    assert.equal(f.catalog.forDocument('missing'), null);
  } finally { f.close(); }
});

test('returning a cached result cannot let a caller modify later responses', () => {
  const f = fixture();
  try {
    f.catalog.forDocument('wiring-033-002').circuits[0].terminals.length = 0;
    assert.equal(f.catalog.forDocument('wiring-033-002').circuits[0].terminals.length, 1);
  } finally { f.close(); }
});

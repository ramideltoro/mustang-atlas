import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { createLearningContextCatalog } from './learning-context.mjs';

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const json = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || []; } catch { return []; } };
const colors = { BK: 'black', BN: 'brown', BU: 'blue', GN: 'green', GY: 'gray', OG: 'orange', PK: 'pink', RD: 'red', SR: 'silver', TN: 'tan', VT: 'violet', WH: 'white', YE: 'yellow', LG: 'light green', LB: 'light blue' };
function colorName(code) { return code.split('-').map(c => colors[c] || c).join(' / '); }
function pageId(reference) { const m = /^(\d{1,3})-(\d{1,3})$/.exec(reference); return m ? `wiring-${m[1].padStart(3, '0')}-${m[2].padStart(3, '0')}` : null; }
function rows(blocks) { return (blocks || []).flatMap(b => [ ...(b.type === 'table' ? [b.rows.map(r => r.cells.map(c => clean(c.text)))] : []), ...rows(b.children), ...rows(b.items), ...(b.rows || []).flatMap(r => r.cells.flatMap(c => rows(c.blocks))) ]); }

export function connectorTerminals(blocks) {
  const terminals = [];
  for (const table of rows(blocks)) {
    const h = table[0]?.map(v => v.toLowerCase()) || [];
    const pin = h.indexOf('cavity'), circuit = h.indexOf('circuit number'), fn = h.indexOf('function'), color = h.indexOf('color'), qualifier = h.indexOf('qualifier');
    if ([pin, circuit, fn].some(i => i < 0)) continue;
    for (const row of table.slice(1)) {
      if (!/^[A-Z0-9]+$/.test(row[pin] || '') || !/^[A-Z][A-Z0-9]+$/.test(row[circuit] || '')) continue;
      terminals.push({ pin: row[pin], circuit: row[circuit], function: row[fn], color: row[color] || '', qualifier: row[qualifier] || '' });
    }
  }
  return terminals;
}

// These are semantic IDs from the original vector drawing, not OCR guesses or
// geometric inference. Matching IDs do not establish wire routing or current flow.
export function parseCircuitSvg(svg) {
  const $ = load(svg, { xmlMode: true });
  const result = { circuits: [], pins: [], components: [], references: [], grounds: [], splices: [], qualifiers: [] };
  const seen = new Set();
  let unnumbered = 0;
  for (const e of $('[id]').toArray()) {
    const node = $(e), id = node.attr('id') || '';
    if (id.startsWith('CIRC_')) {
      const labels = node.find('text').map((_, t) => clean($(t).text())).get();
      // Group IDs often append an instance suffix (GD215B) absent from the
      // actual circuit label (GD215). Use only visible labels for matching.
      const circuits = [...new Set(labels.filter(t => /^[A-Z]{1,6}\d+[A-Z0-9]*$/.test(t)))];
      const wireColors = [...new Set(labels.filter(t => /^(?:[A-Z]{2})(?:-[A-Z]{2})?$/.test(t) && t.split('-').every(c => colors[c])))];
      for (const circuit of circuits) result.circuits.push({ id: circuit, label: circuit, wireColors: circuits.length === 1 ? wireColors.map(code => ({ code, name: colorName(code) })) : [] });
      if (!circuits.length) result.circuits.push({ id: `unnumbered-${++unnumbered}`, label: labels.find(t => /CABLE|WIRE/i.test(t)) || 'Unnumbered conductor', wireColors: wireColors.map(code => ({ code, name: colorName(code) })), unnumbered: true });
    }
    const pin = /^CONN_(C\d+[A-Z]*)_([A-Z0-9]+)$/.exec(id);
    if (pin) {
      const key = pin[1] + ':' + pin[2];
      if (!seen.has(key)) { seen.add(key); result.pins.push({ connectorId: pin[1], pin: pin[2] }); }
    }
    if (id.startsWith('COMP_')) {
      const fields = id.slice(5).split('~');
      const connectorIds = [...new Set(node.find('[id^="CONN_"]').map((_, c) => /^CONN_(C\d+[A-Z]*)_/.exec($(c).attr('id'))?.[1]).get().filter(Boolean))];
      result.components.push({ id: fields[0], label: clean(fields.slice(2).join('~') || fields[0]), connectorIds });
    }
    if (id.startsWith('PAGEREF_')) {
      const reference = id.slice(8), ancestor = node.parents('[id^="CUTWIRE_"]').first().attr('id');
      const ground = node.parents('[id^="GROUND_"]').first().attr('id');
      const kind = ancestor ? 'circuit-continuation' : ground ? 'ground-reference' : 'component-reference';
      const key = `${reference}:${ancestor || ground || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.references.push({ reference, documentId: pageId(reference), kind, label: ancestor?.split('_').at(-1) || null });
      }
    }
    if (id.startsWith('GROUND_')) result.grounds.push(id.slice(7).split('~')[0]);
    if (id.startsWith('SPLICE_')) result.splices.push(id.slice(7).split('~')[0]);
    if (/^(?:HEADER|Header)$/.test(id)) {
      const value = clean(node.text()); if (value && !result.qualifiers.includes(value)) result.qualifiers.push(value);
    }
  }
  result.grounds = [...new Set(result.grounds)]; result.splices = [...new Set(result.splices)];
  return result;
}

function categoryFor(terminals) {
  const functions = terminals.map(t => t.function).join(' ');
  if (/\bLIN BUS\b|\bCAN BUS\b|\bCAN (?:HIGH|LOW)\b/i.test(functions)) return 'communication';
  if (terminals.length && terminals.every(t => /^GROUND\b/i.test(t.function))) return 'ground';
  if (/\bFUSE\b|\bCIRCUIT BREAKER\b|\bRELAY - POWER\b/i.test(functions)) return 'power';
  if (/\bAIR ?BAG\b|\bPRETENSIONER\b|\bIMPACT.+SENSOR\b|\bRESTRAINTS?\b/i.test(functions)) return 'restraint';
  if (/\bSIGNAL RETURN\b|\bVOLTAGE REF/i.test(functions)) return 'sensor-reference';
  return 'component-circuit';
}

export function createCircuitContextCatalog(db, { contentDir = path.resolve('content'), dataDir = path.resolve('data'), learningContexts } = {}) {
  const documents = new Map(db.prepare("SELECT id,title,kind,source_hash,CASE WHEN kind='connector' THEN blocks ELSE '[]' END AS blocks,CASE WHEN kind='wiring' THEN media ELSE '[]' END AS media FROM documents").all().map(d => [d.id, d]));
  const contexts = learningContexts || createLearningContextCatalog(db, { contentDir });
  let seed = { circuits: [] };
  try { seed = JSON.parse(fs.readFileSync(path.join(contentDir, 'circuit-contexts.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const authored = new Map((seed.circuits || []).map(c => [c.documentId, c]));
  const pinTables = new Map();
  const cache = new Map(), errors = [];
  function forDocument(id) {
    const doc = documents.get(id); if (!doc || doc.kind !== 'wiring') return null;
    if (cache.has(id)) return structuredClone(cache.get(id));
    const media = json(doc.media).find(m => m.mime === 'image/svg+xml');
    let svg = '', parsed = { circuits: [], pins: [], components: [], references: [], grounds: [], splices: [], qualifiers: [] };
    if (media?.url?.startsWith('/media/') && !media.url.includes('..')) {
      try { svg = fs.readFileSync(path.join(dataDir, media.url.slice(1)), 'utf8'); parsed = parseCircuitSvg(svg); }
      catch { errors.push({ documentId: id, reason: 'vector-unavailable' }); }
    }
    const map = new Map();
    for (const circuit of parsed.circuits) {
      if (!map.has(circuit.id)) map.set(circuit.id, { ...circuit, terminals: [] });
      else {
        const saved = map.get(circuit.id);
        for (const color of circuit.wireColors) if (!saved.wireColors.some(c => c.code === color.code)) saved.wireColors.push(color);
      }
    }
    let unmatchedPins = 0;
    for (const pin of parsed.pins) {
      const connectorDocumentId = `connector-${pin.connectorId}`, connector = documents.get(connectorDocumentId);
      if (!connector) { unmatchedPins++; continue; }
      if (!pinTables.has(connectorDocumentId)) pinTables.set(connectorDocumentId, connectorTerminals(json(connector.blocks)));
      const matches = pinTables.get(connectorDocumentId).filter(t => t.pin === pin.pin && map.has(t.circuit));
      if (!matches.length) unmatchedPins++;
      for (const terminal of matches) {
        const target = map.get(terminal.circuit);
        const value = { connectorId: pin.connectorId, documentId: connectorDocumentId, pin: terminal.pin, function: terminal.function, qualifier: terminal.qualifier, color: terminal.color };
        if (!target.terminals.some(t => JSON.stringify(t) === JSON.stringify(value))) target.terminals.push(value);
      }
    }
    const circuits = [...map.values()].map(c => {
      const category = categoryFor(c.terminals);
      return { ...c, category, explanation: c.terminals.length ? '' : c.unnumbered ? 'This conductor has no printed circuit number. Follow its routing in the drawing.' : 'This circuit is labeled in the drawing; no matching connector terminal record is available here.' };
    });
    const components = parsed.components.map(component => {
      const documentIds = component.connectorIds.map(c => documents.has(`connector-${c}`) ? `connector-${c}` : null);
      const description = documentIds.map(d => d && contexts.get(d)?.summary).find(Boolean);
      return { ...component, documentIds, role: description || '' };
    });
    const continuations = parsed.references.filter(r => r.documentId && documents.has(r.documentId) && r.documentId !== id).map(r => ({
      reference: r.reference, documentId: r.documentId, title: documents.get(r.documentId).title,
      kind: r.kind,
      description: r.kind === 'circuit-continuation' ? `Follow continuation ${r.label || ''} to this drawing.` : r.kind === 'ground-reference' ? 'Ground-distribution reference.' : 'Related component or location reference; this marker is not a wire connection.'
    }));
    const learning = contexts.get(id);
    const readingGuide = parsed.circuits.length ? [
      'Start with a component and its connector name, then match the cavity number to the circuit ID. Wire colors help identify a conductor; the circuit ID distinguishes wires that share a color.',
      'The terminal list includes only cavities drawn on this sheet and matching circuit IDs. Equipment alternatives can share a connector or circuit name; keep each printed branch qualifier with its branch.'
    ] : ['Use the component names, connector identifiers and location markers to find the matching electrical drawing. A location illustration does not establish electrical connections.'];
    if (parsed.grounds.length) readingGuide.push(`Ground points shown: ${parsed.grounds.join(', ')}. A labeled ground point is distinct from a sensor return or a communication wire.`);
    if (parsed.splices.length) readingGuide.push(`Splices shown: ${parsed.splices.join(', ')}. A splice marker identifies an electrical junction; crossing lines alone do not establish one.`);
    if (circuits.some(c => c.category === 'restraint')) readingGuide.push('Restraint deployment and impact-sensor circuits require the dedicated restraint diagnostic procedure. Connector labels are not instructions for direct probing or applying power.');
    let result = {
      documentId: id, title: 'How this circuit is connected', summary: learning?.summary || `${doc.title} identifies the electrical components and labeled circuits shown below.`,
      mode: parsed.circuits.length ? 'terminal-map' : 'reference-map',
      scope: parsed.qualifiers.length ? `Drawing header: ${parsed.qualifiers.join(' · ')}. Additional qualifications beside branches apply to those branches.` : 'Read equipment and engine qualifications beside their branches before matching the vehicle.',
      components, circuits, connections: [], continuations, readingGuide,
      coverage: { circuitCount: circuits.length, terminalReferenceCount: circuits.reduce((n, c) => n + c.terminals.length, 0), unmatchedPinCount: unmatchedPins, topologyVerified: false, method: 'Vector circuit and cavity labels matched to connector assignments; wire routing and current direction are not inferred.' }
    };
    const curated = authored.get(id);
    if (curated) {
      const valid = curated.sourceHash === doc.source_hash && curated.svgHash === createHash('sha256').update(svg).digest('hex') && curated.sourceRefs?.every(ref => documents.get(ref.documentId)?.source_hash === ref.sourceHash);
      if (valid) {
        const { sourceHash, svgHash, sourceRefs, ...publicContent } = curated;
        result = { ...result, ...publicContent, coverage: { ...result.coverage, topologyVerified: true, method: 'Connections visually checked against the drawing and its named continuation pages.' } };
      } else errors.push({ documentId: id, reason: 'stale-curated-evidence' });
    }
    cache.set(id, result); return structuredClone(result);
  }
  return { forDocument, report: () => ({ wiringDocuments: [...documents.values()].filter(d => d.kind === 'wiring').length, loadedDocuments: cache.size, curatedDocuments: authored.size, errors: structuredClone(errors) }) };
}

import fs from 'node:fs';
import path from 'node:path';

const CATALOG_URL = 'https://www.ford.com/parts/';
const parse = (value, fallback = []) => { try { return typeof value === 'string' ? JSON.parse(value) : value ?? fallback; } catch { return fallback; } };
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const norm = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const baseNumber = value => /^[0-9][A-Z0-9]{2,7}$/.test(value);
const fullNumber = value => /^[A-Z0-9]{4}-[A-Z0-9]{3,8}-[A-Z0-9]{1,5}$/.test(value);
const usefulNumber = value => value && !/^(?:[—–-]|N\/?A|NONE|PART#\s*N\/?A)$/i.test(value);
const tableRows = block => (block.rows || []).map(row => row.cells.map(cell => clean(cell.text)));
const safeTitle = title => clean(title).replace(/\b(?:service|workshop) manual\b/gi, 'reference');

// Identifiers are discovered only in labeled structures. A number's shape never
// establishes that it can be ordered, fits a vehicle, or supersedes another part.
export function extractPartReferences(document) {
  const identifiers = [], diagramContexts = new Map();
  const seen = new Set();
  let heading = '', lastMedia = null, zone = '';
  const add = (number, label, kind, extra = {}) => {
    number = clean(number); label = clean(label);
    if (!usefulNumber(number)) return;
    const key = `${kind}:${number}:${label}`;
    if (seen.has(key)) return;
    seen.add(key);
    identifiers.push({ number, label, kind, orderable: false, documentId: document.id, ...extra });
  };
  const walk = blocks => {
    for (const block of blocks || []) {
      if (block.type === 'heading') {
        heading = clean(block.text);
        zone = /special tool|general equipment/i.test(heading) ? 'tool' : /^materials?$/i.test(heading) ? 'material' : '';
      }
      if (block.type === 'media') {
        diagramContexts.set(block.mediaId, { heading, excluded: zone === 'tool' || zone === 'material' });
        if (!zone) lastMedia = block.mediaId;
      }
      if (block.type === 'table') {
        const rows = tableRows(block), header = rows[0]?.map(norm) || [];
        const numberColumn = header.findIndex(h => h === 'part number' || h === 'base part number');
        const descriptionColumn = header.findIndex(h => h === 'description');
        const itemColumn = header.findIndex(h => h === 'item');
        if (numberColumn >= 0 && descriptionColumn >= 0) {
          for (const row of rows.slice(1)) {
            const number = row[numberColumn], label = row[descriptionColumn];
            if (!usefulNumber(number)) continue;
            add(number, label, baseNumber(number) ? 'base' : 'engineering-or-service-unverified', { callout: itemColumn >= 0 ? row[itemColumn] : null, mediaId: lastMedia });
          }
        }
        for (const row of rows) {
          if (norm(row[0]) === 'base part number' && usefulNumber(row[1])) {
            const number = row[1].replace(/^part#\s*/i, '');
            add(number, 'Component base identifier', baseNumber(number) ? 'base' : 'engineering-or-service-unverified');
          }
        }
        const fpn = header.indexOf('fpn'), harness = header.indexOf('harness id');
        if (fpn >= 0) for (const row of rows.slice(1)) if (fullNumber(row[fpn])) add(row[fpn], 'Connector housing identifier', 'engineering-or-service-unverified');
        if (harness >= 0) for (const row of rows.slice(1)) if (baseNumber(row[harness])) add(row[harness], 'Harness family identifier', 'base');
        const servicePart = header.indexOf('service part'), terminalPart = header.indexOf('terminal part number');
        if (servicePart >= 0) for (const row of rows.slice(1)) if (fullNumber(row[servicePart])) add(row[servicePart], 'Connector repair pigtail — catalog confirmation required', 'engineering-or-service-unverified');
        if (terminalPart >= 0) for (const row of rows.slice(1)) if (fullNumber(row[terminalPart])) add(row[terminalPart], 'Connector terminal identifier', 'engineering-or-service-unverified');
        if (zone === 'tool') for (const row of rows) {
          const pattern = /\b(?:\d{3}-\d{3,5}|T\d{2}[A-Z]-[A-Z0-9]+-[A-Z0-9]+|TKIT-[A-Z0-9/-]+)\b/g;
          const text = row.join(' '), label = clean(text.replace(pattern, '').replace(/[()]/g, ''));
          for (const number of text.match(pattern) || []) {
            add(number, label || 'Special equipment identifier', 'special-tool');
          }
        }
        if (zone === 'material') for (const row of rows.slice(1)) {
          const name = row[0] || '';
          for (const number of name.match(/\b(?:TA|PM|ZC|VC|XL|XG|XT|XY|XO)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g) || []) add(number, clean(name.replace(number, '')), 'material');
          for (const number of (row[1] || '').match(/\b(?:WSS?|EST|ESB|ESA|ESR)[A-Z0-9-]+\b/g) || []) add(number, 'Required material specification', 'material');
        }
        for (const row of block.rows || []) for (const cell of row.cells || []) walk(cell.blocks);
      }
      walk(block.children); walk(block.items);
    }
  };
  walk(document.blocks);
  return { identifiers, diagramContexts };
}

function documentData(row) {
  return { id: row.id, title: row.title, kind: row.kind, sectionCode: row.section_code, sectionTitle: row.section_title, engines: parse(row.engines), sourceHash: row.source_hash, blocks: parse(row.blocks), media: parse(row.media) };
}

function compatibleEngines(a, b) {
  // An unqualified article cannot import a variant-specific assembly.
  return (!a.length && !b.length) || (a.length > 0 && b.length > 0 && a.every(e => b.includes(e)));
}

export function createPartsCatalog(db, { contentDir = path.resolve('content') } = {}) {
  let seed = { parts: [], diagramReviews: [], documentDiagrams: {} };
  try { seed = { ...seed, ...JSON.parse(fs.readFileSync(path.join(contentDir, 'parts-catalog.json'), 'utf8')) }; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const docs = new Map(db.prepare('SELECT id,title,kind,section_code,section_title,engines,source_hash,blocks,media FROM documents').all().map(row => { const doc = documentData(row); return [doc.id, doc]; }));
  const extraction = new Map();
  const references = doc => { if (!extraction.has(doc.id)) extraction.set(doc.id, extractPartReferences(doc)); return extraction.get(doc.id); };
  const reviews = new Map((seed.diagramReviews || []).map(review => [review.mediaId, review]));
  const errors = [];
  const parts = (seed.parts || []).filter(part => {
    const boundConnector = part.fitment?.application === 'connector' && part.documentBindings?.length && part.documentBindings.every(binding => docs.get(binding.documentId)?.sourceHash === binding.sourceHash);
    const valid = part.number && ((part.fitment?.years?.length && part.fitment?.engines?.length) || boundConnector) && part.evidence?.length && part.evidence.every(id => seed.evidence?.[id]?.url) && part.matches && /^https:\/\/(?:(?:www\.)?(?:ford\.com|parts\.ford\.com|motorcraft\.com)|shop\.ford\.co\.uk)\//.test(part.officialUrl || '');
    if (!valid) errors.push(`Invalid catalog entry: ${part.id}`);
    return valid;
  });
  const assemblyCandidates = new Map();
  for (const doc of docs.values()) if (doc.kind === 'overview' && /component (?:view|location)|steering column - overview/i.test(doc.title)) {
    const key = doc.sectionCode + ':' + doc.sectionTitle;
    if (!assemblyCandidates.has(key)) assemblyCandidates.set(key, []);
    assemblyCandidates.get(key).push(doc);
  }
  function diagram(doc, media, fallbackKind) {
    const context = references(doc).diagramContexts.get(media.id);
    if (context?.excluded || (!context && doc.kind !== 'wiring' && doc.kind !== 'connector')) return null;
    const review = reviews.get(media.id);
    const reviewed = review?.documentId === doc.id && review?.sourceHash === doc.sourceHash;
    const kind = reviewed ? review.kind : fallbackKind;
    return { id: media.id, url: media.url, mime: media.mime, width: media.width, height: media.height, documentId: doc.id, title: safeTitle(reviewed ? review.title : context?.heading && !/^(removal|installation)$/i.test(context.heading) ? `${doc.title} — ${context.heading}` : doc.title), kind, explodedVerified: reviewed && kind === 'exploded-view', ...(media.legend ? { legend: media.legend } : {}) };
  }
  function forDocument(documentId, { year, engine } = {}) {
    const doc = docs.get(documentId); if (!doc) return null;
    const refs = references(doc), identifiers = [...refs.identifiers], diagrams = [], seenMedia = new Set();
    const addDiagram = (owner, media, kind) => {
      if (engine && owner.engines.length && !owner.engines.includes(engine)) return;
      if (/symbols glossary|about this manual/i.test(owner.title)) return;
      if (!['connector', 'wiring'].includes(owner.kind) && Math.max(media.width || 0, media.height || 0) < 220) return;
      const item = diagram(owner, media, kind);
      if (item && !seenMedia.has(item.url)) { seenMedia.add(item.url); diagrams.push(item); }
    };
    const genericKind = owner => owner.kind === 'connector' ? 'connector-view' : owner.kind === 'wiring' ? 'wiring-diagram' : owner.kind === 'overview' ? 'component-view' : 'procedure-illustration';
    // Curated links bind to the exact article and exact diagram revision.
    for (const link of seed.documentDiagrams?.[documentId] || []) {
      const owner = docs.get(link.documentId);
      if (owner?.sourceHash !== link.sourceHash || doc.sourceHash !== link.targetSourceHash || !compatibleEngines(doc.engines, owner.engines)) continue;
      const media = owner.media.find(m => m.id === link.mediaId); if (media) addDiagram(owner, media, genericKind(owner));
    }
    const candidates = assemblyCandidates.get(doc.sectionCode + ':' + doc.sectionTitle) || [];
    const titleTokens = norm(doc.title).split(' ').filter(t => t.length > 2 && !['assembly', 'system', 'overview', 'component', 'view', 'front', 'rear', 'installation', 'removal'].includes(t));
    for (const candidate of candidates) {
      if (candidate.id === doc.id || !compatibleEngines(doc.engines, candidate.engines)) continue;
      const candidateRefs = references(candidate);
      const matched = candidateRefs.identifiers.filter(ref => titleTokens.length && titleTokens.every(t => norm(ref.label).includes(t)));
      for (const ref of matched) {
        if (!identifiers.some(i => i.number === ref.number && i.label === ref.label)) identifiers.push(ref);
        const media = candidate.media.find(m => m.id === ref.mediaId); if (media) addDiagram(candidate, media, 'component-view');
      }
    }
    for (const media of doc.media) addDiagram(doc, media, genericKind(doc));
    const names = new Set(identifiers.filter(i => i.kind === 'base' || i.kind === 'engineering-or-service-unverified').map(i => norm(i.label)));
    const applicableParts = parts.filter(part => {
      const match = part.matches;
      if (!(match.documentIds?.includes(doc.id) || match.titles?.some(title => norm(title) === norm(doc.title)) || match.componentLabels?.some(label => names.has(norm(label))))) return false;
      if (part.documentBindings && !part.documentBindings.some(binding => binding.documentId === doc.id && binding.sourceHash === doc.sourceHash)) return false;
      if (doc.engines.length && part.fitment.engines.length && !doc.engines.some(e => part.fitment.engines.includes(e))) return false;
      if (year != null && part.fitment.years.length && !part.fitment.years.includes(Number(year))) return false;
      if (engine && part.fitment.engines.length && !part.fitment.engines.includes(engine)) return false;
      return true;
    }).map(part => ({ id: part.id, name: part.name, brand: part.brand || 'Motorcraft', number: part.number, additionalNumbers: part.additionalNumbers || [], numberType: 'service', fitment: part.fitment, fitmentStatus: part.fitmentStatus || 'published-application', officialUrl: part.officialUrl }));
    const verifiedNumbers = new Set(applicableParts.flatMap(part => [part.number, ...part.additionalNumbers.map(n => n.number)]).map(number => number.replace(/[^A-Z0-9]/gi, '').toUpperCase()));
    const publicIdentifiers = identifiers.filter(identifier => identifier.kind !== 'engineering-or-service-unverified' || !verifiedNumbers.has(identifier.number.replace(/[^A-Z0-9]/gi, '').toUpperCase()));
    const selectedDiagrams = diagrams.sort((a, b) => Number(b.explodedVerified) - Number(a.explodedVerified)).slice(0, 3);
    return {
      documentId, availability: applicableParts.length ? 'verified-parts' : identifiers.length || selectedDiagrams.length ? 'references-only' : 'catalog-lookup',
      parts: applicableParts, identifiers: publicIdentifiers, diagrams: selectedDiagrams,
      catalogLinks: [...(seed.documentCatalogLinks?.[documentId] || []).filter(link => /^https:\/\/(?:shop\.ford\.co\.uk|www\.ford\.com)\//.test(link.url)), { label: 'Find parts by VIN at Ford', url: CATALOG_URL }],
      fitmentNote: applicableParts.length ? 'Match the listed year, engine and equipment. Confirm the current replacement number with Ford using your VIN before ordering.' : 'Use your VIN and fitted equipment to find the current Ford replacement. Base numbers and connector markings identify components; they are not verified ordering numbers.'
    };
  }
  return { forDocument, report: () => ({ catalogEntries: parts.length, reviewedDiagrams: reviews.size, errors }) };
}

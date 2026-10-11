import fs from 'node:fs';
import path from 'node:path';

const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unsafeMarkup = /<\/?[a-z][^>]*>|<!--|<!DOCTYPE|<\?|(?:javascript|vbscript|data|file|blob)\s*:|[a-z][a-z0-9+.-]*:\/\//i;
function text(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
    && !unsafeMarkup.test(value) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
function ids(value, max, required = false) {
  return Array.isArray(value) && value.length <= max && (!required || value.length > 0)
    && value.every(safeId) && new Set(value).size === value.length;
}
function identity(filename) {
  try { const s = fs.statSync(filename); return `${s.mtimeMs}:${s.ctimeMs}:${s.size}`; }
  catch { return 'missing'; }
}
function read(filename) {
  if (fs.statSync(filename).size > 32 * 1024 * 1024) throw new Error('Content file exceeds 32 MiB.');
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

export function createLearningContextCatalog(db, {contentDir}) {
  // The source database is immutable during a release; authored content can change.
  const documents = new Map(db.prepare('SELECT id,title,kind,source_hash FROM documents').all().map(d => [d.id, d]));
  const filename = path.join(contentDir, 'topic-contexts.json');
  const glossaryFile = path.join(contentDir, 'glossary.json');
  let previousIdentity = null;
  let contexts = new Map();
  let errors = [];
  let revision = 0;

  function refresh() {
    const nextIdentity = `${identity(filename)}|${identity(glossaryFile)}`;
    if (nextIdentity === previousIdentity) return;
    previousIdentity = nextIdentity;
    revision++;
    contexts = new Map();
    errors = [];
    let input;
    try { input = read(filename); }
    catch { errors.push({scope:'file',reason:identity(filename) === 'missing' ? 'missing' : 'invalid-json-or-size'}); return; }
    if (!object(input) || input.version !== 1 || !Array.isArray(input.topics) || !object(input.documents)) {
      errors.push({scope:'file',reason:'invalid-schema'}); return;
    }
    let glossary = [];
    try {
      const data = read(glossaryFile);
      glossary = Array.isArray(data) ? data : data.terms || [];
      if (Array.isArray(glossary)) {
        const authoredNames = new Set(glossary.flatMap(t => [t.name,...(Array.isArray(t.aliases)?t.aliases:[])]).filter(n => typeof n === 'string').map(n => n.toLowerCase()));
        const expansions = (Array.isArray(data.abbreviations)?data.abbreviations:[])
          .filter(a => typeof a.name === 'string' && !a.ambiguous && a.variants?.length === 1 && !authoredNames.has(a.name.toLowerCase()))
          .map(a => ({id:'abbr-'+Buffer.from(a.name).toString('hex'),name:a.name}));
        glossary = [...glossary,...expansions];
      }
    }
    catch { /* Context without related terms remains usable if the glossary is absent. */ }
    const terms = new Map();
    const ambiguousTerms = new Set();
    for (const term of Array.isArray(glossary) ? glossary : []) {
      if (!safeId(term?.id) || !text(term.name, 240)) continue;
      if (terms.has(term.id)) ambiguousTerms.add(term.id);
      else terms.set(term.id, {id:term.id,name:term.name});
    }
    for (const id of ambiguousTerms) terms.delete(id);
    const topics = new Map();
    const seenTopics = new Set();
    for (const topic of input.topics) {
      if (!object(topic) || !safeId(topic.id)) { errors.push({scope:'topic',reason:'invalid-id'}); continue; }
      if (seenTopics.has(topic.id)) {
        topics.delete(topic.id); errors.push({scope:'topic',id:topic.id,reason:'duplicate-id'}); continue;
      }
      seenTopics.add(topic.id);
      const relatedTermIds = topic.relatedTermIds === undefined ? [] : topic.relatedTermIds;
      let reason;
      if (!text(topic.title,240) || !text(topic.summary,2000)) reason = 'invalid-title-or-summary';
      else if (!Array.isArray(topic.sections) || !topic.sections.length || topic.sections.length > 16
        || topic.sections.some(s => !object(s) || !safeId(s.id) || !text(s.title,240) || !text(s.body,24000))
        || new Set(topic.sections.map(s => s.id)).size !== topic.sections.length) reason = 'invalid-sections';
      else if (!ids(relatedTermIds,64) || relatedTermIds.some(id => !terms.has(id))) reason = 'invalid-related-terms';
      else if (!ids(topic.sourceDocumentIds,256,true) || topic.sourceDocumentIds.some(id => !documents.has(id))) reason = 'invalid-source-documents';
      if (reason) { errors.push({scope:'topic',id:topic.id,reason}); continue; }
      topics.set(topic.id, {
        version:1, title:topic.title.trim(), summary:topic.summary.trim(),
        sections:topic.sections.map(s => ({id:s.id,title:s.title.trim(),body:s.body.trim()})),
        relatedTerms:relatedTermIds.map(id => terms.get(id)),
        sourceRefs:topic.sourceDocumentIds.map(id => { const d=documents.get(id); return {documentId:id,title:d.title,kind:d.kind}; }),
        status:'complete',
      });
    }
    for (const [id,mapping] of Object.entries(input.documents)) {
      const document = documents.get(id);
      let reason;
      if (!safeId(id) || !document) reason = 'unknown-document';
      else if (!object(mapping) || !safeId(mapping.topicId) || !topics.has(mapping.topicId)) reason = 'invalid-topic';
      else if (typeof mapping.sourceHash !== 'string' || mapping.sourceHash !== document.source_hash) reason = 'stale-source-hash';
      else if (mapping.summary !== undefined && !text(mapping.summary,2000)) reason = 'invalid-summary';
      if (reason) { errors.push({scope:'document',id:safeId(id)?id:undefined,reason}); continue; }
      const context = topics.get(mapping.topicId);
      contexts.set(id, {...context,summary:mapping.summary?.trim() || context.summary});
    }
  }

  return {
    get(documentOrId) {
      refresh();
      const id = typeof documentOrId === 'string' ? documentOrId : documentOrId?.id;
      if (typeof documentOrId !== 'string' && documents.get(id)?.source_hash !== (documentOrId?.sourceHash ?? documentOrId?.source_hash)) return null;
      const context = contexts.get(id);
      return context ? structuredClone(context) : null;
    },
    stats() {
      refresh();
      return {contextualizedDocuments:contexts.size,contextualizationStatus:documents.size > 0 && contexts.size === documents.size ? 'complete' : 'in_progress'};
    },
    report() {
      refresh();
      return {version:1,documents:documents.size,...this.stats(),missingDocumentIds:[...documents.keys()].filter(id => !contexts.has(id)),errors:structuredClone(errors)};
    },
    revision() { refresh(); return revision; },
  };
}

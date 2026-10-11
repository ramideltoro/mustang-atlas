import crypto from 'node:crypto';

// Keep this normalization stable: group keys determine saved topic IDs.
export const normalizeContextTitle = title => title
  .replace(/^C[\dA-Z]+\s+—\s+/, '')
  .replace(/\s+-\s+(Overview|Component Location|System Operation)$/i, '')
  .toLowerCase().trim();

export function contextGroupKey(doc) {
  const name = normalizeContextTitle(doc.title);
  const subject = name.replace(/\s*-\s*system operation and component description$/, '');
  const broad = /^(?:engine|(?:manual )?transmission(?:\s*-.*)?|transmission fluid level check|external controls|electronic engine controls|parking aid|cruise control|specifications|safety precautions|general information)$/.test(subject);
  const distinctJob = /^(?:front strut and spring assembly|wheel and tire|cylinder head|gearshift lever|(?:front|rear) bumper cover(?: - vehicles with: svt performance package)?)$/.test(name);
  const phase = doc.source_path?.split('/').at(-2) || doc.kind;

  // Similar connector names can carry different circuits. Broad systems and
  // jobs with separate on-car/bench procedures retain section and phase.
  if (['wiring', 'connector'].includes(doc.kind)) return doc.id;
  if (broad || distinctJob) return `${doc.system_id}|${doc.section_code}|${phase}|${name}`;
  if (['overview', 'repair'].includes(doc.kind)) return `${doc.system_id}|${name}`;
  return `${doc.system_id}|${doc.section_title}|${name}`;
}

export const contextTopicId = key => 'topic-' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);

// Preserve input order and document objects for evidence/fingerprint creation.
export function groupContextDocuments(documents) {
  const groups = new Map();
  for (const doc of documents) {
    const key = contextGroupKey(doc);
    if (!groups.has(key)) groups.set(key, {id: contextTopicId(key), key, documents: []});
    groups.get(key).documents.push(doc);
  }
  return groups;
}

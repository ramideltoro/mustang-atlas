const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value);
const unsafeMarkup = /<\/?[a-z][^>]*>|<!--|<!DOCTYPE|<\?|(?:javascript|vbscript|data|file|blob)\s*:|[a-z][a-z0-9+.-]*:\/\//i;
const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
  && !unsafeMarkup.test(value) && !controlCharacters.test(value);
const uniqueIds = (value, max, required = false) => Array.isArray(value) && value.length <= max
  && (!required || value.length > 0) && value.every(safeId) && new Set(value).size === value.length;

// This authoring policy is intentionally narrower than the API's presentation
// schema (three substantial sections), while IDs use the same API-safe grammar.
export function validateAuthoredContext(topic, group) {
  if (!object(group) || !safeId(group.id) || !Array.isArray(group.documents)
    || !group.documents.length || !group.documents.every(d => safeId(d?.id))
    || !(group.evidenceIds instanceof Set) || !(group.termIds instanceof Set)) throw Error('Invalid authoring group');
  if (!object(topic) || !safeId(topic.id) || topic.id !== group.id) throw Error('Missing or mismatched topic');
  if (!validText(topic.title, 240) || !validText(topic.summary, 2000)) throw Error('Invalid title or summary: empty text, unsafe markup, controls, or API bounds');
  if (!Array.isArray(topic.sections) || topic.sections.length !== 3
    || topic.sections.some(section => !object(section) || !safeId(section.id))
    || new Set(topic.sections.map(section => section.id)).size !== 3) throw Error('Expected three uniquely named teaching sections');
  if (topic.sections.some(section => !validText(section.title, 240) || !validText(section.body, 24000))) {
    throw Error('Invalid section text: empty text, unsafe markup, controls, or API bounds');
  }
  const words = [topic.summary, ...topic.sections.map(section => section.body)].join(' ').trim().split(/\s+/).length;
  if (words < 110 || words > 450) throw Error('Expected substantial, concise topic explanation; got ' + words + ' words');
  if (!uniqueIds(topic.sourceDocumentIds, 256, true)
    || topic.sourceDocumentIds.some(id => !group.evidenceIds.has(id))
    || !group.documents.some(doc => topic.sourceDocumentIds.includes(doc.id))) throw Error('Unsupported source reference');
  if (!uniqueIds(topic.relatedTermIds, 64)
    || topic.relatedTermIds.some(id => !group.termIds.has(id))) throw Error('Unsupported glossary reference');
  if (/\b(?:as an AI|lorem ipsum|placeholder|consult (?:a |your )?professional)\b/i.test(topic.summary)) throw Error('Boilerplate summary');
  return topic;
}

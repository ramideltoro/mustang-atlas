import { selectThumbnail } from './catalog.mjs';

const array = value => { if (Array.isArray(value)) return value; try { return JSON.parse(value || '[]'); } catch { return []; } };
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\b\d+(?:\.\d+)?\s*l\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const stem = word => ({draining:'drain',filling:'fill',bleeding:'bleed',flushing:'flush',installation:'install',assembly:'assembl',removal:'remove'}[word] || word.replace(/(?:ies)$/, 'y').replace(/s$/, ''));
const stop = new Set('the a an and or of for to with on in from using use engine system general information procedure removal installation disassembly assembly overhaul vehicles vehicle ecoboost duratec tivct ti vct lh rh left right hand coupe convertible operation component description overview'.split(' '));
const prerequisite = /\b(?:refer\s+to|see\s+the\s+(?:procedure|section))\s*:?/i;
const weakRole = /\b(?:underbody|undertray|shield|cross\s*brace|support\s+bar|support\s+bracket|lifting\s+bracket|appearance\s+cover|radiator\s+top\s+shield)\b/i;
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Only the action attached to a figure is evidence of what that figure depicts.
// A prerequisite link's title must never make a shield or lifting tool look like
// an illustration of the main repair component.
export function workshopMediaContexts(blocks) {
  const contexts = new Map();
  const clean = text => String(text || '').split(prerequisite)[0].replace(/(?:Use|Install|Remove) (?:the )?(?:Special Service Tool|General Equipment):[\s\S]*/i, '').trim();
  const actionText = block => [!['safety', 'heading'].includes(block.type) ? clean(block.text) : '', ...(block.children || []).map(actionText), ...(block.items || []).map(actionText)].filter(Boolean).join(' · ');
  function walk(items, ancestors = [], table = false, heading = '') {
    let previous = '';
    for (const block of array(items)) {
      if (block.type === 'heading') { heading = block.text || ''; previous = ''; }
      const own = clean(block.text);
      if (block.type === 'media' || block.mediaId) {
        const context = [...ancestors, previous].filter(Boolean).join(' · ');
        const entry = { context, heading, table, index: contexts.size };
        if (!contexts.has(block.mediaId) || context.length > contexts.get(block.mediaId).context.length) contexts.set(block.mediaId, entry);
      }
      const branch = ['step', 'list-item'].includes(block.type) && own ? [...ancestors, own] : ancestors;
      if (block.children?.length) walk(block.children, branch, table, heading);
      if (block.items?.length) walk(block.items, own ? [...ancestors, own] : ancestors, table, heading);
      for (const row of block.rows || []) for (const cell of row.cells || []) walk(cell.blocks, ancestors, true, heading);
      const action = ['step', 'list', 'list-item'].includes(block.type) ? actionText(block) : own;
      if (action && !['heading', 'safety', 'table'].includes(block.type)) previous = action;
      else if (['step', 'list-item'].includes(block.type)) previous = '';
      // A reference-only block breaks adjacency; retaining an earlier action
      // would falsely assign the following prerequisite illustration to it.
      else if (block.text && prerequisite.test(block.text)) previous = '';
    }
  }
  walk(blocks);
  return contexts;
}

export function rankWorkshopMedia(document, { title = document.title, limit = Infinity } = {}) {
  const media = array(document.media), blocks = array(document.blocks), contexts = workshopMediaContexts(blocks);
  const component = normalize(String(title || '').replace(/\([^)]*\)/g, '').split(/\s[-–—]\s/)[0]).replace(/\s+(?:lh|rh|lhd|rhd)$/, '');
  const terms = [...new Set(component.split(' ').filter(word => word.length > 1 && !stop.has(word)).map(stem))];
  const topic = component, ranked = [];
  for (const original of media) {
    // Reuse the established size/control safeguards, without allowing their
    // first-image/area heuristic to determine the workshop's semantic choice.
    if (!selectThumbnail({ ...document, blocks, media: [original] })) continue;
    const position = contexts.get(original.id); if (!position) continue;
    const context = normalize(position.context), words = new Set(context.split(' ').map(stem));
    const matched = terms.filter(term => words.has(term));
    let score = terms.length ? matched.length / terms.length * 80 : 0;
    if (topic && context.includes(topic)) score += 25;
    if (terms.length && matched.length === terms.length) score += 20;
    if (component) {
      // A part's bolts, connector or trim can all repeat the complete topic
      // name. Prefer the actual component removal/installation illustration.
      const escaped = escapeRegex(component);
      const suffix = '(?:bolts?|nuts?|fasteners?|electrical connectors?|tubes?|hoses?|interior belt|exterior belt|gaskets?|brackets?|noise insulator|drive (?:unit|tappet)|o ring|tappet)';
      if (new RegExp(`\\b${escaped} ${suffix}\\b`).test(context)) score -= 22;
      // Score the grammatical object of the action, not a component mentioned
      // later as an attachment point ("remove the CAC from the radiator").
      // Permit omitted directional qualifiers and intervening fasteners only.
      const object = escaped.replace(/^(?:front|rear) /, '(?:(?:front|rear) )?');
      const direct = new RegExp(`^(?:remove|install|replace|inspect|measure|check) (?:and discard )?(?:(?:the|a|new|old|bolts?|nuts?|screws?|retainers?|fasteners?|and) )*${object}(?:$| (?:and|assembly)\\b)`);
      if (position.context.split(/[.·\n]|\b(?:then|and then)\b/i).some(sentence => direct.test(normalize(sentence)))) score += 55;
    }
    if (/\b(?:remove|install|inspect|measure|test|check|clean|flush|drain|fill)\b/.test(context)) score += 4;
    if (position.table || /special tool|general equipment/i.test(position.heading)) score -= 70;
    if (weakRole.test(position.context) && !weakRole.test(title)) score -= 55;
    if (!matched.length && terms.length) score -= 25;
    if (!context) score -= 25;
    score -= position.index * 0.001;
    ranked.push({ ...original, documentId: document.id, mediaId: original.id, score, selectionContext: position.context, matchedTerms: matched });
  }
  return ranked.sort((a,b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}

export function selectWorkshopThumbnail(document, resolve = media => media, options = {}) {
  const selected = rankWorkshopMedia(document, options).find(item => item.score > 0);
  if (!selected) return null;
  const original = array(document.media).find(item => item.id === selected.id);
  return { ...resolve(original), documentId: document.id, kind: document.kind === 'wiring' ? 'wiring-diagram' : document.kind === 'connector' ? 'connector-view' : 'article-illustration' };
}

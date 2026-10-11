import fs from 'node:fs';
import path from 'node:path';

function nodes(blocks, map = new Map()) {
 for (const block of blocks || []) {
  if (block.id) map.set(block.id, block);
  nodes(block.children, map); nodes(block.items, map);
  for (const row of block.rows || []) for (const cell of row.cells || []) nodes(cell.blocks, map);
 }
 return map;
}

// Reviewed captions supplement genuinely image-only steps. Immutable article
// and asset identities keep a caption from drifting onto a changed procedure.
export function createIllustratedStepCatalog({contentDir}) {
 let entries = [];
 try { entries = JSON.parse(fs.readFileSync(path.join(contentDir, 'illustrated-steps.json'), 'utf8')).documents || []; } catch {}
 const catalog = new Map(entries.map(entry => [entry.documentId, entry]));
 return {apply(doc, original) {
  const entry = catalog.get(original.id);
  if (!entry || entry.sourceHash !== original.sourceHash) return doc;
  const before = nodes(original.blocks), after = nodes(doc.blocks);
  const media = new Map((original.media || []).map(figure => [figure.id, figure]));
  for (const caption of entry.steps || []) {
   const source = before.get(caption.blockId), target = after.get(caption.blockId);
   const index = original.blocks.findIndex(block => block.id === caption.blockId);
   if (!source || source.type !== 'step' || source.text?.trim() || source.children?.length) continue;
   if (index < 0 || original.blocks[index + 1]?.mediaId !== caption.mediaId || media.get(caption.mediaId)?.url !== caption.mediaUrl) continue;
   if (!target || target.type !== 'step' || target.text?.trim() || target.textBlocks?.length || !caption.text?.trim()) continue;
   target.text = caption.text.trim();
  }
  return doc;
 }};
}

import fs from 'node:fs';
import path from 'node:path';
import { ENGINE_OPTIONS, documentApplicability, engineFilter, isPublicDocument, selectThumbnail, sectionFor, stripPrivateMetadata } from './catalog.mjs';
import { internalizeMaintenanceReferences } from './maintenance.mjs';
import { createProcedureMediaCatalog } from './procedure-media.mjs';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const safeId = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(v);
const safeText = (v, max = 12000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/<\/?[a-z][^>]*>|<!--|(?:javascript|vbscript|data|file|blob)\s*:|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/i.test(v);
const textArray = (v = [], max = 40) => Array.isArray(v) && v.length <= max && v.every(t => safeText(t));
const idArray = (v = []) => Array.isArray(v) && v.length <= 150 && v.every(safeId) && new Set(v).size === v.length;
const fitValid = v => object(v) && Array.isArray(v.engines) && v.engines.length > 0 && v.engines.every(e => ENGINE_OPTIONS.includes(e)) && new Set(v.engines).size === v.engines.length && Array.isArray(v.years) && v.years.length > 0 && v.years.every(y => Number.isInteger(y) && y >= 1900 && y <= 2100) && (!v.equipment || safeText(v.equipment, 1000)) && (!v.market || safeText(v.market, 240));
const proseRows = (v = [], field = 'body') => Array.isArray(v) && v.length <= 60 && v.every(s => object(s) && safeText(s.title, 240) && safeText(s[field]));
const localHref = id => '#/maintenance/' + id;
const searchable = g => [g.title,g.summary,g.introduction,g.why,g.when.summary,...(g.when.notes||[]),...(g.notes||[]),...(g.prepare||[]).flatMap(s=>[s.title,s.detail]),...(g.steps||[]).flatMap(s=>[s.title,s.body]),...(g.watchFor||[]).flatMap(s=>[s.title,s.body])].join(' ').toLowerCase();
function options({ engine = 'all', year = 2015 } = {}) {
  const selectedEngine = engineFilter(engine), selectedYear = Number(year);
  if (!Number.isInteger(selectedYear) || selectedYear < 1900 || selectedYear > 2100) throw Object.assign(new Error('Unsupported maintenance year.'), { status: 400 });
  return { engine: selectedEngine, year: selectedYear };
}
function applicability(fit, { engine, year }) {
  return { engines: [...fit.engines], years: [...fit.years], ...(fit.market ? {market: fit.market} : {}), ...(fit.equipment ? {equipment: fit.equipment} : {}), selectedEngine: engine, selectedYear: year, matchesSelectedEngine: engine === 'all' || fit.engines.includes(engine), matchesSelectedYear: fit.years.includes(year) };
}
function fits(fit, opts) { const a = applicability(fit, opts); return a.matchesSelectedEngine && a.matchesSelectedYear; }
function fileIdentity(file) { try { const s = fs.statSync(file); return `${s.mtimeMs}:${s.ctimeMs}:${s.size}`; } catch { return 'missing'; } }

export function createMaintenanceGuideCatalog(db, { contentDir = path.resolve('content'), assetResolver = m => m } = {}) {
  const rows = db.prepare('SELECT id,title,kind,system_id,section_code,section_title,engines,source_hash FROM documents').all().filter(isPublicDocument);
  const documents = new Map(rows.map(row => [row.id, row]));
  const videoControls = createProcedureMediaCatalog({contentDir,dataDir:path.resolve('data')});
  const assets = db.prepare('SELECT media,blocks FROM documents WHERE id=?');
  const assetCache = new Map();
  function assetsFor(id) { if (!assetCache.has(id)) { const row = assets.get(id); assetCache.set(id, row ? { media: JSON.parse(row.media), blocks: JSON.parse(row.blocks) } : null); } return assetCache.get(id); }
  const file = path.join(contentDir, 'maintenance-guides.json');
  let identity, seed = {}, guides = new Map(), categories = [], errors = [], scheduleData = null;
  function validRef(ref) { return object(ref) && safeId(ref.documentId) && typeof ref.sourceHash === 'string' && documents.get(ref.documentId)?.source_hash === ref.sourceHash; }
  function evidenceValid(ids) { return idArray(ids) && ids.length > 0 && ids.every(id => { const e = seed.evidence?.[id]; try { const url = new URL(e?.url); return safeText(e.title, 300) && url.protocol === 'https:' && url.hostname === 'www.fordservicecontent.com'; } catch { return false; } }); }
  function refresh() {
    const next = fileIdentity(file); if (identity === next) return;
    identity = next; seed = {}; guides = new Map(); categories = []; errors = []; scheduleData = null;
    if (next === 'missing') return;
    try { if (fs.statSync(file).size > 8 * 1024 * 1024) throw new Error('oversized'); seed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { errors.push({ scope: 'file', reason: 'invalid-json-or-size' }); return; }
    if (seed.version !== 1 || !safeText(seed.title, 240) || !safeText(seed.description, 3000) || !Array.isArray(seed.categories) || !Array.isArray(seed.guides)) { errors.push({ scope: 'file', reason: 'invalid-schema' }); seed = {}; return; }
    const seenCategories = new Set(), ambiguousCategories = new Set();
    for (const c of seed.categories) {
      if (!object(c) || !safeId(c.id) || !safeText(c.title, 240) || !safeText(c.description, 3000) || (c.icon && !safeId(c.icon))) { errors.push({ scope: 'category', reason: 'invalid-category' }); continue; }
      if (seenCategories.has(c.id)) { ambiguousCategories.add(c.id); errors.push({ scope: 'category', id: c.id, reason: 'duplicate-id' }); continue; }
      seenCategories.add(c.id); categories.push({ id: c.id, title: c.title, description: c.description, icon: c.icon || 'wrench' });
    }
    categories = categories.filter(c => !ambiguousCategories.has(c.id)); const categoryIds = new Set(categories.map(c => c.id));
    const seen = new Set();
    for (const g of seed.guides) {
      if (!object(g) || !safeId(g.id) || g.id === 'schedule') { errors.push({ scope: 'guide', reason: 'invalid-id' }); continue; }
      if (seen.has(g.id)) { guides.delete(g.id); errors.push({ scope: 'guide', id: g.id, reason: 'duplicate-id' }); continue; } seen.add(g.id);
      let reason;
      if (!safeText(g.title, 240) || !safeText(g.summary, 3000) || !categoryIds.has(g.categoryId) || !fitValid(g.applicability) || !idArray(g.ruleIds)) reason = 'invalid-metadata';
      else if (!safeText(g.introduction) || !safeText(g.why) || !object(g.when) || !safeText(g.when.summary) || !textArray(g.when.notes) || !proseRows(g.prepare, 'detail') || !proseRows(g.steps) || !proseRows(g.watchFor) || !textArray(g.notes) || !idArray(g.relatedGuideIds)) reason = 'invalid-prose';
      else if (!Array.isArray(g.sourceRefs) || !g.sourceRefs.length || g.sourceRefs.length > 150 || !g.sourceRefs.every(validRef) || new Set(g.sourceRefs.map(r => r.documentId)).size !== g.sourceRefs.length || !evidenceValid(g.evidence)) reason = 'invalid-or-stale-evidence';
      else if (!Array.isArray(g.procedures) || g.procedures.length > 100 || g.procedures.some(p => !object(p) || !safeId(p.documentId) || !safeText(p.purpose, 2000) || !g.sourceRefs.some(r => r.documentId === p.documentId)) || new Set(g.procedures.map(p => p.documentId)).size !== g.procedures.length) reason = 'invalid-procedure';
      else if (g.hero && (!object(g.hero) || !g.sourceRefs.some(r => r.documentId === g.hero.documentId) || (g.hero.mediaId && !safeId(g.hero.mediaId)))) reason = 'invalid-hero';
      if (!reason && g.hero?.mediaId) { const row = assetsFor(g.hero.documentId); if (!row.media.some(m => m.id === g.hero.mediaId)) reason = 'missing-hero-media'; }
      if (reason) errors.push({ scope: 'guide', id: g.id, reason }); else guides.set(g.id, g);
    }
    // Related links can disappear when another guide becomes stale; the current
    // guide remains valid and does not advertise the missing destination.
    for (const g of guides.values()) for (const id of g.relatedGuideIds || []) if (!guides.has(id)) errors.push({ scope: 'related-guide', id: g.id, target: id, reason: 'unavailable-related-guide' });
    const s = seed.schedule;
    if (s) {
      let valid = object(s) && safeText(s.title, 240) && safeText(s.summary, 4000) && fitValid(s.applicability) && textArray(s.notes) && proseRows(s.exceptions) && object(s.oilLife) && safeText(s.oilLife.summary) && textArray(s.oilLife.notes);
      valid &&= Array.isArray(s.oilLife?.bands) && s.oilLife.bands.length <= 20 && s.oilLife.bands.every(b => object(b) && safeId(b.id) && safeText(b.label, 300) && safeText(b.description, 3000) && safeText(b.miles, 300) && safeText(b.kilometers, 300));
      valid &&= Array.isArray(s.groups) && s.groups.length > 0 && s.groups.length <= 30 && s.groups.every(group => object(group) && safeId(group.id) && safeText(group.title, 240) && safeText(group.timing, 3000) && safeText(group.description, 4000) && Array.isArray(group.items) && group.items.length > 0 && group.items.length <= 100 && group.items.every(item => object(item) && guides.has(item.guideId) && safeText(item.task, 500) && safeText(item.detail, 4000))) && new Set(s.groups.map(g => g.id)).size === s.groups.length;
      if (valid) scheduleData = s; else errors.push({ scope: 'schedule', reason: 'invalid-schedule-or-missing-guide' });
    }
  }
  function sourceList(ids) { return internalizeMaintenanceReferences(ids.map(id => ({ title: seed.evidence[id].title, url: seed.evidence[id].url }))); }
  function relatedDocument(ref, opts, fit) {
    const d = documents.get(ref.documentId); if (!d) return null;
    const a = documentApplicability(d, opts.engine);
    if (!a.matchesSelectedEngine || (a.engines.length && !a.engines.some(e => fit.engines.includes(e)))) return null;
    const parsed = { ...d, ...assetsFor(d.id) }; parsed.media = videoControls.filterControls(d, parsed.media);
    return { documentId: d.id, title: d.title, purpose: ref.purpose, kind: d.kind, href: '#/document/' + d.id, section: sectionFor(d), engines: a.engines, thumbnail: selectThumbnail(parsed, assetResolver) };
  }
  function thumbnail(g, opts) {
    if (!fits(g.applicability, opts)) return null;
    const candidates = [...(g.hero ? [g.hero] : []), ...g.procedures];
    for (const ref of candidates) {
      const d = relatedDocument(ref, opts, g.applicability); if (!d) continue;
      if (ref.mediaId) { const owner = documents.get(ref.documentId), own = assetsFor(ref.documentId), chosen = selectThumbnail({...owner,blocks:own.blocks,media:videoControls.filterControls(owner,own.media).filter(m=>m.id===ref.mediaId)},assetResolver); if (chosen) return { ...chosen, documentTitle: d.title, engines: d.engines }; }
      if (d.thumbnail) return { ...d.thumbnail, documentTitle: d.title, engines: d.engines };
    }
    return null;
  }
  function card(g, opts) { return { id: g.id, title: g.title, summary: g.summary, categoryId: g.categoryId, interval: g.when.summary, ruleIds: g.ruleIds || [], href: localHref(g.id), applicability: applicability(g.applicability, opts), thumbnail: thumbnail(g, opts) }; }
  function publicCopy(value) { return stripPrivateMetadata(internalizeMaintenanceReferences(structuredClone(value))); }
  function detail(id, input = {}) {
    refresh(); const g = guides.get(id); if (!g) return null; const opts = options(input);
    return publicCopy({ ...card(g, opts), introduction: g.introduction, why: g.why, when: g.when, prepare: g.prepare || [], steps: g.steps || [], watchFor: g.watchFor || [], notes: g.notes || [],
      procedures: fits(g.applicability, opts) ? g.procedures.map(p => relatedDocument(p, opts, g.applicability)).filter(Boolean) : [],
      relatedGuides: (g.relatedGuideIds || []).filter(id => id !== g.id && guides.has(id) && fits(guides.get(id).applicability, opts)).map(id => card(guides.get(id), opts)), sources: sourceList(g.evidence) });
  }
  function list(input = {}) {
    refresh(); const opts = options(input), q = String(input.q || '').trim().toLowerCase().slice(0,500), category = String(input.category || '');
    const available = [...guides.values()].filter(g => fits(g.applicability, opts));
    const results = available.filter(g => (!category || g.categoryId === category) && (!q || q.split(/\s+/).every(word => searchable(g).includes(word))));
    if ([input.limit, input.offset].some(value => value !== undefined && !/^\d+$/.test(String(value)))) throw Object.assign(new Error('Invalid maintenance pagination.'), { status: 400 });
    const limit = input.limit === undefined ? 100 : Math.max(0, Math.min(100, Number(input.limit))), offset = input.offset === undefined ? 0 : Math.max(0, Number(input.offset));
    if (!Number.isInteger(limit) || !Number.isInteger(offset) || offset > 1000000) throw Object.assign(new Error('Invalid maintenance pagination.'), { status: 400 });
    return publicCopy({ title: seed.title || 'Maintenance', description: seed.description || '', items: results.slice(offset, offset + limit).map(g => card(g, opts)), total: results.length, limit, offset, engine: opts.engine, year: opts.year,
      categories: categories.map(c => ({ ...c, count: available.filter(g => g.categoryId === c.id).length })), schedule: scheduleData ? { title: scheduleData.title, summary: scheduleData.summary, href: localHref('schedule'), applicability: applicability(scheduleData.applicability, opts) } : null });
  }
  function schedule(input = {}) {
    refresh(); if (!scheduleData) return null; const opts = options(input), s = scheduleData, matches = fits(s.applicability, opts);
    return publicCopy({ title: s.title, summary: s.summary, href: localHref('schedule'), applicability: applicability(s.applicability, opts), oilLife: matches ? {summary:s.oilLife.summary,bands:s.oilLife.bands.map(({id,label,miles,kilometers,description})=>({id,label,miles,kilometers,description})),notes:s.oilLife.notes||[]} : null,
      groups: matches ? s.groups.map(group => ({ id:group.id,title:group.title,timing:group.timing,description:group.description,items: group.items.filter(i => fits(guides.get(i.guideId).applicability, opts)).map(i => ({ guideId:i.guideId,task:i.task,detail:i.detail,href: localHref(i.guideId) })) })).filter(g => g.items.length) : [], notes: matches ? s.notes || [] : [], exceptions: matches ? s.exceptions || [] : [] });
  }
  function forRule(id, input = {}) { refresh(); const opts = options(input), matches = [...guides.values()].filter(g => (g.ruleIds || []).includes(id) && fits(g.applicability, opts)); return matches.length === 1 ? { id: matches[0].id, title: matches[0].title, href: localHref(matches[0].id) } : null; }
  function report() { refresh(); return { guides: guides.size, categories: categories.length, schedule: Boolean(scheduleData), errors: structuredClone(errors), guideIds: [...guides.keys()] }; }
  return { list, detail, schedule, forRule, report };
}

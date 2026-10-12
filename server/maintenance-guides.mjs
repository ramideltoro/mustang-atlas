import fs from 'node:fs';
import path from 'node:path';
import { ENGINE_OPTIONS, documentApplicability, engineFilter, isPublicDocument, selectThumbnail, sectionFor, stripPrivateMetadata } from './catalog.mjs';
import { internalizeMaintenanceReferences } from './maintenance.mjs';
import { createProcedureMediaCatalog } from './procedure-media.mjs';
import { selectWorkshopThumbnail } from './workshop-media.mjs';
import { SYSTEMS } from './taxonomy.mjs';

export const TASK_TYPES = ['maintenance', 'diagnostics', 'repair', 'overhaul'];
export const DIFFICULTIES = ['basic', 'intermediate', 'advanced', 'specialist'];
const systemIds = new Set(SYSTEMS.map(s => s.id));
// The published care guides predate workshop classification. Explicit IDs keep
// their meaning stable even if titles, artwork or referenced articles change.
const legacySystems = Object.fromEntries([
  ['engine', 'oil-service oil-level exhaust engine-air-filter spark-plugs accessory-belts ecoboost-charge-air-cooler-cleaning'],
  ['general', 'service-inspection'], ['cooling', 'cooling-check coolant-change cooling-pressure-leak-test'],
  ['suspension', 'tires wheel-hubs suspension stabilizer-bushings wheel-alignment wheel-tire-runout-matching'],
  ['brakes', 'brakes parking-brake brake-fluid brake-pressure-bleeding brake-pulsation-runout'],
  ['driveline', 'axle-inspection driveshaft halfshaft-boots axle-fluid driveline-vibration-runout'],
  ['transmission', 'automatic-level automatic-fluid manual-fluid clutch-hydraulic-bleeding transmission-cooler-backflush'],
  ['steering', 'steering'], ['climate', 'cabin-filter ac-odor-treatment ac-performance-leak-testing'],
  ['electrical', 'battery lights washers-wipers warning-lamps battery-testing-charging battery-drain-diagnosis'],
  ['body', 'body-drains-seals latches-locks corrosion-protection'], ['restraints', 'seatbelts-latches'],
].flatMap(([system, ids]) => ids.split(' ').map(id => [id, system])));
const legacyDiagnostics = new Set('cooling-pressure-leak-test battery-testing-charging brake-pulsation-runout battery-drain-diagnosis ac-performance-leak-testing driveline-vibration-runout'.split(' '));
const legacyRepairs = new Set('brake-pressure-bleeding wheel-alignment clutch-hydraulic-bleeding wheel-tire-runout-matching ac-odor-treatment ecoboost-charge-air-cooler-cleaning transmission-cooler-backflush corrosion-protection'.split(' '));
const legacyIntermediate = new Set('oil-service coolant-change spark-plugs accessory-belts automatic-fluid manual-fluid axle-fluid cabin-filter'.split(' '));
const legacySpecialists = new Set(['ac-performance-leak-testing']);

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const safeId = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(v);
const safeText = (v, max = 12000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/<\/?[a-z][^>]*>|<!--|(?:javascript|vbscript|data|file|blob)\s*:|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/i.test(v);
const textArray = (v = [], max = 40) => Array.isArray(v) && v.length <= max && v.every(t => safeText(t));
const idArray = (v = []) => Array.isArray(v) && v.length <= 150 && v.every(safeId) && new Set(v).size === v.length;
const fitValid = v => object(v) && Array.isArray(v.engines) && v.engines.length > 0 && v.engines.every(e => ENGINE_OPTIONS.includes(e)) && new Set(v.engines).size === v.engines.length && Array.isArray(v.years) && v.years.length > 0 && v.years.every(y => Number.isInteger(y) && y >= 1900 && y <= 2100) && (!v.equipment || safeText(v.equipment, 1000)) && (!v.market || safeText(v.market, 240));
const proseRows = (v = [], field = 'body') => Array.isArray(v) && v.length <= 60 && v.every(s => object(s) && safeText(s.title, 240) && safeText(s[field]));
const diagnosticRows = (v = []) => Array.isArray(v) && v.length <= 60 && v.every(s => object(s) && ['finding','meaning','next'].every(k => safeText(s[k], 4000)));
const procedureFitValid = v => v === undefined || (object(v) && (!('engines' in v) || (Array.isArray(v.engines) && v.engines.length > 0 && v.engines.every(e => ENGINE_OPTIONS.includes(e)) && new Set(v.engines).size === v.engines.length)) && (!('years' in v) || (Array.isArray(v.years) && v.years.length > 0 && v.years.every(y => Number.isInteger(y) && y >= 1900 && y <= 2100))) && (!('equipment' in v) || safeText(v.equipment,1000)) && (!('market' in v) || safeText(v.market,240)));
const localHref = id => '#/maintenance/' + id;
const normalizeSearch = value => String(value).normalize('NFKC').replace(/[\u2018\u2019\u02bc]/g,"'").replace(/[\u2010-\u2015\u2212]/g,'-').toLowerCase();
const searchable = g => normalizeSearch([g.title,g.summary,g.introduction,g.why,g.when.summary,...(g.searchTerms||[]),...(g.when.notes||[]),...(g.notes||[]),...(g.prepare||[]).flatMap(s=>[s.title,s.detail]),...(g.steps||[]).flatMap(s=>[s.title,s.body]),...(g.watchFor||[]).flatMap(s=>[s.title,s.body]),...(g.verification||[]).flatMap(s=>[s.title,s.body]),...(g.diagnostics||[]).flatMap(s=>[s.finding,s.meaning,s.next])].join(' '));
function procedureSection(d) {
  const section=sectionFor(d);
  // These two inherited MT82 chapter labels contain both gearbox variants.
  // Explicit 5.2L clutch procedures belong to the 3160 application documented
  // by G1809309; untitled shared articles retain their individual branches.
  if(['308-01','308-02'].includes(d.section_code)&&/\bMT82\b/i.test(section.title)) {
    const base=d.section_code==='308-01'?'Clutch':'Clutch controls';
    if(/\b5\.2\s*L\b/i.test(d.title))section.title=base+' - 6-Speed Manual Transmission - 3160';
    else if(!/\b(?:2\.3|3\.7|5\.0)\s*L\b/i.test(d.title))section.title=base+' - Manual transmission; follow the applicable gearbox branch';
  }
  return section;
}
function classification(g, documents) {
  const first = documents.get(g.procedures?.[0]?.documentId);
  return { systemId: g.systemId ?? legacySystems[g.id] ?? (systemIds.has(first?.system_id) ? first.system_id : 'general'),
    taskType: g.taskType ?? (legacyDiagnostics.has(g.id) ? 'diagnostics' : legacyRepairs.has(g.id) ? 'repair' : 'maintenance'),
    difficulty: g.difficulty ?? (legacySpecialists.has(g.id) ? 'specialist' : g.categoryId === 'advanced' ? 'advanced' : legacyIntermediate.has(g.id) ? 'intermediate' : 'basic') };
}
function enumFilter(value, allowed, name) {
  if (value === undefined || value === '' || value === 'all') return '';
  if (typeof value !== 'string' || !allowed.includes(value)) throw Object.assign(new Error(`Unsupported ${name} filter.`), { status: 400 });
  return value;
}
function requiresScheduleEvidence(g, scheduledIds) {
  if (scheduledIds.has(g.id) || g.when?.kind === 'scheduled') return true;
  // Numeric test durations elsewhere in a guide are not maintenance intervals.
  // Explicit recurrence and mileage/time due dates in timing prose are claims.
  const timing = [g.when?.summary, ...(g.when?.notes || [])].flatMap(text=>String(text||'').split(/(?<=[.!?])\s+(?=[A-Z])/)).filter(sentence=>!/(?:\bnot\s+(?:a\s+)?(?:routine|scheduled|periodic)\b|\bno\s+(?:routine|scheduled|fixed|periodic|mileage|calendar)\b)/i.test(sentence)).join(' ');
  return /\b(?:every|each)\s+(?:(?:\d[\d,.–— -]*|one|two|three|six|twelve)\s*)?(?:miles?|mi\b|kilomet(?:er|re)s?|km\b|months?|years?|weeks?|oil change|scheduled service)\b|\b(?:annually|yearly|monthly|weekly)\b|\b(?:at|after|within)\s+\d[\d,.–— -]*\s*(?:miles?|mi\b|kilomet(?:er|re)s?|km\b|months?|years?)\b/i.test(timing);
}
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
  const workshopFile = path.join(contentDir, 'workshop-guides.json');
  let identity, seed = {}, guides = new Map(), categories = [], errors = [], scheduleData = null, workshopGuideIds = new Set();
  function validRef(ref) { return object(ref) && safeId(ref.documentId) && typeof ref.sourceHash === 'string' && documents.get(ref.documentId)?.source_hash === ref.sourceHash; }
  function evidenceValid(ids, required) { return idArray(ids) && (!required || ids.length > 0) && ids.every(id => { const e = seed.evidence?.[id]; try { const url = new URL(e?.url); return safeText(e.title, 300) && url.protocol === 'https:' && url.hostname === 'www.fordservicecontent.com'; } catch { return false; } }); }
  function refresh() {
    const next = [fileIdentity(file),fileIdentity(workshopFile)].join('|'); if (identity === next) return;
    identity = next; seed = {}; guides = new Map(); categories = []; errors = []; scheduleData = null; workshopGuideIds = new Set();
    if (fileIdentity(file) === 'missing') return;
    try { if (fs.statSync(file).size > 8 * 1024 * 1024) throw new Error('oversized'); seed = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { errors.push({ scope: 'file', reason: 'invalid-json-or-size' }); return; }
    if (seed.version !== 1 || !safeText(seed.title, 240) || !safeText(seed.description, 3000) || !Array.isArray(seed.categories) || !Array.isArray(seed.guides)) { errors.push({ scope: 'file', reason: 'invalid-schema' }); seed = {}; return; }
    let additional = [];
    if (fileIdentity(workshopFile) !== 'missing') {
      try {
        if (fs.statSync(workshopFile).size > 32 * 1024 * 1024) throw new Error('oversized');
        const workshop = JSON.parse(fs.readFileSync(workshopFile, 'utf8'));
        if (workshop.version !== 1 || !Array.isArray(workshop.guides) || !object(workshop.evidence)) throw new Error('invalid-schema');
        additional = workshop.guides;
        seed.evidence = { ...(seed.evidence || {}) };
        for (const [id,e] of Object.entries(workshop.evidence)) {
          if (Object.hasOwn(seed.evidence,id) && JSON.stringify(seed.evidence[id]) !== JSON.stringify(e)) {
            seed.evidence[id] = null; errors.push({scope:'evidence',id,reason:'ambiguous-evidence'});
          } else seed.evidence[id] = e;
        }
      } catch { errors.push({scope:'workshop-file',reason:'invalid-json-schema-or-size'}); }
    }
    const seenCategories = new Set(), ambiguousCategories = new Set();
    for (const c of seed.categories) {
      if (!object(c) || !safeId(c.id) || !safeText(c.title, 240) || !safeText(c.description, 3000) || (c.icon && !safeId(c.icon))) { errors.push({ scope: 'category', reason: 'invalid-category' }); continue; }
      if (seenCategories.has(c.id)) { ambiguousCategories.add(c.id); errors.push({ scope: 'category', id: c.id, reason: 'duplicate-id' }); continue; }
      seenCategories.add(c.id); categories.push({ id: c.id, title: c.title, description: c.description, icon: c.icon || 'wrench' });
    }
    categories = categories.filter(c => !ambiguousCategories.has(c.id)); const categoryIds = new Set(categories.map(c => c.id));
    const seen = new Set(), scheduledIds = new Set((Array.isArray(seed.schedule?.groups) ? seed.schedule.groups : []).flatMap(group => (Array.isArray(group?.items) ? group.items : []).map(item => item?.guideId)));
    for (const [input,workshop] of [...seed.guides.map(g=>[g,false]),...additional.map(g=>[g,true])]) {
      const g = input;
      if (!object(g) || !safeId(g.id) || g.id === 'schedule') { errors.push({ scope: 'guide', reason: 'invalid-id' }); continue; }
      if (seen.has(g.id)) { guides.delete(g.id); errors.push({ scope: 'guide', id: g.id, reason: 'duplicate-id' }); continue; } seen.add(g.id);
      let reason;
      if (!safeText(g.title, 240) || !safeText(g.summary, 3000) || !categoryIds.has(g.categoryId) || !fitValid(g.applicability) || !idArray(g.ruleIds)) reason = 'invalid-metadata';
      else if ((workshop && ['systemId','taskType','difficulty'].some(k=>g[k]===undefined)) || (g.systemId !== undefined && !systemIds.has(g.systemId)) || (g.taskType !== undefined && !TASK_TYPES.includes(g.taskType)) || (g.difficulty !== undefined && !DIFFICULTIES.includes(g.difficulty)) || !textArray(g.searchTerms,60) || (g.searchTerms || []).some(t=>t.length>200)) reason = 'invalid-classification';
      else if (!safeText(g.introduction) || !safeText(g.why) || !object(g.when) || !safeText(g.when.summary) || (g.when.kind !== undefined && !['scheduled','condition-based','inspection'].includes(g.when.kind)) || !textArray(g.when.notes) || !proseRows(g.prepare, 'detail') || !proseRows(g.steps) || !proseRows(g.watchFor) || !proseRows(g.verification) || !diagnosticRows(g.diagnostics) || !textArray(g.notes) || !idArray(g.relatedGuideIds)) reason = 'invalid-prose';
      else if (!Array.isArray(g.sourceRefs) || !g.sourceRefs.length || g.sourceRefs.length > 150 || !g.sourceRefs.every(validRef) || new Set(g.sourceRefs.map(r => r.documentId)).size !== g.sourceRefs.length || !Array.isArray(g.evidence) || !evidenceValid(g.evidence,requiresScheduleEvidence(g,scheduledIds))) reason = 'invalid-or-stale-evidence';
      else if (!Array.isArray(g.procedures) || g.procedures.length > 100 || g.procedures.some(p => !object(p) || !safeId(p.documentId) || !safeText(p.purpose, 2000) || !procedureFitValid(p.applicability) || (p.mediaId !== undefined && !safeId(p.mediaId)) || !g.sourceRefs.some(r => r.documentId === p.documentId)) || new Set(g.procedures.map(p => p.documentId)).size !== g.procedures.length) reason = 'invalid-procedure';
      else if (g.hero && (!object(g.hero) || !g.sourceRefs.some(r => r.documentId === g.hero.documentId) || (g.hero.mediaId && !safeId(g.hero.mediaId)))) reason = 'invalid-hero';
      if (!reason && workshop && (!idArray(g.primaryDocumentIds) || !g.primaryDocumentIds?.length || g.primaryDocumentIds.some(id => !g.procedures.some(p => p.documentId === id)))) reason = 'invalid-primary-procedures';
      if (!reason && workshop) {
        // Supporting references such as lifting or surface cleaning do not
        // establish that this repair applies to a selected engine. Require a
        // compatible primary procedure for every advertised vehicle scope.
        const primary=g.procedures.filter(p=>g.primaryDocumentIds.includes(p.documentId));
        if(g.applicability.engines.some(engine=>g.applicability.years.some(year=>!primary.some(p=>{
          const a=documentApplicability(documents.get(p.documentId),engine),n=p.applicability||{};
          return a.matchesSelectedEngine&&(!n.engines||n.engines.includes(engine))&&(!n.years||n.years.includes(year));
        }))))reason='incompatible-primary-procedures';
      }
      if (!reason && g.procedures.some(p => p.mediaId !== undefined && !assetsFor(p.documentId).media.some(m => m.id === p.mediaId))) reason = 'missing-procedure-media';
      if (!reason && g.hero?.mediaId) { const row = assetsFor(g.hero.documentId); if (!row.media.some(m => m.id === g.hero.mediaId)) reason = 'missing-hero-media'; }
      if (reason) errors.push({ scope: 'guide', id: g.id, reason }); else { guides.set(g.id, {...g,...classification(g,documents)}); if(workshop)workshopGuideIds.add(g.id); }
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
    const narrowed = ref.applicability || {};
    const engines = fit.engines.filter(e => (!a.engines.length || a.engines.includes(e)) && (!narrowed.engines || narrowed.engines.includes(e)));
    const years = fit.years.filter(y => !narrowed.years || narrowed.years.includes(y));
    if (!engines.length || !years.length || !fits({engines,years},opts)) return null;
    // Vehicle equipment is separate from engine applicability. Keep an explicit
    // transmission/brake package visible instead of implying engine alone fits.
    const section=procedureSection(d);
    const sectionEquipment = /\b(?:MT82|6R80|(?:TR[- ]?)?3160)\b|\b(?:\d[- ]Piston|SVT Performance Package)\b/i.test(`${d.title} ${d.section_title}`) ? section.title + (d.title.includes('Vehicles With:') ? ': ' + d.title.split('Vehicles With:')[1].trim() : '') : null;
    const equipment = [...new Set([fit.equipment,narrowed.equipment,sectionEquipment].filter(Boolean))].join(' · ');
    const procedureApplicability = applicability({engines,years,...(equipment?{equipment}:{}),...(narrowed.market||fit.market?{market:narrowed.market||fit.market}:{})},opts);
    const parsed = { ...d, ...assetsFor(d.id) }; parsed.media = videoControls.filterControls(d, parsed.media);
    const preferred = ref.mediaId ? selectThumbnail({...parsed,media:parsed.media.filter(m=>m.id===ref.mediaId)},assetResolver) : null;
    const thumbnail = preferred || selectWorkshopThumbnail(parsed,assetResolver);
    return { documentId: d.id, title: d.title, purpose: ref.purpose, kind: d.kind, href: '#/document/' + d.id, section, engines, applicability: procedureApplicability, ...(preferred?{mediaId:ref.mediaId}:{}), thumbnail };
  }
  function thumbnail(g, opts) {
    if (!fits(g.applicability, opts)) return null;
    // Supporting access/reference procedures can illustrate a different job.
    // They are eligible as a hero only when the author explicitly selects one.
    const primary = g.primaryDocumentIds ? g.procedures.filter(p => g.primaryDocumentIds.includes(p.documentId)) : g.procedures;
    const candidates = [...(g.hero ? [g.hero] : []), ...primary];
    for (const ref of candidates) {
      const d = relatedDocument(ref, opts, g.applicability); if (!d) continue;
      if (d.thumbnail) return { ...d.thumbnail, documentTitle: d.title, engines: d.engines };
    }
    return null;
  }
  function card(g, opts) { return { id: g.id, title: g.title, summary: g.summary, categoryId: g.categoryId, systemId:g.systemId,taskType:g.taskType,difficulty:g.difficulty, interval: g.when.summary, ruleIds: g.ruleIds || [], href: localHref(g.id), applicability: applicability(g.applicability, opts), thumbnail: thumbnail(g, opts) }; }
  function publicCopy(value) {
    const clean=v=>Array.isArray(v)?v.map(clean):object(v)?Object.fromEntries(Object.entries(v).filter(([k])=>!['sourceRefs','evidence','source_hash','primaryDocumentIds'].includes(k)).map(([k,v])=>[k,clean(v)])):v;
    return stripPrivateMetadata(internalizeMaintenanceReferences(clean(structuredClone(value))));
  }
  function detail(id, input = {}) {
    refresh(); const g = guides.get(id); if (!g) return null; const opts = options(input);
    return publicCopy({ ...card(g, opts), introduction: g.introduction, why: g.why, when: g.when, prepare: g.prepare || [], steps: g.steps || [], watchFor: g.watchFor || [], notes: g.notes || [], diagnostics:g.diagnostics||[],verification:g.verification||[],
      procedures: fits(g.applicability, opts) ? g.procedures.map(p => relatedDocument(p, opts, g.applicability)).filter(Boolean) : [],
      relatedGuides: (g.relatedGuideIds || []).filter(id => id !== g.id && guides.has(id) && fits(guides.get(id).applicability, opts)).map(id => card(guides.get(id), opts)), sources: sourceList(g.evidence) });
  }
  function list(input = {}) {
    refresh(); const opts = options(input), q = normalizeSearch(input.q || '').trim().slice(0,500), category = String(input.category || '');
    const system=enumFilter(input.system,[...systemIds],'system'),taskType=enumFilter(input.taskType,TASK_TYPES,'task type'),difficulty=enumFilter(input.difficulty,DIFFICULTIES,'difficulty');
    const available = [...guides.values()].filter(g => fits(g.applicability, opts));
    const queryMatches = available.filter(g => (!category || g.categoryId === category) && (!q || q.split(/\s+/).every(word => searchable(g).includes(word))));
    const dimensions = {systemId:system,taskType,difficulty};
    const matchesDimensions = (g,except) => Object.entries(dimensions).every(([k,value])=>k===except||!value||g[k]===value);
    const results = queryMatches.filter(g=>matchesDimensions(g));
    const facet=(key,values)=>values.map(({id,title})=>({id,title,count:queryMatches.filter(g=>g[key]===id&&matchesDimensions(g,key)).length}));
    const title=id=>id[0].toUpperCase()+id.slice(1);
    const facets={systems:facet('systemId',SYSTEMS),taskTypes:facet('taskType',TASK_TYPES.map(id=>({id,title:title(id)}))),difficulties:facet('difficulty',DIFFICULTIES.map(id=>({id,title:title(id)})))};
    if ([input.limit, input.offset].some(value => value !== undefined && !/^\d+$/.test(String(value)))) throw Object.assign(new Error('Invalid maintenance pagination.'), { status: 400 });
    const limit = input.limit === undefined ? 100 : Math.max(0, Math.min(100, Number(input.limit))), offset = input.offset === undefined ? 0 : Math.max(0, Number(input.offset));
    if (!Number.isInteger(limit) || !Number.isInteger(offset) || offset > 1000000) throw Object.assign(new Error('Invalid maintenance pagination.'), { status: 400 });
    return publicCopy({ title: seed.title || 'Maintenance', description: seed.description || '', items: results.slice(offset, offset + limit).map(g => card(g, opts)), total: results.length, limit, offset, engine: opts.engine, year: opts.year,system,taskType,difficulty,facets,
      categories: categories.map(c => ({ ...c, count: available.filter(g => g.categoryId === c.id).length })), schedule: scheduleData ? { title: scheduleData.title, summary: scheduleData.summary, href: localHref('schedule'), applicability: applicability(scheduleData.applicability, opts) } : null });
  }
  function schedule(input = {}) {
    refresh(); if (!scheduleData) return null; const opts = options(input), s = scheduleData, matches = fits(s.applicability, opts);
    return publicCopy({ title: s.title, summary: s.summary, href: localHref('schedule'), applicability: applicability(s.applicability, opts), oilLife: matches ? {summary:s.oilLife.summary,bands:s.oilLife.bands.map(({id,label,miles,kilometers,description})=>({id,label,miles,kilometers,description})),notes:s.oilLife.notes||[]} : null,
      groups: matches ? s.groups.map(group => ({ id:group.id,title:group.title,timing:group.timing,description:group.description,items: group.items.filter(i => fits(guides.get(i.guideId).applicability, opts)).map(i => ({ guideId:i.guideId,task:i.task,detail:i.detail,href: localHref(i.guideId) })) })).filter(g => g.items.length) : [], notes: matches ? s.notes || [] : [], exceptions: matches ? s.exceptions || [] : [] });
  }
  function forRule(id, input = {}) { refresh(); const opts = options(input), matches = [...guides.values()].filter(g => (g.ruleIds || []).includes(id) && fits(g.applicability, opts)); return matches.length === 1 ? { id: matches[0].id, title: matches[0].title, href: localHref(matches[0].id) } : null; }
  function forDocument(documentId, input = {}) {
    refresh(); const opts=options(input);if(!documents.has(documentId))return [];
    return [...guides.values()].flatMap(g=>{
      if(!fits(g.applicability,opts))return [];
      const index=g.procedures.findIndex(p=>p.documentId===documentId);
      if(index<0||!relatedDocument(g.procedures[index],opts,g.applicability))return [];
      return [{g,index}];
    }).sort((a,b)=>a.index-b.index||a.g.title.localeCompare(b.g.title)).slice(0,8).map(({g})=>publicCopy(card(g,opts)));
  }
  function report() { refresh(); return { guides: guides.size, workshopGuides:[...workshopGuideIds].filter(id=>guides.has(id)).length, categories: categories.length, schedule: Boolean(scheduleData), errors: structuredClone(errors), guideIds: [...guides.keys()] }; }
  return { list, detail, schedule, forRule, forDocument, report };
}

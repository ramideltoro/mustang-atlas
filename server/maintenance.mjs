import fs from 'node:fs';
import path from 'node:path';
import { documentApplicability, engineFilter, isPublicDocument } from './catalog.mjs';

export const NORMAL_MAINTENANCE_HREF = '#/maintenance/schedule';
export function isNormalMaintenanceUrl(value) {
  try { const url = new URL(String(value).replaceAll('&amp;', '&')); return url.protocol === 'https:' && url.hostname === 'www.fordservicecontent.com' && url.searchParams.get('ProcUid') === 'G1649139'; } catch { return false; }
}
export function internalizeMaintenanceReferences(value) {
  if (typeof value === 'string') {
    if (isNormalMaintenanceUrl(value)) return NORMAL_MAINTENANCE_HREF;
    return value.replace(/\[([^\]]+)\]\((https:\/\/www\.fordservicecontent\.com\/[^\s)]+)\)/gi, (whole, label, url) => isNormalMaintenanceUrl(url) ? '[Normal maintenance schedule](' + NORMAL_MAINTENANCE_HREF + ')' : whole);
  }
  if (Array.isArray(value)) return value.map(internalizeMaintenanceReferences);
  if (value && typeof value === 'object') {
    const result = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, internalizeMaintenanceReferences(child)]));
    if (isNormalMaintenanceUrl(value.url) || isNormalMaintenanceUrl(value.href)) { if ('title' in result) result.title = 'Normal maintenance schedule'; if ('label' in result) result.label = 'Normal maintenance schedule'; }
    return result;
  }
  return value;
}

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
function patternMatches(pattern, value) { return !pattern || new RegExp(pattern, 'i').test(value); }

export function matchesMaintenanceRule(rule, doc) {
  const match = rule.matches || {};
  const title = clean(doc.title), section = doc.section_code ?? doc.section?.code ?? '';
  if (match.documentIds && !match.documentIds.includes(doc.id)) return false;
  if (match.kinds && !match.kinds.includes(doc.kind)) return false;
  if (match.sectionCodes && !match.sectionCodes.includes(section)) return false;
  if (!patternMatches(match.sectionPattern, section)) return false;
  if (!patternMatches(match.titlePattern, title)) return false;
  if (match.excludeTitlePattern && patternMatches(match.excludeTitlePattern, title)) return false;
  return Boolean(match.documentIds?.length || (match.titlePattern && (match.sectionCodes?.length || match.sectionPattern)));
}

export function createMaintenanceCatalog(db, { contentDir = path.resolve('content'), guideResolver = () => null } = {}) {
  const docs = new Map(db.prepare('SELECT id,title,kind,section_code,section_title,engines,source_hash FROM documents').all().map(doc => [doc.id, doc]));
  let seed = { rules: [], evidence: {} };
  try { seed = JSON.parse(fs.readFileSync(path.join(contentDir, 'maintenance.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const errors = [], seen = new Set();
  const rules = (seed.rules || []).filter(rule => {
    let valid = rule.id && !seen.has(rule.id) && ['scheduled', 'inspection', 'condition-based'].includes(rule.kind) && rule.title && rule.what && rule.when && rule.why && rule.applicability?.engines?.length && rule.matches;
    valid &&= Boolean(rule.evidence?.length && rule.evidence.every(id => seed.evidence?.[id]?.url?.startsWith('https://www.fordservicecontent.com/')));
    valid &&= Boolean(!rule.sourceRefs || rule.sourceRefs.every(ref => docs.get(ref.documentId)?.source_hash === ref.sourceHash));
    try { for (const key of ['sectionPattern', 'titlePattern', 'excludeTitlePattern']) if (rule.matches?.[key]) new RegExp(rule.matches[key], 'i'); } catch { valid = false; }
    if (!valid) errors.push({ ruleId: rule.id || null, reason: 'invalid-rule-or-stale-evidence' });
    seen.add(rule.id); return valid;
  });
  const candidates = new Map();
  for (const doc of docs.values()) candidates.set(doc.id, rules.filter(rule => matchesMaintenanceRule(rule, doc)));

  function forDocument(documentId, { engine = 'all', year = 2015 } = {}) {
    const doc = docs.get(documentId); if (!doc || !isPublicDocument(doc)) return null;
    const selected = engineFilter(engine), selectedYear = Number(year);
    if (!Number.isInteger(selectedYear)) throw Object.assign(new Error('Unsupported maintenance year.'), { status: 400 });
    const application = documentApplicability(doc, selected);
    if (!application.matchesSelectedEngine) return null;
    const items = [];
    for (const rule of candidates.get(documentId) || []) {
      const fit = rule.applicability;
      if (fit.years?.length && !fit.years.includes(selectedYear)) continue;
      if (selected !== 'all' && !fit.engines.includes(selected)) continue;
      const applicableEngines = fit.engines.filter(value => !application.engines.length || application.engines.includes(value));
      if (!applicableEngines.length) continue;
      // A mixed-scope article can show the explicitly labeled base-car schedule,
      // but no numeric interval is silently extended to an uncovered engine.
      const sources = [...new Set(rule.evidence)].map(id => ({ title: seed.evidence[id].title, url: seed.evidence[id].url }));
      const guide = guideResolver(rule.id, { engine: selected, year: selectedYear });
      items.push({ id: rule.id, title: rule.title, kind: rule.kind, what: rule.what, when: rule.when, why: rule.why,
        steps: rule.steps || [], notes: rule.notes || [],
        applicability: { ...fit, engines: selected === 'all' ? applicableEngines : [selected] }, sources: internalizeMaintenanceReferences(sources), ...(guide?.href ? { guideHref: guide.href } : {}) });
    }
    if (!items.length) return null;
    const scheduled = items.some(item => item.kind !== 'condition-based');
    return { documentId, title: 'Care and maintenance', scope: scheduled ? 'Use the timing below to plan routine care, and investigate a new problem sooner.' : 'Let the component’s condition guide the repair.', items };
  }
  function report() {
    const covered = [];
    for (const doc of docs.values()) { const result = forDocument(doc.id); if (result) covered.push({ documentId: doc.id, title: doc.title, ruleIds: result.items.map(item => item.id) }); }
    const publicDocuments = [...docs.values()].filter(isPublicDocument).length;
    return { rules: rules.length, documents: publicDocuments, coveredDocuments: covered.length, documentsWithoutGuidance: publicDocuments - covered.length, errors: structuredClone(errors), coverage: covered };
  }
  return { forDocument, report };
}

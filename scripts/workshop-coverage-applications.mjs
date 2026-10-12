// Private coverage can exclude a vehicle application whose missing operation has
// no honest text span. This does not relax the independent source-hash or span
// validation performed by each caller.
const engines = new Set(['2.3L', '3.7L', '5.0L', '5.2L']);
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 6000;
const validEngines = values => Array.isArray(values) && values.length > 0 && values.every(e => engines.has(e)) && new Set(values).size === values.length;

export function validateCoverageApplications(record, {guides, bound}) {
 const issues = [], counts = {supportedApplications: 0, coveredApplications: 0, pendingApplications: 0, unsupportedApplications: 0};
 const fail = (reason, extra = {}) => issues.push({reason, documentId: record.documentId, ...extra});
 const supplied = ['supportedApplications', 'unsupportedApplications', 'supportedEngines'].some(key => Object.hasOwn(record, key));
 if (!supplied) return {issues, counts, hasExclusions: false, hasSupport: false};
 const supported = record.supportedApplications, unsupported = record.unsupportedApplications;
 if (!Array.isArray(supported) || !supported.length || !Array.isArray(unsupported) || !unsupported.length) {
  fail('application-coverage-needs-supported-and-unsupported-scopes');
  return {issues, counts, hasExclusions: false, hasSupport: false};
 }
 const supportedSet = new Set(), excludedSet = new Set();
 for (const scope of unsupported) {
  if (!scope || !validEngines(scope.engines) || !nonempty(scope.scope) || !nonempty(scope.reason) || Object.hasOwn(scope, 'guideId') || (Object.hasOwn(scope, 'guideIds') && (!Array.isArray(scope.guideIds) || scope.guideIds.length))) {
   fail('invalid-unsupported-application'); continue;
  }
  for (const engine of scope.engines) {
   if (excludedSet.has(engine)) fail('duplicate-unsupported-application', {engine});
   excludedSet.add(engine);
  }
 }
 for (const scope of supported) {
  if (!scope || !validEngines(scope.engines) || !Array.isArray(scope.guideIds) || !scope.guideIds.every(safeId) || new Set(scope.guideIds).size !== scope.guideIds.length) {
   fail('invalid-supported-application'); continue;
  }
  for (const engine of scope.engines) {
   if (supportedSet.has(engine)) fail('duplicate-supported-application', {engine});
   if (excludedSet.has(engine)) fail('overlapping-application-scope', {engine});
   supportedSet.add(engine);
   const matches = scope.guideIds.filter(id => {
    const guide = guides.get(id);
    return record.guideIds?.includes(id) && bound(id, record.documentId) && guide?.primaryDocumentIds?.includes(record.documentId) && guide.applicability?.engines?.includes(engine);
   });
   if (matches.length) counts.coveredApplications++; else {
    counts.pendingApplications++;
    if (scope.guideIds.length || !(record.sections || []).some(s => s.status === 'pending')) fail('supported-application-without-compatible-guide', {engine});
   }
  }
  for (const id of scope.guideIds) {
   const guide = guides.get(id);
   if (!record.guideIds?.includes(id) || !bound(id, record.documentId) || !guide?.primaryDocumentIds?.includes(record.documentId) || !guide.applicability?.engines?.some(e => scope.engines.includes(e))) fail('supported-application-guide-unbound', {guideId: id});
  }
 }
 for (const id of record.guideIds || []) {
  const guide = guides.get(id);
  if (guide?.primaryDocumentIds?.includes(record.documentId) && guide.applicability?.engines?.some(e => excludedSet.has(e))) fail('guide-claims-unsupported-application', {guideId: id});
 }
 if (Object.hasOwn(record, 'supportedEngines') && (!validEngines(record.supportedEngines) || record.supportedEngines.length !== supportedSet.size || record.supportedEngines.some(e => !supportedSet.has(e)))) fail('supported-engine-projection-mismatch');
 if (record.status !== 'partial') fail('application-exclusion-needs-partial-status');
 counts.supportedApplications = supportedSet.size;
 counts.unsupportedApplications = excludedSet.size;
 return {issues, counts, hasExclusions: excludedSet.size > 0, hasSupport: supportedSet.size > 0};
}

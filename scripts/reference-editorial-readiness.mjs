import {clarifyStartupPreparation} from './reference-editorial-startup.mjs';

// Publication checks report needed edits; only a reviewed revision can change prose.
export function startupReadinessIssues(document, guide) {
 const changes=clarifyStartupPreparation(structuredClone(guide),{
  kind:document.kind,
  supportingSourceRefs:guide.supportingSourceRefs,
 });
 return changes.length ? ['Source-bound startup clarification required before publication: '+changes.map(c=>c.item).join(', ')] : [];
}

export function supervisoryReadinessIssues(documentId, artifactSha, clearanceMap) {
 return clearanceMap?.clearances?.[documentId]?.[artifactSha]
  ? [] : ['Pending exact-artifact supervisory clearance'];
}

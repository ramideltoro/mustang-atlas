import fs from 'node:fs';
import path from 'node:path';
import {openDb} from '../server/db.mjs';
import {createMaintenanceGuideCatalog,TASK_TYPES,DIFFICULTIES} from '../server/maintenance-guides.mjs';
import {createMaintenanceCatalog} from '../server/maintenance.mjs';
import {createAssetQualityStore} from '../server/asset-quality.mjs';
import {ENGINE_OPTIONS,documentApplicability,isPublicDocument} from '../server/catalog.mjs';
import {SYSTEMS} from '../server/taxonomy.mjs';
const contentDir=path.resolve('content'),dataDir=path.resolve('data'),db=openDb({readOnly:true});
const quality=createAssetQualityStore({dataDir}),catalog=createMaintenanceGuideCatalog(db,{contentDir,assetResolver:m=>quality.resolve(m)}),care=createMaintenanceCatalog(db,{contentDir,guideResolver:(id,opts)=>catalog.forRule(id,opts)});
const readOptional=name=>{const file=path.join(contentDir,name);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;};
const seed=readOptional('maintenance-guides.json'),workshop=readOptional('workshop-guides.json'),originals=new Map([...(seed?.guides||[]),...(workshop?.guides||[])].map(g=>[g.id,g]));
const docs=new Map(db.prepare('SELECT id,title,kind,system_id,engines,section_code,section_title,source_hash,media,length(text) text_length FROM documents').all().filter(isPublicDocument).map(d=>[d.id,d]));
const report=catalog.report(),issues=[...report.errors];let articleLinks=0,thumbnails=0,careLinks=0,engineChecks=0,mappedRules=0;
const ruleIds=new Set((readOptional('maintenance.json')?.rules||[]).map(r=>r.id));
for(const id of ruleIds){if(catalog.forRule(id))mappedRules++;else issues.push({ruleId:id,reason:'missing-or-ambiguous-rule-guide'});}
for(const guide of originals.values())for(const id of guide.ruleIds||[])if(!ruleIds.has(id))issues.push({id:guide.id,ruleId:id,reason:'unknown-care-rule'});
if(!report.guides||!report.schedule)issues.push({reason:'empty-guides-or-schedule'});
function mediaCheck(media,where){if(!media)return;thumbnails++;const owner=docs.get(media.documentId);if(!owner||!JSON.parse(owner.media).some(m=>m.id===media.id))issues.push({where,reason:'foreign-media'});if(!/^\/media\/[a-f0-9]{64}\.(?:png|jpe?g|gif|webp|svg)$/.test(media.url)||!fs.existsSync(path.join(dataDir,media.url.slice(1))))issues.push({where,reason:'invalid-media-file'});}
function publicCheck(value,where){if(/sourceHash|sourceRefs|source_path|sourcePath|"evidence"|ProcUid=G1649139/.test(JSON.stringify(value)))issues.push({where,reason:'private-or-external-normal-reference'});}
function allCards(input){const cards=[];let page;do{page=catalog.list({...input,limit:100,offset:cards.length});cards.push(...page.items);}while(cards.length<page.total&&page.items.length);return{...page,items:cards};}
for(const id of report.guideIds){
 const g=catalog.detail(id),original=originals.get(id);publicCheck(g,id);mediaCheck(g.thumbnail,id);
 for(const key of ['introduction','why','when','prepare','steps','watchFor','notes','diagnostics','verification'])if(JSON.stringify(g[key])!==JSON.stringify(original[key]??[]))issues.push({id,reason:'authored-content-changed',key});
 if(!SYSTEMS.some(s=>s.id===g.systemId)||!TASK_TYPES.includes(g.taskType)||!DIFFICULTIES.includes(g.difficulty))issues.push({id,reason:'invalid-public-classification'});
 for(const p of g.procedures){articleLinks++;if(!docs.has(p.documentId)||p.href!=='#/document/'+p.documentId)issues.push({id,reason:'broken-procedure-link'});mediaCheck(p.thumbnail,id+':'+p.documentId);if(!p.applicability||!p.applicability.engines.every(e=>g.applicability.engines.includes(e))||!p.applicability.years.every(y=>g.applicability.years.includes(y)))issues.push({id,target:p.documentId,reason:'procedure-scope-broadened'});}
 for(const link of g.relatedGuides)if(!catalog.detail(link.id)||link.href!=='#/maintenance/'+link.id)issues.push({id,reason:'broken-related-guide'});
}
for(const engine of ['all',...ENGINE_OPTIONS]){
 const list=allCards({engine});publicCheck(list,engine);
 if(list.categories.reduce((n,c)=>n+c.count,0)!==list.total)issues.push({engine,reason:'category-count-mismatch'});
 for(const values of Object.values(list.facets))if(values.reduce((n,v)=>n+v.count,0)!==list.total)issues.push({engine,reason:'facet-count-mismatch'});
 if(new Set(list.items.map(g=>g.id)).size!==list.total)issues.push({engine,reason:'pagination-gap-or-duplicate'});
 for(const g of list.items){engineChecks++;if(g.thumbnail&&!documentApplicability(docs.get(g.thumbnail.documentId),engine).matchesSelectedEngine)issues.push({id:g.id,engine,reason:'incompatible-hero',target:g.thumbnail.documentId});if(!g.applicability.matchesSelectedEngine)issues.push({id:g.id,engine,reason:'incompatible-guide'});const detail=catalog.detail(g.id,{engine});for(const p of detail.procedures)if(!documentApplicability(docs.get(p.documentId),engine).matchesSelectedEngine||!p.applicability.matchesSelectedEngine||!p.applicability.matchesSelectedYear)issues.push({id:g.id,engine,reason:'incompatible-procedure',target:p.documentId});}
 const schedule=catalog.schedule({engine});publicCheck(schedule,'schedule:'+engine);if(schedule){if(!schedule.applicability.matchesSelectedEngine&&(schedule.groups.length||schedule.oilLife||schedule.notes.length||schedule.exceptions.length))issues.push({engine,reason:'schedule-scope-leak'});for(const group of schedule.groups)for(const item of group.items)if(!catalog.detail(item.guideId,{engine})||item.href!=='#/maintenance/'+item.guideId)issues.push({engine,reason:'broken-schedule-guide'});}
}
for(const d of docs.values()){const value=care.forDocument(d.id);if(!value)continue;publicCheck(value,d.id);for(const item of value.items){if(item.guideHref){careLinks++;if(!catalog.detail(item.guideHref.split('/').at(-1)))issues.push({id:d.id,reason:'broken-care-guide'});}}}
const manifest=readOptional('workshop-coverage.json');let coverage={available:false};
if(manifest){
 coverage={available:true,documents:0,covered:0,partial:0,pending:0,pointer:0,unsupported:0,reserved:0,coveredSections:0,pendingSections:0,unsupportedSections:0,missingDocuments:[]};
 if(manifest.version!==1||!Array.isArray(manifest.documents))issues.push({reason:'invalid-coverage-manifest'});
 else{const seen=new Set();for(const record of manifest.documents){
  const d=docs.get(record.documentId);coverage.documents++;
  if(seen.has(record.documentId))issues.push({documentId:record.documentId,reason:'duplicate-coverage-document'});seen.add(record.documentId);
  if(!d||d.source_hash!==record.sourceHash){issues.push({documentId:record.documentId,reason:'stale-coverage-source'});continue;}
  if(!['covered','partial','pending','pointer','unsupported','reserved'].includes(record.status)){issues.push({documentId:d.id,reason:'invalid-coverage-status'});continue;}coverage[record.status]++;
  const ids=record.guideIds||[];if(record.status==='covered'&&!ids.length)issues.push({documentId:d.id,reason:'covered-without-guide'});
  if(record.status==='unsupported'&&(!record.reason?.trim()||ids.length))issues.push({documentId:d.id,reason:'unsupported-coverage-needs-reason-and-no-guide'});
  const destinations=record.status==='pointer'?(record.destinationIds||[]):[d.id];
  if(record.status==='pointer'&&(!destinations.length||new Set(destinations).size!==destinations.length||destinations.some(id=>id===d.id||!docs.has(id))))issues.push({documentId:d.id,reason:'invalid-pointer-destinations'});
  for(const id of ids){
   const guide=catalog.detail(id),refs=originals.get(id)?.sourceRefs||[],bound=destinations.some(target=>refs.some(ref=>ref.documentId===target&&ref.sourceHash===docs.get(target)?.source_hash));
   if(!guide||!bound)issues.push({documentId:d.id,guideId:id,reason:'coverage-guide-unavailable-or-unbound'});
   if(record.status==='pointer'&&guide){const engines=documentApplicability(d).engines;if(engines.length&&!engines.some(engine=>guide.applicability.engines.includes(engine)))issues.push({documentId:d.id,guideId:id,reason:'pointer-guide-engine-mismatch'});}
  }
  const sectionIds=new Set();for(const section of record.sections||[]){
   if(!section.id||sectionIds.has(section.id))issues.push({documentId:d.id,reason:'duplicate-or-missing-section-id'});sectionIds.add(section.id);
   if(!Number.isInteger(section.start)||!Number.isInteger(section.end)||section.start<0||section.end<=section.start||section.end>d.text_length)issues.push({documentId:d.id,sectionId:section.id,reason:'invalid-section-text-range'});
   if(section.status==='covered'){coverage.coveredSections++;if(!ids.includes(section.guideId)||!catalog.detail(section.guideId))issues.push({documentId:d.id,sectionId:section.id,reason:'covered-section-without-guide'});}else if(section.status==='pending')coverage.pendingSections++;else if(section.status==='unsupported'){coverage.unsupportedSections++;if(section.guideId||!section.reason?.trim())issues.push({documentId:d.id,sectionId:section.id,reason:'unsupported-section-needs-reason-and-no-guide'});}else issues.push({documentId:d.id,sectionId:section.id,reason:'invalid-section-status'});
   if(record.status==='covered'&&section.status!=='covered')issues.push({documentId:d.id,reason:'covered-document-has-uncovered-section'});
   if(record.status==='unsupported'&&section.status!=='unsupported')issues.push({documentId:d.id,reason:'unsupported-document-has-supported-section'});
  }
  const exclusions=(record.sections||[]).filter(s=>s.status==='unsupported');
  if(record.status==='partial'&&(!exclusions.length||!(record.sections||[]).some(s=>s.status==='covered'||s.status==='pending')))issues.push({documentId:d.id,reason:'partial-document-needs-supported-and-unsupported-spans'});
  if(exclusions.length&&!['partial','unsupported'].includes(record.status))issues.push({documentId:d.id,reason:'unsupported-sections-need-partial-or-unsupported-status'});
  for(const excluded of exclusions)for(const section of record.sections||[])if(section!==excluded&&section.start<excluded.end&&section.end>excluded.start)issues.push({documentId:d.id,sectionId:excluded.id,otherSectionId:section.id,reason:'unsupported-section-overlaps-other-scope'});
 }
 coverage.missingDocuments=[...docs.values()].filter(d=>['repair','diagnosis'].includes(d.kind)&&!seen.has(d.id)).map(d=>d.id);
 if(coverage.missingDocuments.length)issues.push({reason:'technical-documents-missing-from-coverage',count:coverage.missingDocuments.length});
 }
}
db.close();const result={guides:report.guides,workshopGuides:report.workshopGuides,categories:report.categories,schedule:report.schedule,articleLinks,thumbnails,careGuideLinks:careLinks,mappedRules,engineChecks,coverage,issues};fs.mkdirSync('work',{recursive:true});fs.writeFileSync('work/maintenance-guides-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,issues:issues.slice(0,20)},null,2));if(issues.length)process.exitCode=1;

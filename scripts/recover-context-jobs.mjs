import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
import {groupContextDocuments} from './context-planning.mjs';
import {selectContextOverviews, selectContextTerms} from './context-evidence.mjs';
import {validateAuthoredContext} from './context-validation.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(value);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const jsonValue = value => JSON.parse(JSON.stringify(value));
const unique = values => new Set(values).size === values.length;
function readJson(filename) {
  if (fs.statSync(filename).size > 32 * 1024 * 1024) throw Error('JSON file exceeds 32 MiB');
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}
function excerpt(doc, max) {
  const value = doc.text.replace(/\n{3,}/g, '\n\n');
  return value.length <= max ? value : value.slice(0, Math.floor(max * .78)) + '\n[... excerpt omitted ...]\n' + value.slice(-Math.floor(max * .22));
}

// Reconstruct the author input, not just its topic membership. A saved batch did
// not carry source hashes; recovery therefore requires both exact evidence
// equality and the current plan's hash-bound fingerprint. Source DB is read-only.
export function prepareRecoveryGroups(documents, glossary) {
  const groups = groupContextDocuments(documents);
  for (const group of groups.values()) {
    const matches = selectContextOverviews(group.documents, documents);
    const ordered = [...group.documents].sort((a, b) => (a.kind === 'overview' ? -1 : 0) - (b.kind === 'overview' ? -1 : 0));
    const terms = selectContextTerms(group.documents, glossary).map(t => ({id:t.id, name:t.name, definition:t.definition, details:t.details}));
    group.input = {
      topicId:group.id, sharedAcrossDocuments:ordered.length > 1,
      documents:ordered.map(d => ({documentId:d.id, title:d.title, kind:d.kind, system:d.system_id, section:d.section_title, engines:JSON.parse(d.engines), text:excerpt(d, Math.max(1800, Math.floor(8500 / Math.sqrt(ordered.length))))})),
      relatedOverviews:matches.map(d => ({documentId:d.id, title:d.title, section:d.section_title, text:excerpt(d, 4500)})),
      glossary:terms,
    };
    group.evidenceIds = new Set([...ordered, ...matches].map(d => d.id));
    group.termIds = new Set(terms.map(t => t.id));
    group.fingerprint = hash(JSON.stringify({editorialVersion:2, input:group.input, sourceHashes:[...ordered, ...matches].map(d => [d.id, d.source_hash])}));
  }
  return new Map([...groups.values()].map(group => [group.id, group]));
}

function assertWorkerStopped(jobsDir) {
  const lock = path.join(jobsDir, 'worker.pid');
  if (!fs.existsSync(lock)) return;
  const pid = Number(fs.readFileSync(lock, 'utf8').trim());
  if (!Number.isSafeInteger(pid) || pid <= 0) throw Error('Cannot establish worker state from worker.pid; refusing apply');
  try { process.kill(pid, 0); }
  catch (error) { if (error.code === 'ESRCH') return; throw Error('Cannot establish worker state; refusing apply'); }
  throw Error('Authoring worker is alive; refusing apply');
}

function decodeBatch(input, output) {
  if (!object(input) || !Array.isArray(input.topics) || !input.topics.length
    || !Array.isArray(input.relatedOverviewEvidence) || !object(output) || !Array.isArray(output.topics)
    || output.topics.length !== input.topics.length) throw Error('invalid-batch-shape');
  const inputIds = input.topics.map(topic => topic?.topicId);
  const outputIds = output.topics.map(topic => topic?.id);
  const evidenceIds = input.relatedOverviewEvidence.map(doc => doc?.documentId);
  if (![...inputIds, ...outputIds, ...evidenceIds].every(safeId) || !unique(inputIds) || !unique(outputIds)
    || !unique(evidenceIds) || outputIds.some(id => !inputIds.includes(id))) throw Error('invalid-batch-identities');
  const evidence = new Map(input.relatedOverviewEvidence.map(doc => [doc.documentId, doc]));
  return input.topics.map(topic => {
    if (!Array.isArray(topic.relatedOverviews) || !unique(topic.relatedOverviews)
      || topic.relatedOverviews.some(id => !safeId(id) || !evidence.has(id))) throw Error('invalid-batch-evidence');
    return {
      input:{...topic, relatedOverviews:topic.relatedOverviews.map(id => evidence.get(id))},
      topic:output.topics.find(value => value.id === topic.topicId),
    };
  });
}

function writeMissingCheckpoint(filename, value) {
  const temporary = filename + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {flag:'wx'});
    // link creates a complete checkpoint atomically without replacing a file
    // another process may have created since our existence check.
    fs.linkSync(temporary, filename);
    return true;
  } catch (error) { if (error.code === 'EEXIST') return false; throw error; }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export function recoverContextJobs({jobsDir = 'work/topic-context-jobs', dataDir = process.env.DATA_DIR || 'data', contentDir = 'content', apply = false} = {}) {
  jobsDir = path.resolve(jobsDir);
  if (apply) assertWorkerStopped(jobsDir);
  const planFile = path.join(jobsDir, 'plan.json');
  const planBytes = fs.readFileSync(planFile);
  if (planBytes.length > 32 * 1024 * 1024) throw Error('Plan exceeds 32 MiB');
  const plan = JSON.parse(planBytes);
  if (!Array.isArray(plan) || !unique(plan.map(group => group?.id)) || plan.some(group => !object(group)
    || !safeId(group.id) || !/^[a-f0-9]{64}$/.test(group.fingerprint)
    || !Array.isArray(group.documents) || !group.documents.length || !group.documents.every(safeId) || !unique(group.documents))) throw Error('Invalid current plan');
  const db = new DatabaseSync(path.resolve(dataDir, 'atlas.sqlite'), {readOnly:true});
  let documents;
  try { documents = db.prepare('SELECT * FROM documents ORDER BY id').all(); }
  finally { db.close(); }
  const glossary = readJson(path.resolve(contentDir, 'glossary.json')).terms;
  if (!Array.isArray(glossary)) throw Error('Invalid current glossary');
  const reconstructed = prepareRecoveryGroups(documents, glossary);
  const current = new Map();
  const report = {apply, planTopics:plan.length, currentMatchingGroups:0, planMismatches:[], batches:0, recoverableIds:[], recoveredIds:[], existingCheckpoints:0, rejected:{}, invalidTopics:[]};
  const reject = reason => { report.rejected[reason] = (report.rejected[reason] || 0) + 1; };
  for (const entry of plan) {
    const group = reconstructed.get(entry.id);
    if (!group || group.fingerprint !== entry.fingerprint || !isDeepStrictEqual(group.documents.map(doc => doc.id), entry.documents)) report.planMismatches.push(entry.id);
    else current.set(entry.id, group);
  }
  report.currentMatchingGroups = current.size;
  const acceptedDir = path.join(jobsDir, 'accepted');
  const existing = new Set();
  for (const id of current.keys()) if (fs.existsSync(path.join(acceptedDir, id + '.json'))) existing.add(id);
  report.existingCheckpoints = existing.size;
  const candidates = new Map();
  const batchNames = fs.readdirSync(jobsDir, {withFileTypes:true}).filter(entry => entry.isDirectory() && /^batch-\d+-topic-[a-f0-9]{16}$/.test(entry.name)).map(entry => entry.name).sort().reverse();
  for (const batch of batchNames) {
    report.batches++;
    let entries;
    try { entries = decodeBatch(readJson(path.join(jobsDir, batch, 'input.json')), readJson(path.join(jobsDir, batch, 'output.json'))); }
    catch { reject('unreadable-or-invalid-batch'); continue; }
    for (const entry of entries) {
      const group = current.get(entry.input.topicId);
      if (!group) { reject('not-in-current-matching-plan'); continue; }
      if (existing.has(group.id) || candidates.has(group.id)) continue;
      if (!isDeepStrictEqual(entry.input, jsonValue(group.input))) { reject('current-evidence-mismatch'); continue; }
      try { validateAuthoredContext(entry.topic, group); }
      catch (error) { reject('invalid-authored-context'); report.invalidTopics.push({id:group.id, reason:error.message}); continue; }
      candidates.set(group.id, {fingerprint:group.fingerprint, topic:entry.topic});
    }
  }
  report.recoverableIds = [...candidates.keys()];
  if (apply && candidates.size) {
    assertWorkerStopped(jobsDir);
    if (!fs.readFileSync(planFile).equals(planBytes)) throw Error('Current plan changed during recovery; refusing apply');
    fs.mkdirSync(acceptedDir, {recursive:true});
    for (const [id, checkpoint] of candidates) {
      assertWorkerStopped(jobsDir);
      if (writeMissingCheckpoint(path.join(acceptedDir, id + '.json'), checkpoint)) report.recoveredIds.push(id);
    }
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--apply') options.apply = true;
      else if (['--jobs-dir', '--data-dir', '--content-dir'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) {
        options[{'--jobs-dir':'jobsDir', '--data-dir':'dataDir', '--content-dir':'contentDir'}[args[i]]] = args[++i];
      } else throw Error('Usage: node scripts/recover-context-jobs.mjs [--apply] [--jobs-dir PATH] [--data-dir PATH] [--content-dir PATH]');
    }
    console.log(JSON.stringify(recoverContextJobs(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

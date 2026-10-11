import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAuthoredContext} from '../scripts/context-validation.mjs';

export const sampleContext = (id = 'topic-example') => ({
  id, title:'How the ignition coil supplies a spark',
  summary:'An ignition coil changes electrical energy into the high voltage needed at a spark plug. Its role connects the engine controller to the combustion event inside the cylinder.',
  sections:['54501588-energy-to-spark', 'Circuit_Path', '2Reading'].map(sectionId => ({
    id:sectionId, title:'Following the energy path',
    body:'The controller coordinates the coil with the engine cycle. Electrical energy builds in the coil before its magnetic field collapses and produces the spark voltage. The diagram separates the control connection from the power supply so each circuit has a clear purpose.',
  })),
  relatedTermIds:['ignition-coil'], sourceDocumentIds:['GPRIMARY'],
});
const group = {id:'topic-example', documents:[{id:'GPRIMARY'}], evidenceIds:new Set(['GPRIMARY', 'GOVERVIEW']), termIds:new Set(['ignition-coil'])};

test('authored context accepts all API-safe section IDs, including numeric prefixes', () => {
  const topic = sampleContext();
  assert.equal(validateAuthoredContext(topic, group), topic);
});
test('authored context rejects malformed shapes, duplicate or unsafe identifiers, and API bounds', () => {
  const changes = [
    t => { t.title = null; }, t => { t.title = 'x'.repeat(241); }, t => { t.summary = 'x'.repeat(2001); },
    t => { t.sections = {}; }, t => { t.sections.pop(); }, t => { t.sections[0] = null; },
    t => { t.sections[0].id = t.sections[1].id; }, t => { t.sections[0].id = '../escape'; },
    t => { t.sections[0].id = 'a'.repeat(161); }, t => { t.sections[0].title = ' '; },
    t => { t.sections[0].body = 'x'.repeat(24001); }, t => { t.sourceDocumentIds = 'GPRIMARY'; },
    t => { t.relatedTermIds = null; }, t => { t.id = 'different'; },
  ];
  for (const mutate of changes) { const topic = sampleContext(); mutate(topic); assert.throws(() => validateAuthoredContext(topic, group)); }
});
test('authored context rejects markup, protocols, and control characters wherever prose appears', () => {
  for (const unsafe of ['<script>bad</script>', '<!-- comment -->', '<!DOCTYPE html>', '<?xml test?>', 'javascript :alert(1)', 'vbscript:bad', 'blob:bad', 'data:bad', 'file:bad', 'https://example.com', 'ftp://example.com', 'hidden\u0001control', 'hidden\u007fcontrol']) {
    for (const field of ['title', 'summary', 'sectionTitle', 'body']) {
      const topic = sampleContext();
      if (field === 'sectionTitle') topic.sections[0].title += unsafe;
      else if (field === 'body') topic.sections[0].body += unsafe;
      else topic[field] += unsafe;
      assert.throws(() => validateAuthoredContext(topic, group), `${field}: ${unsafe}`);
    }
  }
});
test('authored context requires unique own-whitelist references and at least one primary document', () => {
  for (const [field, value] of [
    ['sourceDocumentIds', []], ['sourceDocumentIds', ['GOVERVIEW']], ['sourceDocumentIds', ['GPRIMARY', 'GPRIMARY']],
    ['sourceDocumentIds', ['GPRIMARY', 'GFOREIGN']], ['sourceDocumentIds', ['GPRIMARY', '../bad']],
    ['relatedTermIds', ['ignition-coil', 'ignition-coil']], ['relatedTermIds', ['foreign-term']],
  ]) { const topic = sampleContext(); topic[field] = value; assert.throws(() => validateAuthoredContext(topic, group)); }
  const topic = sampleContext(); topic.sourceDocumentIds.push('GOVERVIEW'); topic.relatedTermIds = [];
  assert.equal(validateAuthoredContext(topic, group), topic);
});
test('authoring policy retains substantial prose and rejects boilerplate', () => {
  const short = sampleContext(); short.sections.forEach(s => { s.body = 'Too short.'; });
  assert.throws(() => validateAuthoredContext(short, group), /substantial/);
  const long = sampleContext(); long.sections[0].body = 'word '.repeat(451);
  assert.throws(() => validateAuthoredContext(long, group), /substantial/);
  const boilerplate = sampleContext(); boilerplate.summary += ' This is a placeholder.';
  assert.throws(() => validateAuthoredContext(boilerplate, group), /Boilerplate/);
});

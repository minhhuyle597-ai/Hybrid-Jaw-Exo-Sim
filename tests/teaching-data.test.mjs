import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const views = load('../public/data/views.json');
const textbook = load('../public/data/textbook.json');
const evidence = load('../public/data/evidence.json');
const sources = load('../public/data/source_catalog.json');
const phases = load('../public/data/teaching-phases.json');
const quiz = load('../public/data/quiz.json');

const sourceIds = new Set(sources.sources.map((source) => source.id));
const textbookGroups = new Set(Object.keys(textbook.groups));
const muscleNames = new Set(views.muscles.map((muscle) => muscle.name));

test('every model actuator has a textbook mapping', () => {
  assert.equal(Object.keys(textbook.muscles).length, 24);
  for (const name of muscleNames) {
    const entry = textbook.muscles[name];
    assert.ok(entry, `missing mapping: ${name}`);
    assert.equal(entry.textbook_status, 'textbook_confirmed', `${name} is not textbook_confirmed`);
    assert.ok(entry.textbook_ref?.page, `${name} has no verified page`);
  }
});

test('every textbook mapping has a known group and evidence record', () => {
  for (const [name, entry] of Object.entries(textbook.muscles)) {
    assert.ok(textbookGroups.has(entry.group), `${name} has unknown group ${entry.group}`);
    assert.ok(evidence.groups[entry.group], `${entry.group} has no evidence record`);
  }
});

test('evidence source ids resolve to the source catalog', () => {
  for (const group of Object.values(evidence.groups)) {
    for (const id of group.source_ids || []) assert.ok(sourceIds.has(id), `unknown source: ${id}`);
    for (const claim of group.claims || []) {
      for (const id of claim.source_ids || []) assert.ok(sourceIds.has(id), `unknown claim source: ${id}`);
    }
  }
  for (const topic of evidence.topics) {
    for (const id of topic.source_ids || []) assert.ok(sourceIds.has(id), `unknown topic source: ${id}`);
    for (const group of topic.groups) assert.ok(textbookGroups.has(group), `unknown topic group: ${group}`);
  }
});

test('teaching phases are ordered and cover the recorded duration', () => {
  const ordered = [...phases.phases].sort((a, b) => a.start_s - b.start_s);
  assert.equal(ordered[0].start_s, 0);
  assert.ok(Math.abs(ordered.at(-1).end_s - views.frame_count / views.fps) < 0.05);
  for (let i = 1; i < ordered.length; i += 1) {
    assert.ok(ordered[i].start_s <= ordered[i - 1].end_s, 'teaching phases overlap or leave a gap');
  }
});

test('quiz answers point to an existing option', () => {
  for (const question of quiz.questions) {
    assert.ok(Number.isInteger(question.answer));
    assert.ok(question.answer >= 0 && question.answer < question.options.length);
  }
});

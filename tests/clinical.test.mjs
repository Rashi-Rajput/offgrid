import assert from 'node:assert/strict';
import test from 'node:test';
import { match, protocols } from '../dist/clinical.js';

test('all index entries have short steps, source links and unique IDs', () => {
  assert.equal(protocols.length, 5);
  assert.equal(new Set(protocols.map(p => p.id)).size, 5);
  for (const protocol of protocols) {
    assert.match(protocol.source, /^https:\/\/www\.(nols\.edu|redcross\.org)\//);
    assert.equal(match(protocol.title), protocol);
    for (const step of protocol.steps) {
      assert.ok(step.instruction.split(/\s+/).length < 15, step.instruction);
    }
  }
});

test('matches scoped adult training descriptions', () => {
  for (const [text, id] of [
    ['My friend fell on the trail, his lower leg is bent weird and swelling fast.', 'fracture'],
    ['Her arm is bleeding heavily.', 'bleeding'],
    ['Bleeding won’t stop', 'bleeding'],
    ['Soaked clothes and shivering', 'hypothermia'],
    ['I scalded my hand', 'burn'],
    ["He isn't breathing and won't wake up", 'cpr']
  ]) assert.equal(match(text)?.id, id, text);
});

test('abstains on ambiguous, negated or unsupported inputs', () => {
  for (const text of [
    '', null, 'broken trekking pole', 'unresponsive but breathing normally',
    'not unresponsive and not breathing', 'no severe bleeding',
    'He was unresponsive and stopped breathing, now awake',
    'severe bleeding with a broken ankle', 'the chemical burn is painful',
    'unresponsive child who is only gasping', 'he feels dizzy', 'old skull fracture'
  ]) assert.equal(match(text), null, text);
});

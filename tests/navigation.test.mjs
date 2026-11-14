// Unit tests for the menu's helpers. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pushRecent, parseRecent, matches, MAX_RECENT } from '../src/assets/js/nav-core.js';

test('menu: recently used list keeps the newest first, without repeats', () => {
  assert.deepEqual(pushRecent([], 'merge-pdf'), ['merge-pdf']);
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
  assert.deepEqual(pushRecent(['a', 'b', 'c', 'd', 'e'], 'f'), ['f', 'a', 'b', 'c', 'd']);
  assert.equal(pushRecent(['a', 'b', 'c', 'd', 'e'], 'f').length, MAX_RECENT);
  assert.deepEqual(pushRecent(null, 'a'), ['a']);
  assert.deepEqual(pushRecent(['a', 7, '', null, 'b'], ''), ['a', 'b']);
});

test('menu: stored lists are read safely', () => {
  assert.deepEqual(parseRecent('["word-counter","merge-pdf"]'), ['word-counter', 'merge-pdf']);
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent('not json'), []);
  assert.deepEqual(parseRecent('{"a":1}'), []);
  assert.deepEqual(parseRecent('["ok", 5, "<img>", "has space", "fine-2"]'), ['ok', 'fine-2']);
  assert.equal(parseRecent(JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).length, MAX_RECENT);
});

test('menu: search matches every word, in any order and case', () => {
  const text = 'heic to jpg iphone photo convert';
  assert.equal(matches(text, ''), true);
  assert.equal(matches(text, '   '), true);
  assert.equal(matches(text, 'HEIC'), true);
  assert.equal(matches(text, 'jpg iphone'), true);
  assert.equal(matches(text, 'photo pdf'), false);
  assert.equal(matches('', 'x'), false);
});

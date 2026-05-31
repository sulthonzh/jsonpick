'use strict';

const { parsePath, pick, pickFirst, pickFields, query, parseQuery, applyTransform, flatten, TRANSFORMS } = require('../src/index');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${name}\n  ${e.message}`);
  }
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${label || ''}Expected ${b}, got ${a}`);
  }
}

// ─── Test Data ──────────────────────────────────────────────

const data = {
  name: 'Ada Lovelace',
  age: 36,
  active: true,
  scores: [95, 87, 92],
  address: {
    city: 'London',
    country: 'UK',
    coords: { lat: 51.5, lng: -0.12 },
  },
  users: [
    { name: 'Alice', email: 'alice@example.com', tags: ['admin', 'dev'] },
    { name: 'Bob', email: 'bob@example.com', tags: ['dev'] },
    { name: 'Charlie', email: 'charlie@example.com', tags: ['ops', 'dev'] },
  ],
  empty: null,
  meta: {
    "complex key": 'value1',
    'another one': 'value2',
  },
};

// ─── parsePath ──────────────────────────────────────────────

test('parsePath: simple key', () => {
  assertEqual(parsePath('name'), ['name']);
});

test('parsePath: nested', () => {
  assertEqual(parsePath('address.city'), ['address', 'city']);
});

test('parsePath: array index', () => {
  assertEqual(parsePath('users[0]'), ['users', '0']);
});

test('parsePath: negative index', () => {
  assertEqual(parsePath('scores[-1]'), ['scores', '-1']);
});

test('parsePath: wildcard', () => {
  assertEqual(parsePath('users.*.name'), ['users', '*', 'name']);
});

test('parsePath: bracket key', () => {
  assertEqual(parsePath('meta["complex key"]'), ['meta', 'complex key']);
});

test('parsePath: root dot', () => {
  assertEqual(parsePath('.'), []);
});

test('parsePath: empty string', () => {
  assertEqual(parsePath(''), []);
});

test('parsePath: deep nested with index', () => {
  assertEqual(parsePath('a.b[0].c'), ['a', 'b', '0', 'c']);
});

// ─── pick ───────────────────────────────────────────────────

test('pick: simple key', () => {
  assertEqual(pick(data, 'name'), ['Ada Lovelace']);
});

test('pick: nested key', () => {
  assertEqual(pick(data, 'address.city'), ['London']);
});

test('pick: deep nested', () => {
  assertEqual(pick(data, 'address.coords.lat'), [51.5]);
});

test('pick: array index', () => {
  assertEqual(pick(data, 'scores[0]'), [95]);
});

test('pick: negative index', () => {
  assertEqual(pick(data, 'scores[-1]'), [92]);
});

test('pick: wildcard over array', () => {
  assertEqual(pick(data, 'users.*.name'), ['Alice', 'Bob', 'Charlie']);
});

test('pick: wildcard over object', () => {
  const d = { a: { x: 1 }, b: { x: 2 } };
  assertEqual(pick(d, '*.x'), [1, 2]);
});

test('pick: missing key returns empty', () => {
  assertEqual(pick(data, 'nonexistent'), []);
});

test('pick: bracket key', () => {
  assertEqual(pick(data, 'meta["complex key"]'), ['value1']);
});

test('pick: root returns data', () => {
  const result = pick({ a: 1 }, '.');
  assertEqual(result.length, 1);
  assertEqual(result[0].a, 1);
});

// ─── pickFirst ──────────────────────────────────────────────

test('pickFirst: returns first match', () => {
  assertEqual(pickFirst(data, 'name'), 'Ada Lovelace');
});

test('pickFirst: returns undefined for missing', () => {
  assertEqual(pickFirst(data, 'nope'), undefined);
});

// ─── pickFields ─────────────────────────────────────────────

test('pickFields: multiple paths', () => {
  const result = pickFields(data, ['name', 'age']);
  assertEqual(result.name, 'Ada Lovelace');
  assertEqual(result.age, 36);
});

test('pickFields: with alias', () => {
  const result = pickFields(data, ['theName:name', 'theAge:age']);
  assertEqual(result.theName, 'Ada Lovelace');
  assertEqual(result.theAge, 36);
});

// ─── query ──────────────────────────────────────────────────

test('query: simple path', () => {
  assertEqual(query(data, 'name'), 'Ada Lovelace');
});

test('query: wildcard path returns array', () => {
  assertEqual(query(data, 'users.*.name'), ['Alice', 'Bob', 'Charlie']);
});

test('query: transform upper', () => {
  assertEqual(query(data, 'name | upper'), 'ADA LOVELACE');
});

test('query: transform length', () => {
  assertEqual(query(data, 'scores | length'), 3);
});

test('query: transform sort', () => {
  assertEqual(query(data, 'scores | sort'), [87, 92, 95]);
});

test('query: transform sum', () => {
  assertEqual(query(data, 'scores | sum'), 274);
});

test('query: transform avg', () => {
  assertEqual(query(data, 'scores | avg'), 91.33333333333333);
});

test('query: transform min', () => {
  assertEqual(query(data, 'scores | min'), 87);
});

test('query: transform max', () => {
  assertEqual(query(data, 'scores | max'), 95);
});

test('query: chained transforms', () => {
  assertEqual(query(data, 'users.*.name | sort | join'), 'Alice, Bob, Charlie');
});

test('query: wildcard + transform', () => {
  assertEqual(query(data, 'users.*.tags | flatten | unique | sort'), ['admin', 'dev', 'ops']);
});

test('query: type transform', () => {
  assertEqual(query(data, 'name | type'), 'string');
  assertEqual(query(data, 'scores | type'), 'array');
  assertEqual(query(data, 'empty | type'), 'null');
});

test('query: first/last transforms', () => {
  assertEqual(query(data, 'scores | first'), 95);
  assertEqual(query(data, 'scores | last'), 92);
});

test('query: reverse transform', () => {
  assertEqual(query(data, 'scores | reverse'), [92, 87, 95]);
});

test('query: join transform', () => {
  assertEqual(query(data, 'users.*.name | join'), 'Alice, Bob, Charlie');
});

// ─── applyTransform ─────────────────────────────────────────

test('applyTransform: throws on unknown', () => {
  let threw = false;
  try { applyTransform(1, 'nonexistent'); } catch (e) { threw = true; }
  if (!threw) throw new Error('Should have thrown');
});

// ─── flatten ────────────────────────────────────────────────

test('flatten: simple object', () => {
  const result = flatten({ a: { b: 1, c: { d: 2 } } });
  assertEqual(result, { 'a.b': 1, 'a.c.d': 2 });
});

test('flatten: with array value', () => {
  const result = flatten({ a: { b: [1, 2] } });
  assertEqual(result, { 'a.b': [1, 2] });
});

test('flatten: empty prefix', () => {
  const result = flatten({ x: 1 });
  assertEqual(result, { x: 1 });
});

// ─── Real-world scenarios ───────────────────────────────────

test('scenario: extract emails from user list', () => {
  const emails = query(data, 'users.*.email');
  assertEqual(emails, ['alice@example.com', 'bob@example.com', 'charlie@example.com']);
});

test('scenario: get all unique tags', () => {
  const tags = query(data, 'users.*.tags | flatten | unique | sort');
  assertEqual(tags, ['admin', 'dev', 'ops']);
});

test('scenario: nested address coords', () => {
  const coords = pickFields(data, ['lat:address.coords.lat', 'lng:address.coords.lng']);
  assertEqual(coords, { lat: 51.5, lng: -0.12 });
});

test('scenario: count elements', () => {
  assertEqual(query(data, 'users | length'), 3);
});

test('scenario: keys of object', () => {
  const keys = query(data, 'address | keys');
  assertEqual(keys, ['city', 'country', 'coords']);
});

test('scenario: compact array', () => {
  assertEqual(query({ a: [0, 1, false, 2, '', 3] }, 'a | compact'), [1, 2, 3]);
});

test('scenario: split string', () => {
  assertEqual(query({ csv: 'a, b, c' }, 'csv | split'), ['a', 'b', 'c']);
});

// ─── Results ────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

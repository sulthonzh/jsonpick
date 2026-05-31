'use strict';

/**
 * jsonpick — extract and transform JSON with dot-notation paths
 * Zero dependencies. Works in Node and browser.
 */

// ─── Path Parser ────────────────────────────────────────────

/**
 * Parse a dot-notation path into segments.
 * Supports: a.b.c, a[0], a["key"], a[*], nested.*
 * Wildcards: * matches all keys/indices, [*] is same.
 */
function parsePath(path) {
  if (!path || path === '.') return [];
  const segments = [];
  let i = 0;
  while (i < path.length) {
    if (path[i] === '.') {
      i++;
      continue;
    }
    if (path[i] === '[') {
      const end = path.indexOf(']', i);
      if (end === -1) throw new Error(`Unclosed bracket at position ${i}`);
      let inner = path.slice(i + 1, end);
      // Strip quotes
      if ((inner.startsWith('"') && inner.endsWith('"')) ||
          (inner.startsWith("'") && inner.endsWith("'"))) {
        inner = inner.slice(1, -1);
      }
      segments.push(inner);
      i = end + 1;
      continue;
    }
    // Read until . or [
    let j = i;
    while (j < path.length && path[j] !== '.' && path[j] !== '[') j++;
    segments.push(path.slice(i, j));
    i = j;
  }
  return segments;
}

/**
 * Resolve a parsed path against data.
 * Returns an array of { path: string[], value: any } matches.
 */
function resolve(data, segments) {
  if (segments.length === 0) {
    return [{ path: [], value: data }];
  }

  const [head, ...rest] = segments;
  const results = [];

  if (head === '*') {
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        results.push(...resolve(data[i], rest).map(r => ({
          path: [String(i), ...r.path],
          value: r.value,
        })));
      }
    } else if (data && typeof data === 'object') {
      for (const key of Object.keys(data)) {
        results.push(...resolve(data[key], rest).map(r => ({
          path: [key, ...r.path],
          value: r.value,
        })));
      }
    }
    return results;
  }

  // Numeric index (positive or negative)
  if (Array.isArray(data)) {
    const numIndex = Number(head);
    if (!isNaN(numIndex)) {
      let idx = numIndex < 0 ? data.length + numIndex : numIndex;
      if (idx < 0 || idx >= data.length) return [];
      results.push(...resolve(data[idx], rest).map(r => ({
        path: [head, ...r.path],
        value: r.value,
      })));
      return results;
    }
  }

  // Object key
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (!(head in data)) return [];
    results.push(...resolve(data[head], rest).map(r => ({
      path: [head, ...r.path],
      value: r.value,
    })));
  }

  return results;
}

// ─── Pick ───────────────────────────────────────────────────

/**
 * Pick values from data using a dot-notation path.
 * Returns array of matched values.
 */
function pick(data, path) {
  const segments = parsePath(path);
  return resolve(data, segments).map(r => r.value);
}

/**
 * Pick first match from data using a dot-notation path.
 */
function pickFirst(data, path) {
  const results = pick(data, path);
  return results.length > 0 ? results[0] : undefined;
}

// ─── Transforms ─────────────────────────────────────────────

const TRANSFORMS = {
  length: (v) => Array.isArray(v) ? v.length : typeof v === 'string' ? v.length : typeof v === 'object' && v ? Object.keys(v).length : 0,
  keys: (v) => v && typeof v === 'object' ? Object.keys(v) : [],
  values: (v) => v && typeof v === 'object' ? Object.values(v) : [],
  entries: (v) => v && typeof v === 'object' ? Object.entries(v) : [],
  flat: (v) => Array.isArray(v) ? v.flat() : v,
  unique: (v) => Array.isArray(v) ? [...new Set(v)] : v,
  sort: (v) => Array.isArray(v) ? [...v].sort() : v,
  reverse: (v) => Array.isArray(v) ? [...v].reverse() : typeof v === 'string' ? v.split('').reverse().join('') : v,
  type: (v) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v,
  json: (v) => JSON.stringify(v),
  pretty: (v) => JSON.stringify(v, null, 2),
  upper: (v) => typeof v === 'string' ? v.toUpperCase() : v,
  lower: (v) => typeof v === 'string' ? v.toLowerCase() : v,
  trim: (v) => typeof v === 'string' ? v.trim() : v,
  number: (v) => Number(v),
  string: (v) => String(v),
  boolean: (v) => Boolean(v),
  join: (v) => Array.isArray(v) ? v.join(', ') : v,
  first: (v) => Array.isArray(v) ? v[0] : v,
  last: (v) => Array.isArray(v) ? v[v.length - 1] : v,
  min: (v) => Array.isArray(v) && v.length ? Math.min(...v) : v,
  max: (v) => Array.isArray(v) && v.length ? Math.max(...v) : v,
  sum: (v) => Array.isArray(v) ? v.reduce((a, b) => a + Number(b), 0) : v,
  avg: (v) => Array.isArray(v) && v.length ? v.reduce((a, b) => a + Number(b), 0) / v.length : v,
  count: (v) => Array.isArray(v) ? v.length : 1,
  split: (v) => typeof v === 'string' ? v.split(/,\s*/) : v,
  compact: (v) => Array.isArray(v) ? v.filter(Boolean) : v,
  flatten: (v) => Array.isArray(v) ? v.flat(Infinity) : v,
};

/**
 * Apply a transform by name to a value.
 */
function applyTransform(value, name) {
  const fn = TRANSFORMS[name];
  if (!fn) throw new Error(`Unknown transform: ${name}. Available: ${Object.keys(TRANSFORMS).join(', ')}`);
  return fn(value);
}

// ─── Query ──────────────────────────────────────────────────

/**
 * Parse a query string like "users.*.name | upper | join"
 * Returns { path, transforms }
 */
function parseQuery(query) {
  const parts = query.split('|').map(s => s.trim());
  const path = parts[0] || '.';
  const transforms = parts.slice(1).filter(Boolean);
  return { path, transforms };
}

/**
 * Execute a query against data.
 * Returns the final result after all transforms.
 */
function query(data, q) {
  const { path, transforms } = parseQuery(q);
  let values = pick(data, path);

  // If single match and no wildcards, unwrap
  const isSingle = !path.includes('*') && values.length <= 1;
  let result = isSingle ? values[0] : values;

  for (const t of transforms) {
    if (isSingle) {
      result = applyTransform(result, t);
    } else {
      // For arrays, some transforms apply to whole array (join, sort, unique, etc.)
      result = applyTransform(result, t);
    }
  }

  return result;
}

// ─── Pick Multiple ──────────────────────────────────────────

/**
 * Pick multiple paths from data, returns an object.
 * pickFields(data, ['name', 'age']) => { name: ..., age: ... }
 */
function pickFields(data, paths) {
  const result = {};
  for (const p of paths) {
    // Support "alias:path" syntax
    const colonIdx = p.indexOf(':');
    let alias, path;
    if (colonIdx > 0 && !p.slice(0, colonIdx).includes('.')) {
      alias = p.slice(0, colonIdx);
      path = p.slice(colonIdx + 1);
    } else {
      alias = p;
      path = p;
    }
    result[alias] = pickFirst(data, path);
  }
  return result;
}

// ─── Flatten ────────────────────────────────────────────────

/**
 * Flatten a JSON object to dot-notation key-value pairs.
 * flatten({ a: { b: 1 } }) => { "a.b": 1 }
 */
function flatten(data, prefix = '') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return prefix ? { [prefix]: data } : data;
  }
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

// ─── Exports ────────────────────────────────────────────────

module.exports = {
  parsePath,
  pick,
  pickFirst,
  pickFields,
  query,
  parseQuery,
  applyTransform,
  flatten,
  TRANSFORMS,
};

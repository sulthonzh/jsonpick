#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { pick, pickFirst, pickFields, query, flatten, parseQuery, applyTransform, TRANSFORMS } = require('./index');

// ─── Args ───────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [], files: [], paths: [], transforms: [] };
  let i = 2;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-r':
      case '--raw':
        args.raw = true;
        break;
      case '-j':
      case '--json':
        args.json = true;
        break;
      case '-p':
      case '--pretty':
        args.pretty = true;
        break;
      case '-f':
      case '--fields':
        args.fieldsMode = true;
        break;
      case '-F':
      case '--flatten':
        args.flattenMode = true;
        break;
      case '-k':
      case '--keys':
        args.keysMode = true;
        break;
      case '-l':
      case '--list-transforms':
        args.listTransforms = true;
        break;
      case '-i':
      case '--input':
        args.input = argv[++i];
        break;
      case '-s':
      case '--string':
        args.string = argv[++i];
        break;
      case '-d':
      case '--delimiter':
        args.delimiter = argv[++i];
        break;
      case '--default':
        args.default = argv[++i];
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown flag: ${arg}`);
          process.exit(1);
        }
        if (!args.input && !args.string && (arg.endsWith('.json') || arg === '-' || fs.existsSync(arg))) {
          args.input = arg;
        } else {
          args._.push(arg);
        }
        break;
    }
    i++;
  }
  return args;
}

function showHelp() {
  console.log(`
jsonpick — extract and transform JSON with dot-notation paths

Usage:
  jsonpick <path>                      Read from stdin
  jsonpick <path> <file>               Read from file
  jsonpick <path> -s '<json>'          Read from string
  jsonpick -f <field1> <field2> ...    Pick multiple fields
  jsonpick -F                          Flatten JSON to dot-notation keys
  jsonpick -k                          List all keys (dot-notation)
  jsonpick -l                          List available transforms

Path syntax:
  .                     Root object
  name                  Key access
  users[0]              Array index
  users[-1]             Negative index (from end)
  users.*.name          Wildcard (all elements)
  users[*].email        Same as *
  a.b["complex key"]    Bracket notation with special chars

Pipes/transforms:
  users.*.name | sort   Apply transform after extraction
  users.*.age | avg     Chain: extract then average
  tags | join           Join array to string
  data | pretty         Pretty-print JSON

Options:
  -r, --raw             Output raw values (no JSON quotes on strings)
  -j, --json            Force JSON output
  -p, --pretty          Pretty-print JSON output
  -f, --fields          Pick multiple fields (all non-flag args are paths)
  -F, --flatten         Flatten to dot-notation key-value pairs
  -k, --keys            List all dot-notation keys
  -l, --list-transforms Show all available transforms
  -i, --input <file>    Input file
  -s, --string <json>   Input JSON string
  -d, --delimiter <str> Delimiter for multiple values (default: newline)
  --default <value>     Default value when path not found
  -h, --help            Show this help

Examples:
  echo '{"name":"Ada"}' | jsonpick name
  jsonpick users[0].email data.json
  jsonpick 'users.*.name | sort | join' users.json
  jsonpick -f name age email user.json
  echo '{"a":{"b":1}}' | jsonpick -F
  jsonpick 'items.*.price | sum' cart.json
  jsonpick -k package.json
`);
}

function showTransforms() {
  console.log('Available transforms:\n');
  const descriptions = {
    length: 'Length of array/string, or key count of object',
    keys: 'Object keys as array',
    values: 'Object values as array',
    entries: 'Object entries as [key, value] pairs',
    flat: 'Flatten array one level',
    unique: 'Remove duplicates from array',
    sort: 'Sort array or string',
    reverse: 'Reverse array or string',
    type: 'Get type of value (array/null/string/number/etc)',
    json: 'Stringify to single-line JSON',
    pretty: 'Stringify to pretty JSON',
    upper: 'Uppercase string',
    lower: 'Lowercase string',
    trim: 'Trim whitespace from string',
    number: 'Convert to number',
    string: 'Convert to string',
    boolean: 'Convert to boolean',
    join: 'Join array with ", "',
    first: 'First element of array',
    last: 'Last element of array',
    min: 'Minimum value in array',
    max: 'Maximum value in array',
    sum: 'Sum of array values',
    avg: 'Average of array values',
    count: 'Count array elements',
    split: 'Split string by comma+whitespace',
    compact: 'Remove falsy values from array',
    flatten: 'Recursively flatten array',
  };
  for (const [name, desc] of Object.entries(descriptions)) {
    console.log(`  ${name.padEnd(12)} ${desc}`);
  }
}

function readInput(args) {
  if (args.string) return args.string;

  let input;
  if (args.input && args.input !== '-') {
    input = fs.readFileSync(args.input, 'utf8');
  } else {
    // Read from stdin
    if (process.stdin.isTTY) {
      console.error('Error: No input. Pipe JSON or provide a file.');
      process.exit(1);
    }
    input = fs.readFileSync('/dev/stdin', 'utf8');
  }

  return input.trim();
}

// ─── Main ───────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);

  if (args.help) { showHelp(); return; }
  if (args.listTransforms) { showTransforms(); return; }

  const raw = readInput(args);
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`Error: Invalid JSON — ${e.message}`);
    process.exit(1);
  }

  // Flatten mode
  if (args.flattenMode) {
    const flat = flatten(data);
    if (args.json || args.pretty) {
      console.log(args.pretty ? JSON.stringify(flat, null, 2) : JSON.stringify(flat));
    } else {
      for (const [k, v] of Object.entries(flat)) {
        console.log(`${k} = ${JSON.stringify(v)}`);
      }
    }
    return;
  }

  // Keys mode
  if (args.keysMode) {
    const flat = flatten(data);
    for (const k of Object.keys(flat)) {
      console.log(k);
    }
    return;
  }

  // Fields mode
  if (args.fieldsMode) {
    const fields = args._.length > 0 ? args._ : [];
    if (fields.length === 0) {
      console.error('Error: No fields specified for -f mode');
      process.exit(1);
    }
    const result = pickFields(data, fields);
    console.log(args.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result));
    return;
  }

  // Single path / query mode
  const queryStr = args._[0] || '.';
  let result;
  try {
    result = query(data, queryStr);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  if (result === undefined) {
    if (args.default !== undefined) {
      result = args.default;
    } else {
      console.error(`Error: Path not found — ${queryStr}`);
      process.exit(1);
    }
  }

  // Output formatting
  if (args.raw && typeof result === 'string') {
    console.log(result);
  } else if (args.pretty) {
    console.log(JSON.stringify(result, null, 2));
  } else if (typeof result === 'string') {
    console.log(result);
  } else if (typeof result === 'number' || typeof result === 'boolean' || result === null) {
    console.log(String(result));
  } else {
    console.log(JSON.stringify(result));
  }
}

main();

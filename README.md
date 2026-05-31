# jsonpick

Extract and transform JSON with dot-notation paths. A minimal `jq` alternative you can `npx`.

**Zero dependencies.** Works in Node 14+.

## Install

```bash
npm install -g jsonpick
# or
npx jsonpick 'users.*.name' data.json
```

## Quick Start

```bash
# Read from stdin
echo '{"name":"Ada","age":36}' | jsonpick name
# Ada

# Read from file
jsonpick users[0].email data.json

# Wildcards
jsonpick 'users.*.name' data.json

# Pipes — chain transforms
jsonpick 'users.*.name | sort | join' users.json
# Alice, Bob, Charlie

# Flatten to dot-notation keys
echo '{"a":{"b":1,"c":{"d":2}}}' | jsonpick -F
# a.b = 1
# a.c.d = 2

# Pick multiple fields
jsonpick -f name age email user.json

# List all keys
jsonpick -k package.json
```

## Why jsonpick?

You know `jq` — it's powerful but the syntax is a language unto itself. For 90% of what you actually need (extract a field, grab array items, get unique values), dot-notation is just... easier.

```bash
# jq
cat data.json | jq '.users[].name' -r

# jsonpick — same thing, less ceremony
jsonpick 'users.*.name' data.json -r
```

## Path Syntax

| Syntax | Meaning | Example |
|---|---|---|
| `name` | Object key | `address.city` → "London" |
| `[0]` | Array index | `users[0]` → first user |
| `[-1]` | Negative index | `scores[-1]` → last score |
| `*` or `[*]` | Wildcard | `users.*.name` → all names |
| `["key"]` | Bracket notation | `meta["complex key"]` |
| `.` | Root | `.` → entire input |

## Transforms (Pipes)

Chain transforms with `|`:

```bash
jsonpick 'scores | sum' data.json
jsonpick 'users.*.name | sort | join' data.json
jsonpick 'name | upper' data.json
```

**Available transforms:**

| Transform | Description |
|---|---|
| `length` | Length of array/string, key count of object |
| `keys` | Object keys as array |
| `values` | Object values as array |
| `entries` | Object entries as `[key, value]` |
| `flat` | Flatten array one level |
| `flatten` | Recursively flatten array |
| `unique` | Remove duplicates |
| `sort` | Sort array |
| `reverse` | Reverse array or string |
| `type` | Type of value |
| `json` | Stringify to single-line JSON |
| `pretty` | Stringify to pretty JSON |
| `upper` / `lower` | Case conversion |
| `trim` | Trim whitespace |
| `number` / `string` / `boolean` | Type coercion |
| `join` | Join array with `", "` |
| `split` | Split string by comma |
| `first` / `last` | First/last element |
| `min` / `max` | Min/max of array |
| `sum` / `avg` | Sum/average of array |
| `count` | Count array elements |
| `compact` | Remove falsy values |

## CLI Options

```
  -r, --raw              Output raw values (no JSON quotes on strings)
  -j, --json             Force JSON output
  -p, --pretty           Pretty-print JSON output
  -f, --fields           Pick multiple fields (all args are paths)
  -F, --flatten          Flatten to dot-notation key-value pairs
  -k, --keys             List all dot-notation keys
  -l, --list-transforms  Show all available transforms
  -i, --input <file>     Input file
  -s, --string <json>    Input JSON string
  -d, --delimiter <str>  Delimiter for multiple values
  --default <value>      Default when path not found
```

## Programmatic API

```js
const { pick, pickFirst, pickFields, query, flatten } = require('jsonpick');

const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] };

pick(data, 'users.*.name');          // ['Alice', 'Bob']
pickFirst(data, 'users[0].name');    // 'Alice'
query(data, 'users.*.name | sort');  // ['Alice', 'Bob']
pickFields(data, ['name:users[0].name']);  // { name: 'Alice' }
flatten({ a: { b: 1 } });           // { 'a.b': 1 }
```

## License

MIT

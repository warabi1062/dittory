# dittory

[![npm version](https://img.shields.io/npm/v/dittory.svg)](https://www.npmjs.com/package/dittory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A static analysis CLI for TypeScript projects that detects **parameters that always receive the same value**.

## Why?

When a prop or argument is always passed the same value across your codebase, it's often a sign that:

- The parameter could be **removed** and replaced with a default value
- The API could be **simplified** by eliminating unnecessary options
- There's **copy-paste code** that should be refactored

dittory helps you identify these opportunities automatically.

## Installation

```sh
# npm
$ npm install -D dittory

# pnpm
$ pnpm add -D dittory

# yarn
$ yarn add -D dittory

# bun
$ bun add -D dittory
```

Or run directly without installing:

```sh
$ npx dittory
$ pnpm dlx dittory
$ yarn dlx dittory
$ bunx dittory
```

## Usage

```sh
# Analyze ./src directory (default)
$ dittory

# Analyze a specific directory
$ dittory ./path/to/src

# Set minimum usage count (default: 2)
$ dittory --min=3

# Analyze specific targets
$ dittory --target=components  # React components only
$ dittory --target=functions   # Functions and class methods only
$ dittory --target=all         # Both (default)

# Output mode
$ dittory --output=simple      # Show only constant parameters (default)
$ dittory --output=verbose     # Also show all analyzed functions
```

## Example Output

```
Button src/components/Button.tsx:15
Constant Arguments:
  - variant = "primary"
Usages (5):
  - src/pages/Home.tsx:23
  - src/pages/About.tsx:45
  - src/pages/Contact.tsx:12
  - src/features/auth/Login.tsx:67
  - src/features/auth/Register.tsx:89


fetchUser src/api/users.ts:42
Constant Arguments:
  - includeProfile = true
  - cache = false
Usages (3):
  - src/hooks/useUser.ts:18
  - src/pages/Profile.tsx:31
  - src/components/UserCard.tsx:55


---
Found 2 function(s) with constant arguments out of 24 function(s).
```

## What It Detects

| Target | Description |
|--------|-------------|
| **React Components** | Props passed to JSX elements (`<Button variant="primary" />`) |
| **Functions** | Arguments passed to exported functions |
| **Class Methods** | Arguments passed to methods of exported classes |

## Supported Detection Patterns

### Value Types

| Pattern | Example | Supported |
|---------|---------|-----------|
| String literals | `"hello"` | ✅ |
| Number literals | `42` | ✅ |
| Boolean literals | `true`, `false` | ✅ |
| Enum values | `Status.Active` | ✅ |
| Imported constants | `import { VALUE } from "./constants"` | ✅ |
| Variable references | `const x = 3; fn(x)` | ✅ |
| Variable chains | `const a = 1; const b = a; fn(b)` → resolves to `1` | ✅ |
| Object literals | `{ nested: { value: 1 } }` | ✅ |
| Function references | `onClick={handleClick}` | ⚠️ (tracked per call site) |
| `undefined` | `fn(undefined)` | ✅ |

> **Note on Function references:** Function values are identified by their usage location (file + line), not by identity. Even if the same function is passed from multiple locations, each usage is treated as a different value. This is by design, as the analysis takes a conservative approach regarding runtime behavior.

### Parameter Propagation (Call Graph Analysis)

dittory can track values through component/function chains:

```tsx
// App passes "42" to Parent, Parent passes props.number to Child
// → Child.number is detected as constant "42"

const Child = ({ number }) => <div>{number}</div>;
const Parent = ({ number }) => <Child number={number} />;
export const App = () => <Parent number="42" />;
```

| Pattern | Example | Supported |
|---------|---------|-----------|
| Direct props access | `props.value` | ✅ |
| Destructured props | `({ value }) => ...` | ✅ |
| Nested access | `props.user.name` | ✅ |
| Multi-level chains | `A → B → C` propagation | ✅ |
| Circular reference protection | Prevents infinite loops | ✅ |

### Scope

| Pattern | Supported |
|---------|-----------|
| Exported functions/components | ✅ |
| Non-exported (internal) functions | ❌ |

## Unsupported Detection Patterns

### Spread Syntax

```tsx
// ❌ Props passed via spread are NOT tracked
const Parent = ({ num, ...others }) => <Child {...others} />;
```

### Dynamic Values

```tsx
// ❌ Values computed at runtime
<Button count={items.length} />
<Input value={getValue()} />
<List items={data.filter(x => x.active)} />
```

### Conditional Branches

When different code paths pass different values, dittory correctly identifies them as different values (not constants):

```tsx
// Different values in branches → correctly NOT reported as constant
const App = () => {
  if (condition) {
    return <Button variant="primary" />;
  }
  return <Button variant="secondary" />;
};
```

Note: This is expected behavior. dittory performs static analysis and considers all code paths.

### Template Literals

```tsx
// ❌ Template strings with expressions
<Label text={`Hello, ${name}`} />
```

### Array/Object Spread in Arguments

```tsx
// ❌ Spread in function arguments
fn(...args);
fn({ ...defaults, custom: value });
```

### Higher-Order Components / Render Props

```tsx
// ❌ HOC patterns are not analyzed
const Enhanced = withAuth(Component);
<Enhanced role="admin" />
```

### Function Overloads

```ts
// ❌ Overloaded functions may not correctly map arguments
function process(a: string): void;
function process(a: string, b: number): void;
function process(a: string, b?: number): void { ... }

// Only parameters from the first overload signature are recognized
process("hello", 42);  // "b" argument is not tracked
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--min=<n>` | Minimum number of usages required to report | `2` |
| `--target=<mode>` | What to analyze: `all`, `components`, `functions` | `all` |
| `--output=<mode>` | Output verbosity: `simple`, `verbose` | `simple` |
| `--tsconfig=<path>` | Path to tsconfig.json | `./tsconfig.json` |
| `--value-types=<types>` | Value types to detect (comma-separated): `boolean`, `number`, `string`, `enum`, `undefined`, `all` | `all` |
| `--help` | Show help message | — |

## Configuration File

Create a configuration file to set default options. dittory looks for:

1. `dittory.config.js` or `dittory.config.mjs`
2. `dittory.config.json`

```js
// dittory.config.js
/** @type {import('dittory').DittoryConfig} */
export default {
  minUsages: 3,
  target: "components",
  output: "verbose",
  tsconfig: "./tsconfig.app.json",
  targetDir: "./src",
  valueTypes: ["boolean", "string"], // or "all"
};
```

**Priority:** CLI options > Config file > Default values

## Use Cases

### Simplify Component APIs

```tsx
// Before: variant is always "primary" across 20 usages
<Button variant="primary" onClick={handleClick}>Submit</Button>

// After: make "primary" the default
<Button onClick={handleClick}>Submit</Button>
```

### Remove Unnecessary Flexibility

```ts
// Before: cache is always false in all 15 call sites
const data = await fetchData(id, { cache: false });

// After: remove the option or change the default
const data = await fetchData(id);
```

## Requirements

- Node.js >= 18
- TypeScript project with a `tsconfig.json`

## License

MIT

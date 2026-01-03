# dittory

[![npm version](https://img.shields.io/npm/v/dittory.svg)](https://www.npmjs.com/package/dittory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A static analysis CLI that detects **parameters always receiving the same value** in React components and functions.

> **dittory** = "ditto" (same) + "-ory" — finds repetitive patterns in your code

## Why?

When a prop or argument is always passed the same value across your codebase, it's often a sign that:

- The parameter could be **removed** and replaced with a default value
- The API could be **simplified** by eliminating unnecessary options
- There's **copy-paste code** that should be refactored

dittory helps you identify these opportunities automatically.

## Installation

```bash
npm install -g dittory
```

Or use directly with npx:

```bash
npx dittory
```

## Usage

```bash
# Analyze ./src directory (default)
dittory

# Analyze a specific directory
dittory ./path/to/src

# Set minimum usage count (default: 2)
dittory --min=3

# Analyze specific targets
dittory --target=components  # React components only
dittory --target=functions   # Functions and class methods only
dittory --target=all         # Both (default)

# Output mode
dittory --output=simple      # Show only constants (default)
dittory --output=verbose     # Show all exported functions and details
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
| **Functions** | Arguments passed to exported function calls |
| **Class Methods** | Arguments passed to methods of exported classes |

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--min=<n>` | Minimum number of usages to consider | `2` |
| `--target=<mode>` | What to analyze: `all`, `components`, `functions` | `all` |
| `--output=<mode>` | Output verbosity: `simple`, `verbose` | `simple` |
| `--tsconfig=<path>` | Path to tsconfig.json | `./tsconfig.json` |
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
};
```

**Priority:** CLI options > Config file > Default values

## Disabling Detection

Exclude specific usages from detection using comments:

```ts
// Exclude the next line
// dittory-disable-next-line
fetchData(id, { cache: false });

// Exclude the same line
fetchData(id, { cache: false }); // dittory-disable-line
```

Works alongside other directives like `eslint-disable-line` or `@ts-ignore`.

## Use Cases

### Simplify Component APIs

```tsx
// Before: variant is always "primary" across 20 usages
<Button variant="primary" onClick={handleClick}>Submit</Button>

// After: make "primary" the default
<Button onClick={handleClick}>Submit</Button>
```

### Remove Unused Flexibility

```ts
// Before: cache is always false in all 15 call sites
const data = await fetchData(id, { cache: false });

// After: remove the option or change the default
const data = await fetchData(id);
```

## Requirements

- Node.js >= 18
- Project must have a `tsconfig.json`

## License

MIT

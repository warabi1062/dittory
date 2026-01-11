# What is dittory?

dittory is a static analysis CLI tool that detects **parameters always receiving the same value** in React components and functions.

> **dittory** = "ditto" (same) + "-ory" — finds the repetitive patterns in your code

## The Problem

In large codebases, it's common to find patterns like this:

```tsx
// Used in 20 different places, always with variant="primary"
<Button variant="primary" onClick={handleClick}>Submit</Button>
<Button variant="primary" onClick={handleSave}>Save</Button>
<Button variant="primary" onClick={handleCancel}>Cancel</Button>
```

Or function calls like:

```ts
// Called 15 times, always with cache: false
const data = await fetchData(id, { cache: false });
```

These patterns indicate:

- The parameter could be **removed** and replaced with a default value
- The API could be **simplified** by eliminating unnecessary options
- There's **copy-paste code** that should be refactored

## What It Detects

| Target | Description |
|--------|-------------|
| **React Components** | Props passed to JSX elements (`<Button variant="primary" />`) |
| **Functions** | Arguments passed to exported function calls |
| **Class Methods** | Arguments passed to methods of exported classes |

## How It Works

1. **Parses** your TypeScript/TSX codebase using [ts-morph](https://github.com/dsherret/ts-morph)
2. **Collects** all exported React components, functions, and class methods
3. **Finds** all usages (JSX elements, function calls, method calls)
4. **Analyzes** each parameter to check if it always receives the same value
5. **Reports** parameters that are constant across all usages

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

### Identify Copy-Paste Patterns

When multiple unrelated files pass the same hardcoded values, it might indicate:
- Missing abstractions
- Configuration that should be centralized
- Dead code paths that were never actually used differently

## Requirements

- Node.js >= 18
- Project must have a `tsconfig.json`

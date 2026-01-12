---
layout: home

hero:
  name: dittory
  text: Find Repetitive Patterns
  tagline: A static analysis CLI for TypeScript projects that detects parameters that always receive the same value.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/warabi1062/dittory

features:
  - icon: "🔍"
    title: Smart Detection
    details: Automatically finds props and arguments that are always passed the same value across your entire codebase.
  - icon: "⚡"
    title: Fast Analysis
    details: Built on ts-morph for efficient TypeScript/TSX parsing. Requires a tsconfig.json in your project.
  - icon: "🛠️"
    title: Flexible Configuration
    details: Configure via CLI options or config files. Supports both JavaScript and JSON configs.
  - icon: "🎯"
    title: Targeted Analysis
    details: Analyze React components, functions, or both. Fine-tune with minimum usage thresholds.
---

## Quick Start

::: code-group

```sh [npm]
$ npx dittory ./src --min=3
```

```sh [pnpm]
$ pnpm dlx dittory ./src --min=3
```

```sh [yarn]
$ yarn dlx dittory ./src --min=3
```

```sh [bun]
$ bunx dittory ./src --min=3
```

:::

### Example Output

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

## Why dittory?

When a prop or argument is always passed the same value across your codebase, it's often a sign that:

- The parameter could be **removed** and replaced with a default value
- The API could be **simplified** by eliminating unnecessary options
- There's **copy-paste code** that should be refactored

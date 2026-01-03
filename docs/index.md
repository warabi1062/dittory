---
layout: home

hero:
  name: dittory
  text: Find Repetitive Patterns
  tagline: A static analysis CLI tool that detects parameters always receiving the same value in React components and functions.
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
    details: Built on ts-morph for efficient TypeScript/TSX parsing with full type awareness.
  - icon: "🛠️"
    title: Flexible Configuration
    details: Configure via CLI options or config files. Supports both JavaScript and JSON configs.
  - icon: "🎯"
    title: Targeted Analysis
    details: Analyze React components, functions, or both. Fine-tune with minimum usage thresholds.
---

## Quick Start

```bash
# Install globally
npm install -g dittory

# Or use directly with npx
npx dittory

# Analyze a specific directory
npx dittory ./src --min=3
```

## Why dittory?

When a prop or argument is always passed the same value across your codebase, it's often a sign that:

- The parameter could be **removed** and replaced with a default value
- The API could be **simplified** by eliminating unnecessary options
- There's **copy-paste code** that should be refactored

**dittory** = "ditto" (same) + "-ory" — finds the repetitive patterns in your code.

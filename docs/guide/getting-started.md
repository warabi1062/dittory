# Getting Started

## Requirements

- Node.js >= 18
- TypeScript project with a `tsconfig.json`

## Installation

Install dittory as a dev dependency:

::: code-group

```sh [npm]
$ npm install -D dittory
```

```sh [pnpm]
$ pnpm add -D dittory
```

```sh [yarn]
$ yarn add -D dittory
```

```sh [bun]
$ bun add -D dittory
```

:::

Or run directly without installing:

::: code-group

```sh [npm]
$ npx dittory
```

```sh [pnpm]
$ pnpm dlx dittory
```

```sh [yarn]
$ yarn dlx dittory
```

```sh [bun]
$ bunx dittory
```

:::

## Basic Usage

```sh
# Analyze ./src directory (default)
$ dittory

# Analyze a specific directory
$ dittory ./path/to/src

# Set minimum usage count (default: 2)
$ dittory --min=3

# Analyze specific targets
$ dittory --target=react-components  # React components only
$ dittory --target=functions         # Functions and class methods only
$ dittory --target=all               # Both (default)

# Debug mode
$ dittory --debug              # Show verbose output
```

## Quick Example

Given this codebase:

::: code-group

```tsx [src/components/Button.tsx]
export function Button({ variant, children, onClick }) {
  return (
    <button className={`btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
}
```

```tsx [src/pages/Home.tsx]
import { Button } from '../components/Button';

export function Home() {
  return <Button variant="primary" onClick={() => {}}>Click me</Button>;
}
```

```tsx [src/pages/About.tsx]
import { Button } from '../components/Button';

export function About() {
  return <Button variant="primary" onClick={() => {}}>Learn more</Button>;
}
```

:::

Running `dittory` will output:

```
Button src/components/Button.tsx:1
Constant Arguments:
  - variant = "primary"
Usages (2):
  - src/pages/Home.tsx:5
  - src/pages/About.tsx:5


---
Found 1 function(s) with constant arguments out of 3 function(s).
```

This tells you that `variant` is always `"primary"` across all usages, suggesting you could make it the default value.

## Next Steps

- Learn about [CLI Options](/guide/cli-options) for more control
- Configure dittory with a [Config File](/config/)
- Learn how to [disable detection](/guide/disabling-detection) for specific lines

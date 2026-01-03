# Options Reference

## All Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minUsages` | `number` | `2` | Minimum number of usages to consider |
| `target` | `AnalyzeMode` | `"all"` | What to analyze |
| `output` | `OutputMode` | `"simple"` | Output verbosity |
| `tsconfig` | `string` | `"./tsconfig.json"` | Path to tsconfig.json |
| `targetDir` | `string` | `"./src"` | Target directory to analyze |

## minUsages

Minimum number of usages required before a parameter is considered for constant detection.

- **Type:** `number`
- **Default:** `2`
- **CLI:** `--min=<n>`

```js
export default {
  minUsages: 3, // Only report if a function is used 3+ times
};
```

::: tip
Setting this higher reduces noise from rarely-used functions. A value of 3-5 is often useful for larger codebases.
:::

## target

Specifies what types of exports to analyze.

- **Type:** `"all" | "components" | "functions"`
- **Default:** `"all"`
- **CLI:** `--target=<mode>`

| Value | Description |
|-------|-------------|
| `"all"` | Analyze both React components and functions |
| `"components"` | Analyze only React components (JSX usage) |
| `"functions"` | Analyze only functions and class methods |

```js
export default {
  target: "components", // Only analyze React components
};
```

## output

Controls the verbosity of the output.

- **Type:** `"simple" | "verbose"`
- **Default:** `"simple"`
- **CLI:** `--output=<mode>`

| Value | Description |
|-------|-------------|
| `"simple"` | Show only functions with constant arguments |
| `"verbose"` | Show all exported functions and additional details |

```js
export default {
  output: "verbose", // Show all exported functions
};
```

## tsconfig

Path to the tsconfig.json file to use for TypeScript parsing.

- **Type:** `string`
- **Default:** `"./tsconfig.json"`
- **CLI:** `--tsconfig=<path>`

```js
export default {
  tsconfig: "./tsconfig.app.json",
};
```

::: warning
The file must exist. dittory will exit with an error if the specified tsconfig is not found.
:::

## targetDir

The directory to analyze.

- **Type:** `string`
- **Default:** `"./src"`
- **CLI:** Positional argument

```js
export default {
  targetDir: "./src/features",
};
```

::: info
When specified via CLI as a positional argument, it takes precedence over the config file:

```bash
dittory ./custom/path  # Uses ./custom/path, not config's targetDir
```
:::

## Complete Example

```js
// dittory.config.js
/** @type {import('dittory').DittoryConfig} */
export default {
  minUsages: 3,
  target: "all",
  output: "simple",
  tsconfig: "./tsconfig.json",
  targetDir: "./src",
};
```

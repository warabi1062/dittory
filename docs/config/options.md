# Options Reference

## All Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minUsages` | `number` | `2` | Minimum number of usages required to report |
| `target` | `AnalyzeMode` | `"all"` | What to analyze |
| `output` | `OutputMode` | `"simple"` | Output verbosity |
| `tsconfig` | `string` | `"./tsconfig.json"` | Path to tsconfig.json |
| `targetDir` | `string` | `"./src"` | Target directory to analyze |
| `valueTypes` | `ValueType[] \| "all"` | `"all"` | Value types to detect |

## minUsages

Minimum number of usages required before reporting a parameter as constant.

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
| `"simple"` | Show only constant parameters |
| `"verbose"` | Also show all analyzed functions |

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

```sh
$ dittory ./custom/path  # Uses ./custom/path, not config's targetDir
```
:::

## valueTypes

Specifies which types of values to detect as constants.

- **Type:** `("boolean" | "number" | "string" | "enum" | "undefined")[] | "all"`
- **Default:** `"all"`
- **CLI:** `--value-types=<types>`

| Value | Description |
|-------|-------------|
| `"boolean"` | Boolean literals (`true`, `false`) |
| `"number"` | Numeric literals (`42`, `3.14`, `-10`) |
| `"string"` | String literals (`"hello"`) |
| `"enum"` | Enum member values |
| `"undefined"` | Undefined values |
| `"all"` | Detect all types (default) |

```js
export default {
  valueTypes: ["boolean", "string"], // Only detect boolean and string constants
};
```

::: tip
Use this option to focus on specific types of constants. For example, if you only want to find hardcoded string values, use `valueTypes: ["string"]`.
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
  valueTypes: ["boolean", "number", "string"],
};
```

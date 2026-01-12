# Configuration File

You can create a configuration file to set default options. dittory looks for config files in the following order:

1. `dittory.config.js` or `dittory.config.mjs`
2. `dittory.config.json`

## JavaScript Config

```js
// dittory.config.js
/** @type {import('dittory').DittoryConfig} */
export default {
  minUsages: 3,
  target: "react-components",
  debug: true,
  tsconfig: "./tsconfig.app.json",
  targetDir: "./src",
  valueTypes: ["boolean", "string"], // or "all"
};
```

Using the `@type` JSDoc comment provides full TypeScript type checking and autocompletion in your editor.

## JSON Config

```json
{
  "minUsages": 3,
  "target": "react-components",
  "debug": true,
  "tsconfig": "./tsconfig.app.json",
  "targetDir": "./src",
  "valueTypes": ["boolean", "string"]
}
```

## Priority

CLI options take precedence over config file settings:

```
CLI options > Config file > Default values
```

For example, if your config file sets `minUsages: 3` but you run:

```sh
$ dittory --min=5
```

The effective `minUsages` will be `5`.

## TypeScript Support

The `DittoryConfig` type is exported from the package, allowing you to get full type safety in JavaScript config files:

```js
/** @type {import('dittory').DittoryConfig} */
export default {
  // Full autocompletion and type checking here
};
```

Related types are also exported:

- `AnalyzeMode` - `"all" | "react-components" | "functions"`

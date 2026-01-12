# CLI Options

## Usage

```sh
$ dittory [options] [directory]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--min=<n>` | Minimum number of usages required to report | `2` |
| `--target=<mode>` | What to analyze: `all`, `components`, `functions` | `all` |
| `--output=<mode>` | Output verbosity: `simple`, `verbose` | `simple` |
| `--tsconfig=<path>` | Path to tsconfig.json | `./tsconfig.json` |
| `--value-types=<types>` | Value types to detect (comma-separated) | `all` |
| `--help` | Show help message | — |

### Value Types

The `--value-types` option accepts the following values:

- `boolean` - Boolean literals (`true`, `false`)
- `number` - Numeric literals (`42`, `3.14`, `-10`)
- `string` - String literals (`"hello"`)
- `enum` - Enum member values
- `undefined` - Undefined values
- `all` - All types (default)

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `directory` | Target directory to analyze | `./src` |

## Examples

### Minimum Usage Count

Only report parameters that appear in at least 3 usages:

```sh
$ dittory --min=3
```

### Target Mode

Analyze only React components:

```sh
$ dittory --target=components
```

Analyze only functions and class methods:

```sh
$ dittory --target=functions
```

### Output Mode

Show detailed output including all exported functions:

```sh
$ dittory --output=verbose
```

### Custom tsconfig

Use a specific tsconfig.json file:

```sh
$ dittory --tsconfig=./tsconfig.app.json
```

### Value Types Filter

Only detect boolean and string constants:

```sh
$ dittory --value-types=boolean,string
```

Only detect numeric constants:

```sh
$ dittory --value-types=number
```

### Combining Options

```sh
$ dittory --min=3 --target=components --output=verbose ./src/features
```

```sh
$ dittory --min=2 --value-types=boolean,number,string ./src
```

## Output Formats

### Simple Mode (default)

Only shows functions/components with constant arguments:

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


---
Found 1 function(s) with constant arguments out of 24 function(s).
```

### Verbose Mode

Shows all exported functions, including those without constant arguments:

```
Target directory: ./src
Minimum usage count: 2
Analysis target: all

Button src/components/Button.tsx:15
Constant Arguments:
  - variant = "primary"
Usages (5):
  - src/pages/Home.tsx:23
  - src/pages/About.tsx:45
  ...

Input src/components/Input.tsx:8
No constant arguments found.
Usages (12):
  - src/pages/Login.tsx:15
  ...

---
Found 1 function(s) with constant arguments out of 24 function(s).
```

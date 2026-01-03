# CLI Options

## Usage

```bash
dittory [options] [directory]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--min=<n>` | Minimum number of usages to consider | `2` |
| `--target=<mode>` | What to analyze: `all`, `components`, `functions` | `all` |
| `--output=<mode>` | Output verbosity: `simple`, `verbose` | `simple` |
| `--tsconfig=<path>` | Path to tsconfig.json | `./tsconfig.json` |
| `--help` | Show help message | — |

## Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `directory` | Target directory to analyze | `./src` |

## Examples

### Minimum Usage Count

Only report parameters that appear in at least 3 usages:

```bash
dittory --min=3
```

### Target Mode

Analyze only React components:

```bash
dittory --target=components
```

Analyze only functions and class methods:

```bash
dittory --target=functions
```

### Output Mode

Show detailed output including all exported functions:

```bash
dittory --output=verbose
```

### Custom tsconfig

Use a specific tsconfig.json file:

```bash
dittory --tsconfig=./tsconfig.app.json
```

### Combining Options

```bash
dittory --min=3 --target=components --output=verbose ./src/features
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

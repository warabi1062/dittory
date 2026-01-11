# Limitations

This page documents patterns that dittory cannot detect or may not handle correctly.

## Spread Syntax

Props passed via spread are not tracked:

```tsx
// Not tracked
const Parent = ({ num, ...others }) => <Child {...others} />;
```

## Dynamic Values

Values computed at runtime cannot be analyzed:

```tsx
// Not tracked
<Button count={items.length} />
<Input value={getValue()} />
<List items={data.filter(x => x.active)} />
```

## Template Literals

Template strings with expressions are not supported:

```tsx
// Not tracked
<Label text={`Hello, ${name}`} />
```

## Array/Object Spread in Arguments

Spread in function arguments is not tracked:

```tsx
// Not tracked
fn(...args);
fn({ ...defaults, custom: value });
```

## Higher-Order Components / Render Props

HOC patterns are not analyzed:

```tsx
// Not tracked
const Enhanced = withAuth(Component);
<Enhanced role="admin" />
```

## Function Overloads

Overloaded functions may not correctly map arguments:

```ts
// Only parameters from the first overload signature are recognized
function process(a: string): void;
function process(a: string, b: number): void;
function process(a: string, b?: number): void { ... }

process("hello", 42);  // "b" argument is not tracked
```

## Non-Exported Functions

Only exported functions and components are analyzed:

```ts
// Tracked (exported)
export function publicFn(x: number) { ... }

// Not tracked (internal)
function internalFn(x: number) { ... }
```

## Conditional Branches

When different code paths pass different values, dittory correctly identifies them as different values (not constants). This is expected behavior:

```tsx
// Different values in branches → correctly NOT reported as constant
const App = () => {
  if (condition) {
    return <Button variant="primary" />;
  }
  return <Button variant="secondary" />;
};
```

Note: dittory performs static analysis and considers all code paths.

# Disabling Detection

You can exclude specific usages from detection using comments, similar to `eslint-disable-line`.

## Comment Directives

### `dittory-disable-next-line`

Excludes the next line from detection:

```ts
// dittory-disable-next-line
fetchData(id, { cache: false });
```

### `dittory-disable-line`

Excludes the same line from detection:

```ts
fetchData(id, { cache: false }); // dittory-disable-line
```

## Combining with Other Directives

These comments can be combined with other directive comments like `eslint-disable-line` or `@ts-ignore`:

```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// dittory-disable-next-line
const result = calculate(x);

doSomething(); // eslint-disable-line -- dittory-disable-line
```

The order of directives doesn't matter. dittory will detect the directive as long as it appears in the comment.

## Use Cases

### Intentionally Constant Values

Sometimes a value should always be the same, and you want to document this:

```ts
// This endpoint always requires authentication
// dittory-disable-next-line
await fetchApi('/users', { requireAuth: true });
```

### Test Files

In tests, you might intentionally use the same value repeatedly:

```ts
// dittory-disable-next-line
render(<Button variant="primary" />);
// dittory-disable-next-line
render(<Button variant="primary" />);
```

### Legacy Code

When working with legacy code that can't be refactored immediately:

```ts
// TODO: Refactor to use default value
// dittory-disable-next-line
legacyFunction(param, { oldOption: true });
```

## Note

JSX comments (`{/* */}`) are not supported for disabling detection. Use regular JavaScript comments instead:

```tsx
// Works
// dittory-disable-next-line
<Button variant="primary" />

// Does NOT work
{/* dittory-disable-next-line */}
<Button variant="primary" />
```

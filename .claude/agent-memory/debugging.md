# Debugging Notes

Document failed approaches here before starting new sessions. Prevents repeating dead ends.

## Format

```
### [Date] Brief description
**What failed:** ...
**Why it failed:** ...
**What worked instead:** ...
```

---

## Known Gotchas (from LL-G)

These are HIGH-severity gotchas for this project's tech stack.
See LL-G for full details: https://github.com/wellforce-brandon/LL-G

### TypeScript

- **Type assertions with `as` bypass runtime safety:** `as` tells the type checker to trust you unconditionally. Use type guards, `satisfies`, `instanceof`, or Zod for external data instead. Only use `as` when the type system genuinely can't express the shape. (HIGH)

### Tailwind CSS

- **Dynamic class construction silently fails:** Tailwind's JIT only detects class names statically. String concatenation or template literals that build class names at runtime produce CSS that never gets generated. Use a static lookup map of complete class strings. (HIGH)
- **Conditional classes need `cn()` (clsx + tailwind-merge):** When conflicting utilities exist (e.g., `p-2` and `p-4`), CSS cascade order decides the winner, not string order. Always use `cn()` so the last class in code order wins reliably. (HIGH)
- **Tailwind 4.x workspace import resolution:** With `@tailwindcss/vite` in a pnpm workspace, `@import "tailwindcss"` resolves relative to the package directory, not the consuming app. Each workspace package with CSS must declare `tailwindcss` as its own devDependency. (HIGH, less relevant for single-package Janki but worth knowing)

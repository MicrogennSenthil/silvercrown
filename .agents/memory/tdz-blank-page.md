---
name: TDZ blank-page pattern
description: React component renders blank white page due to JavaScript Temporal Dead Zone — const variable used in useEffect dependency array before its declaration in the function body.
---

## Rule
Never reference a `const` variable in a `useEffect` dependency array before the `const` is declared later in the same component function body.

## Why
When React calls the component function, it evaluates the dependency array argument `[..., fyStartDate, ...]` at the point of the `useEffect(callback, deps)` call. If `fyStartDate` is declared with `const` AFTER that line, it is in the Temporal Dead Zone and JavaScript throws `ReferenceError: Cannot access 'fyStartDate' before initialization`. React 18 without an ErrorBoundary swallows this and shows a blank white page — no error overlay in production.

TypeScript warns with `TS2448: Block-scoped variable used before its declaration` and `TS2454: Variable is used before being assigned` — these warnings are a reliable signal of this bug.

## How to apply
- When diagnosing a blank-white-page React bug, run `npx tsc --noEmit` and look for TS2448/TS2454 errors — they pinpoint TDZ crashes that produce blank pages.
- Fix: move the `const` declaration to ABOVE the `useEffect` that references it in its dependency array.
- The VPS silvercrown deploy stashes local changes before pulling: if deploy fails with "local changes overwritten by merge", SSH in and `git stash` then re-pull manually.

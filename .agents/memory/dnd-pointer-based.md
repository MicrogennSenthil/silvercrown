---
name: Drag-and-drop must be pointer-based, not native HTML5
description: Native HTML5 DnD proved unreliable in this app's production; use pointer events instead.
---

Native HTML5 drag-and-drop (`draggable`, `onDragStart`/`onDragOver`/`onDrop`, `dataTransfer`)
was implemented for the General Ledger tree (move GL across categories, reassign SL to a GL)
and repeatedly reported as "not working" in production despite correct-looking code.

**Rule:** For drag-and-drop in this codebase, use a pointer-event system, not native HTML5 DnD.

**How to apply:**
- `onPointerDown` on the row starts a *pending* drag (ignore if `e.target.closest("button")` so action buttons/toggles still work; require `e.button === 0`).
- Window `pointermove` listener: only activate after a small movement threshold (~6px) so taps/clicks still register; render a fixed-position ghost following the pointer.
- Detect drop target with `document.elementFromPoint(x,y)` + `el.closest("[data-dnd-*]")` data attributes on the target rows/zones.
- Window `pointerup` performs the move (PATCH); always also register `pointercancel` and a component-unmount cleanup that removes all listeners and resets state, or listeners/state leak and break later interactions.
- Keep handlers stable with `useCallback([])` reading mutable drag state from refs to avoid stale closures.

**Why:** Native DnD ghost/drop events were flaky in the deployed environment; pointer events give full control and work consistently across browsers/touch.

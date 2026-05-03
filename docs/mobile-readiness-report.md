# Mobile Readiness Report

**Date:** 2026-05-03
**Branch:** fix/sprint-1-bugs
**Scope:** React/Vite/Tailwind front-end at `src/`

## Executive Summary

The application is **not ready for serious use on mobile devices**. It is technically reachable from a phone — the viewport meta tag is set, the app boots, the root layout uses flexbox — but most of the primary interactions assume a mouse, a wide viewport, and a precise pointer.

The most damaging issues are concentrated where a list-builder/explorer must shine on mobile:

- **Hover-only tooltips** (notably `WeaponTooltip`) reveal critical game data and have no tap equivalent.
- **Right-click context menus** (`ContextMenu` + global `onContextMenu` in `App.tsx`) are the only path to several actions and are inaccessible on touch.
- **Tables** (`WeaponTable`, `WoundsTable`, `SearchPage`'s pseudo-table, `ReferencePage`) use fixed pixel widths and never reflow.
- **`NavBar`** is a horizontal strip of small tabs with no mobile menu.

Encouragingly, the foundation is workable: Tailwind is already in place, a `useIsMobile()` hook exists, and `WorkspaceView` already implements a swipe carousel for mobile — so there is precedent and infrastructure to build on. But responsive prefixes (`sm:`, `md:`, `lg:`) appear in **only ~10 places across the entire codebase**, and Playwright tests only Desktop Chrome.

**Overall grade: D.** The app will load on a phone and the workspace columns are usable, but most builder, search, and reference flows are functionally broken on a 375px-wide screen.

---

## What's Already Working

| Area | Status | Evidence |
|---|---|---|
| Viewport meta tag | OK | `index.html:6` — `width=device-width, initial-scale=1.0` |
| Root layout | OK | `src/App.tsx` — flex column, `h-screen`, no fixed pixel widths |
| Mobile detection hook | OK | `src/hooks/useIsMobile.ts` (768px breakpoint) |
| Workspace mobile mode | Good | `WorkspaceView.tsx:64-89` swipe handlers + `WorkspaceView.module.css:82-125` carousel |
| Modal sizing | OK | `ImportFromCodeModal`, `NewListModal` use `width:100%; maxWidth:480px` |
| Drag-and-drop sensors | OK | `ArmyListPanel.tsx:145-148` uses `PointerSensor` w/ 8px activation — touch compatible |
| Tailwind foundation | OK | `tailwind.config.js` — defaults are mobile-first |

---

## Critical Issues

### 1. Hover-only tooltips and previews

`src/components/shared/WeaponTooltip.tsx` (currently being modified) and `src/components/shared/ExpandableUnitCard.tsx` rely on `onMouseEnter` / `onMouseLeave` / `onMouseMove` to surface data. Touch devices fire none of these reliably, so the data is hidden.

- `WeaponTooltip.tsx:175-177` — pure mouse handlers, no `onTouch*` or click fallback.
- Tooltip is positioned at the cursor (`pos.x + 15`, `pos.y + 15`), which has no analog on touch.
- The wider stylesheet (`src/index.css`) contains 30+ hover-only state selectors (`.filter-remove:hover`, `.suggestion-item:hover`, `.faction-card:hover`, `.results-table tbody tr:hover`) with no `:active` or `:focus-visible` counterpart.

**Impact:** Players cannot inspect weapon profiles, unit details, or filter affordances on a phone.

### 2. Right-click as the only path

- `src/App.tsx:22` registers a global `onContextMenu` handler.
- `src/components/ContextMenu.tsx` is a fixed-position menu with `min-w-[260px]` — wider than ~85% of common phone widths.
- `DraggableUnitRow` exposes per-row actions only through right-click.

Touch devices have no `contextmenu` event without long-press, and no long-press handler exists. This silently removes a class of actions on mobile.

### 3. Tables don't reflow

| File | Problem |
|---|---|
| `src/pages/SearchPage.tsx:33-36` | Pseudo-table columns hardcoded `w-[50px]`, `w-[200px]`, `w-[80px]` — overflows < 375px screens with no horizontal scroll wrapper |
| `src/components/.../WeaponTable.tsx` | Real `<table>` with 9 columns and inline `width:%` — no mobile card/stack mode |
| `src/components/.../WoundsTable.tsx` | Two `<table>`s side-by-side, no media query to stack |
| `src/pages/ReferencePage.tsx` | Sortable data table; no responsive treatment |

There is one media query in the entire CSS codebase (in `WorkspaceView.module.css`); none of it goes to tables.

### 4. NavBar has no mobile shape

`src/components/NavBar.tsx` lays its tabs/tools out horizontally with `padding: 0.4rem 0.6rem` (~24px tap height). It uses `useIsMobile()` (line 35) but only hides a couple of builder-specific controls (line 101). There is no hamburger, no collapse, no overflow menu.

### 5. Test coverage assumes desktop

`playwright.config.ts` defines a single project — `Desktop Chrome`. There is no Pixel/iPhone/iPad project, no viewport variation, and the only spec (`e2e/smoke.spec.ts`) checks console errors. Mobile regressions cannot be caught in CI today.

---

## High-Priority Issues

### Touch targets below the 44px guideline

- `ExpandableUnitCard.tsx:79` — attribute cells `min-w-[32px]`.
- `ExpandableUnitCard.tsx:173,177` — stats columns `min-w-[50px]` (height likely small too).
- `WeaponTooltip.tsx:80` — external-link icon `size={12}` with no extra padding.
- `WorkspaceView.module.css:112-114` — mobile column dots are `7px` wide.
- The workspace column drag divider is ~5px wide.
- Multiple icon-only controls render at `size={14}` or `size={16}` without explicit hit-area padding.

### Hardcoded widths likely to overflow

- `ContextMenu.tsx:74` — `min-w-[260px]` (covered above).
- `SearchPage.tsx` columns (covered above).
- Various `max-h-[28rem]` / `max-h-[32rem]` dropdowns (`FactionSelector`, `MultiFactionSelector`) can exceed phone heights.
- Page-level `maxWidth` containers (`SearchPage` 56–64rem; `MyLists` 1100px; `ReferencePage` 1400px) are fine as caps but don't pair with any responsive interior layout.

### Type sizes below readable thresholds

- ~63 instances of `text-[10px]`, plus `text-[9px]` and `text-[8px]` (range bands in `WeaponTooltip.tsx:137`).
- Used for stat labels, classification badges, and equipment headings — exactly the data players want to read on the go.

---

## Medium-Priority Issues

- **No PWA surface.** No `public/manifest.json`, no service worker, no `theme-color` / `apple-mobile-web-app-*` meta tags, no install prompt. For a reference/builder app, even a shell-cached PWA would be a meaningful upgrade.
- **Responsive prefixes barely used.** `sm:`, `md:`, `lg:`, `xl:` appear in only 4 files (`ComparePage.tsx`, `DiceAnalyticsPage.tsx`, plus a couple of utility usages). Most components have no breakpoint awareness at all.
- **Dropdown overflow handling is inconsistent.** Some use viewport-aware repositioning (`ContextMenu.tsx:47-67`, `WeaponTooltip.tsx:43-44`), others assume desktop space.
- **Mobile carousel only covers `columns` layout.** The floating-window workspace mode does not adapt — windows are draggable but presume a large canvas.
- **Swipe threshold of 50px** in `WorkspaceView.tsx` (line ~83) may be high for small-thumb users; tune toward ~30px.

---

## Worst Offenders (ranked)

1. `src/components/shared/WeaponTooltip.tsx` — hover-only, mouse-positioned, currently being edited.
2. `src/components/shared/ExpandableUnitCard.tsx` — hover previews + small touch targets, currently being edited.
3. `src/pages/SearchPage.tsx` — fixed-pixel pseudo-table.
4. `src/components/.../WeaponTable.tsx` — real table with 9 columns, no mobile mode.
5. `src/components/NavBar.tsx` — no mobile menu.
6. `src/components/ContextMenu.tsx` + global `onContextMenu` in `App.tsx` — right-click is mandatory.
7. `src/pages/ReferencePage.tsx` and `WoundsTable.tsx` — wide static tables.

---

## Recommended Roadmap

### Phase 1 — Make the core flows usable on a phone

- Add tap-to-open behavior to `WeaponTooltip` and `ExpandableUnitCard` previews; keep hover for desktop. A small `usePointerInteraction` hook (or just a tap handler that toggles `pinned` state) is enough.
- Replace right-click-only actions with a long-press or explicit "⋯" button on touch. Keep right-click as the desktop accelerator.
- Add Playwright projects for Pixel 5 and iPhone 12 to `playwright.config.ts`, and add a smoke test that scrolls the main pages at 375px width without horizontal overflow.
- Give `NavBar` a mobile shape: collapse tools/tabs into an overflow menu under `md:`.

### Phase 2 — Fix the read-heavy surfaces

- Convert `WeaponTable`, `WoundsTable`, and the `SearchPage` pseudo-table to a card/stack layout below `md:` (Tailwind `md:table md:flex` patterns work well).
- Cap `ContextMenu` width at `min(90vw, 260px)` and reposition relative to viewport on small screens.
- Bump the smallest type sizes (`text-[10px]` in critical labels) to at least 12px on `< sm`.

### Phase 3 — Polish

- Add PWA manifest + service worker with shell + game-data caching (game data is static JSON per `project_architecture.md`, so this is high-leverage).
- Add `theme-color` and `apple-mobile-web-app-*` meta tags.
- Audit hit areas for icon buttons; ensure ≥ 40px on touch (Tailwind `p-2.5` around `size={16}` gets you there).
- Extend the mobile carousel to the floating-window workspace mode, or fall back to columns on small screens.

### Phase 4 — Nice to have

- Offline play for the explorer flows.
- Pinch-zoom or swipe affordances on dense data views.
- Responsive typography scale instead of one-off `text-[10px]` overrides.

---

## Quick Wins (≤ 1 day each)

- Add `Mobile Chrome` / `Mobile Safari` projects to `playwright.config.ts`.
- Cap `ContextMenu` `min-w-[260px]` → `min-w-[min(260px,90vw)]`.
- Change `WeaponTooltip` to also pin on click/tap (`onClick` toggles a `pinned` state; close on outside click).
- Wrap `SearchPage` and `WeaponTable` in `overflow-x-auto` so at least nothing gets clipped while a real responsive layout is in flight.
- Add `theme-color` and `apple-mobile-web-app-capable` meta tags to `index.html`.

---

## Appendix: Coverage Stats

- Responsive Tailwind prefix usages across `src/`: ~10 (in 4 files).
- CSS media queries across `src/`: 1 (`WorkspaceView.module.css`).
- Files using `useIsMobile()`: 3 (`WorkspaceView`, `NavBar`, dice analytics charts).
- Playwright projects: 1 (`Desktop Chrome`).
- PWA artifacts: 0 (no manifest, no service worker).

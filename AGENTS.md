# AGENTS.md - Comprehensive Agent Context for Infinity Data Explorer

> **For AI Agents**: This document provides deep context for understanding and working on this codebase. Read thoroughly before making changes.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Directory Structure](#directory-structure)
4. [Architecture & Design Patterns](#architecture--design-patterns)
5. [Data Layer Deep Dive](#data-layer-deep-dive)
6. [Component Reference](#component-reference)
7. [Page Reference](#page-reference)
8. [Hooks & Contexts](#hooks--contexts)
9. [Utility Modules](#utility-modules)
10. [Type System](#type-system)
11. [Styling System](#styling-system)
12. [Development Workflow](#development-workflow)
13. [Testing Strategy](#testing-strategy)
14. [Deployment](#deployment)
15. [Common Tasks & Patterns](#common-tasks--patterns)
16. [Code Conventions & Anti-Patterns](#code-conventions--anti-patterns)
17. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Infinity Data Explorer** is a client-side React web application for querying, exploring, and comparing unit data from the **Infinity** tabletop miniatures game by Corvus Belli.

### Core Features
1. **Unit Search**: Find units by weapon, skill, or equipment with modifier-aware filtering (e.g., "Mimetism(-6)" vs "Mimetism(-3)")
2. **Reference Lists**: Browse all game items (weapons, skills, equipment) with wiki links and unit counts
3. **Weapon Ranges**: Visualize weapon range modifiers with D3-based graphs and comparative analysis
4. **Faction Comparison**: Compare unit availability across multiple factions with Venn diagram-style overlap analysis
5. **Fireteam Builder**: Explore fireteam compositions, bonuses, and unit eligibility per sectorial army

### Design Philosophy
- **Fast, modern UI**: Dark theme with smooth animations (Framer Motion)
- **Purely client-side**: No backend—all data loaded from static JSON files
- **Dependency Injection**: Services accessed via React Context for testability
- **Responsive Design**: Works on desktop and mobile browsers

### Live Site
Hosted on GitHub Pages: `https://[username].github.io/infinity-data-browser/`

---

## Technology Stack

### Frontend Core
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7.2 | Build tool & dev server |
| Vitest | 4.0 | Unit testing |

### UI & Styling
| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | 4.x | Utility-first styling (v4 uses `@import "tailwindcss"`) |
| Custom CSS Variables | - | Design tokens in `index.css` |
| Framer Motion | 12.x | Animations & transitions |
| Lucide React | 0.559 | Icon library |
| Headless UI | 2.2 | Unstyled accessible components |

### Libraries
| Library | Purpose |
|---------|---------|
| D3 | Data visualization (weapon range graphs, bubble charts) |
| React Router DOM | Client-side routing (using `HashRouter` for GitHub Pages) |
| clsx / tailwind-merge | Class name composition |

### No Backend
- All data is static JSON loaded at runtime via `fetch()`
- Data files are ~45MB total across 46 faction files + metadata

---

## Directory Structure

```
infinity-data/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment workflow
├── data/                        # Source unit data (46 JSON files, ~45MB)
│   ├── metadata.json            # Global lookups (factions, weapons, skills, equipment)
│   └── [faction-slug].json      # Per-faction unit data files
├── public/
│   └── data -> ../data          # Symlink for Vite to serve data files
├── src/
│   ├── App.tsx                  # Root component with routing
│   ├── main.tsx                 # Entry point with providers
│   ├── index.css                # All CSS (design tokens + component styles)
│   ├── components/              # Reusable React components (18 files)
│   ├── pages/                   # Route-level page components
│   │   ├── SearchPage.tsx       # Home/search page
│   │   ├── ReferencePage.tsx    # Reference lists
│   │   ├── RangesPage.tsx       # Weapon analysis (with CSS file)
│   │   ├── ComparePage.tsx      # Faction comparison (with CSS file)
│   │   └── FireteamsPage/       # Fireteam feature (multi-file)
│   ├── services/
│   │   ├── Database.ts          # Core data service (480 lines)
│   │   └── Database.test.ts     # Unit tests
│   ├── context/
│   │   ├── DatabaseContext.tsx  # Database provider & initialization
│   │   └── ModalContext.tsx     # Modal state management
│   ├── hooks/
│   │   ├── useDatabase.ts       # Hook to access IDatabase
│   │   ├── useModal.ts          # Hook to access modal context
│   │   ├── useUnitSearch.ts     # Search state encapsulation
│   │   └── useUnitSearch.test.ts
│   ├── utils/
│   │   ├── factions.ts          # FactionRegistry class (7KB)
│   │   ├── factions.test.ts     # Tests
│   │   ├── fireteams.ts         # Fireteam bonus calculations
│   │   ├── fireteams.test.ts    # Tests
│   │   └── conversions.ts       # Unit conversion utilities (cm→inches)
│   ├── types/
│   │   └── index.ts             # All TypeScript interfaces
│   ├── assets/                  # Static assets
│   ├── setupTests.ts            # Vitest setup
│   └── vite-env.d.ts            # Vite type declarations
├── scripts/
│   └── identify_factions.py     # Python utility for data analysis
├── package.json
├── vite.config.ts               # Vite config (base path, test config)
├── tailwind.config.js           # Tailwind theme extensions
├── tsconfig.json / tsconfig.app.json
├── eslint.config.js             # ESLint flat config
└── postcss.config.js
```

---

## Architecture & Design Patterns

### Dependency Injection via Context
The `Database` is a singleton but accessed via React Context for:
- Testability (can provide mock implementations)
- Guaranteed initialization before component render
- Type safety with `IDatabase` interface

```tsx
// Provider wraps app in main.tsx
<DatabaseProvider>
  <App />
</DatabaseProvider>

// Components access via hook
const db = useDatabase();
const results = db.searchWithModifiers([...], 'and');
```

### Component Architecture

```
Layout (NavBar + content)
├── Pages (route-level, own state)
│   ├── SearchPage
│   │   ├── QueryBuilder (search input)
│   │   ├── FilterBar (faction filters)
│   │   └── ResultsTable/FactionView/BubbleChart (views)
│   ├── ReferencePage
│   ├── RangesPage (weapons analysis)
│   ├── ComparePage (faction comparison)
│   └── FireteamsPage
│       ├── FireteamBuilder
│       ├── FireteamListView
│       └── UnitPerspectiveView
└── Modals (global via context)
    └── UnitStatsModal
```

### State Management
- **Local state**: `useState` for component-level UI state
- **Derived state**: `useMemo` for filtered/computed data
- **Global state**: React Context for Database and Modal
- **No Redux/Zustand**: App is simple enough for Context

### Routing
Uses `HashRouter` (not `BrowserRouter`) because GitHub Pages doesn't support client-side routing with clean URLs.

```tsx
// App.tsx
<HashRouter>
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<SearchPage />} />
      <Route path="/reference" element={<ReferencePage />} />
      <Route path="/ranges" element={<RangesPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/fireteams" element={<FireteamsPage />} />
    </Route>
  </Routes>
</HashRouter>
```

---

## Data Layer Deep Dive

### Data Files Location
- Source: `data/` directory (46 files, ~45MB total)
- Served via: `public/data/` symlink
- Loaded at: App startup in `Database.init()`

### metadata.json Structure
Global lookup tables for all game items:

```jsonc
{
  "factions": [
    { "id": 101, "parent": 101, "name": "PanOceania", "slug": "panoceania", "discontinued": false, "logo": "..." }
    // parent === id means it's a "vanilla" super-faction
    // parent !== id means it's a sectorial under that super-faction
  ],
  "weapons": [
    {
      "id": 3,
      "name": "AP Heavy Machine Gun",
      "type": "WEAPON",
      "ammunition": 3,      // References ammunitions array
      "burst": "4",
      "damage": "5",
      "saving": "ARM/2",
      "savingNum": "1",
      "properties": ["Suppressive Fire"],
      "distance": {
        "short": { "max": 20, "mod": "-3" },  // Range in cm, modifier string
        "med":   { "max": 40, "mod": "0" },
        "long":  { "max": 80, "mod": "+3" },
        "max":   { "max": 120, "mod": "-3" }
      }
    }
    // distance: null for CC weapons
  ],
  "skills": [
    { "id": 191, "name": "Mimetism", "wiki": "https://infinitythewiki.com/..." }
  ],
  "equips": [
    { "id": 50, "name": "Multispectral Visor L1", "wiki": "..." }
  ],
  "ammunitions": [
    { "id": 3, "name": "AP", "wiki": "..." }
  ]
}
```

### [faction].json Structure
Per-faction unit data with fireteam charts:

```jsonc
{
  "units": [
    {
      "id": 12345,
      "isc": "FUSILIER",           // Internal Short Code (unique identifier)
      "name": "Fusilier",
      "factions": [101, 104, 107], // All faction IDs this unit belongs to
      "slug": "fusilier",
      "profileGroups": [
        {
          "id": 1,
          "isc": "FUSILIER",
          "isco": "Fusilier",      // Display name for this profile group
          "profiles": [
            {
              "id": 1,
              "name": "Fusilier",
              "move": [10, 5],     // First/second movement values in cm
              "cc": 13, "bs": 12, "ph": 10, "wip": 12,
              "arm": 1, "bts": 0, "w": 1, "s": 2,
              "str": false,       // true = Structure (TAG), false = Wounds
              "type": 1,          // Unit type: 1=LI, 2=MI, 3=HI, 5=TAG, etc.
              "skills": [
                { "id": 191, "extra": [6] }  // Mimetism with modifier ID 6
              ],
              "equip": [
                { "id": 50 }                 // Equipment without modifiers
              ],
              "weapons": [
                { "id": 42 }                 // Combi Rifle
              ]
            }
          ],
          "options": [
            {
              "id": 1,
              "name": "Combi Rifle",
              "points": 10,
              "swc": 0,
              "skills": [], "equip": [], "weapons": []
            }
          ]
        }
      ]
    }
  ],
  "filters": {
    "extras": [
      { "id": 6, "name": "-3" },
      { "id": 7, "name": "-6" }
    ]
  },
  "fireteamChart": {
    "spec": { "CORE": 1, "HARIS": 1, "DUO": 256 },
    "teams": [
      {
        "name": "Fusilier Fireteam",
        "type": ["CORE", "HARIS", "DUO"],
        "units": [
          { "name": "Fusilier", "slug": "fusilier", "min": 0, "max": 5 },
          { "name": "Machinist", "slug": "machinist", "min": 0, "max": 1, "comment": "Wildcard" }
        ],
        "obs": "Optional note about this fireteam"
      }
    ]
  }
}
```

### Modifier System (The `extra` Field)

Skills and equipment can have modifiers (e.g., Mimetism(-6) vs Mimetism(-3)):

1. **In unit data**: A skill/equip has `{ id: 191, extra: [6] }` where:
   - `id` references the skill/equip in metadata
   - `extra` is an array of modifier IDs

2. **In faction file**: The `filters.extras` array maps modifier IDs to display values:
   ```json
   { "id": 6, "name": "-3" }
   ```

3. **Display logic**: 
   - `extra: [6]` for Mimetism → displays as "Mimetism(-3)"
   - `extra: [7]` for Mimetism → displays as "Mimetism(-6)"
   - Use `db.getExtraName(modId)` or `db.extrasMap.get(modId)` to get display string

4. **Search handling**:
   - Users can search for specific modifiers: "Mimetism(-6)"
   - Or any variant: "Mimetism (any)"
   - The `matchAnyModifier` flag controls this behavior

---

## Component Reference

### Core Components (`src/components/`)

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Layout.tsx` | App shell with `NavBar` + `<Outlet />` | - |
| `NavBar.tsx` | Top navigation with route links | - |
| `QueryBuilder.tsx` | Search input with autocomplete suggestions | `query`, `setQuery` |
| `FilterBar.tsx` | Faction filter dropdown with search | `filters`, `setFilters` |
| `ResultsTable.tsx` | Tabular view of search results | `units`, `query` |
| `FactionView.tsx` | Grouped view by faction (Availability/By Faction) | `units` |
| `BubbleChart.tsx` | D3 bubble visualization by faction | `units` |
| `UnitStatsModal.tsx` | Full unit stats modal (22KB, complex) | Uses `ModalContext` |
| `UnitCard.tsx` | Compact unit display card | `unit` |
| `UnitLink.tsx` | Clickable unit name that opens modal | `unit` |
| `FactionSelector.tsx` | Dropdown for selecting a faction | `value`, `onChange` |
| `Sidebar.tsx` | Generic sidebar container | `children` |
| `LoadingScreen.tsx` | Shown during database initialization | - |
| `EmptyState.tsx` | Placeholder for empty results | - |
| `SearchBar.tsx` | Alternative search UI | - |
| `SearchInput.tsx` | Basic search input | - |
| `SearchOmnibar.tsx` | Universal search input | - |
| `ResultGrid.tsx` | Grid layout for results | - |

### QueryBuilder State Shape
```typescript
interface QueryState {
  filters: QueryFilter[];
  operator: 'and' | 'or';
}

interface QueryFilter {
  type: 'weapon' | 'skill' | 'equipment';
  baseId: number;           // ID from metadata
  modifiers: number[];      // Specific modifier IDs to match
  matchAnyModifier: boolean; // true = match any variant
}
```

### FilterBar State Shape
```typescript
interface FiltersState {
  factions: number[];  // Selected faction IDs (empty = all)
}
```

---

## Page Reference

### SearchPage (`/`)
- Main search interface
- Uses `useUnitSearch` hook for state management
- Three view modes: Table, By Faction, Bubbles
- Components: `QueryBuilder`, `FilterBar`, `ResultsTable`/`FactionView`/`BubbleChart`

### ReferencePage (`/reference`)
- Three tabs: Skills, Weapons, Equipment
- Shows all items with unit counts and wiki links
- Toggle for unified vs. variant display (e.g., "Mimetism" vs "Mimetism(-3)", "Mimetism(-6)")
- Item click opens table of units with that item

### RangesPage (`/ranges`)
- Weapon range analysis tool
- Select weapons to see range modifiers visualized
- D3-based line graph of modifiers by distance
- Template weapon detection (teardrop patterns)
- "Best Options per Range" analysis
- Has dedicated CSS file: `RangesPage.css`

### ComparePage (`/compare`)
- Multi-faction comparison tool
- Add factions via dropdown or "Add All Sectorials" for super-faction
- Shows unit overlap/unique units per faction
- Venn-diagram style analysis
- Has dedicated CSS file: `ComparePage.css`

### FireteamsPage (`/fireteams`)
- Multi-file feature in `pages/FireteamsPage/`
- Faction selector to choose sectorial
- Three views:
  1. **Fireteam List**: All available fireteams for faction
  2. **Unit Analysis**: Which fireteams each unit can join
  3. **Fireteam Builder**: Interactive composition builder with bonus calculation
- Uses `utils/fireteams.ts` for bonus logic

---

## Hooks & Contexts

### DatabaseContext (`src/context/DatabaseContext.tsx`)
Provides the `IDatabase` instance to the entire app.

```tsx
// Initialization flow
export const DatabaseProvider = ({ children }) => {
  const [db] = useState(() => DatabaseImplementation.getInstance());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    db.init().then(() => setInitialized(true));
  }, [db]);

  if (!initialized) return <LoadingScreen />;
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
};
```

### useDatabase (`src/hooks/useDatabase.ts`)
Hook to access the database. Throws if used outside provider.

```tsx
export const useDatabase = (): IDatabase => {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used within DatabaseProvider');
  return db;
};
```

### ModalContext (`src/context/ModalContext.tsx`)
Manages the `UnitStatsModal` state globally.

```typescript
interface ModalContextType {
  openUnitModal: (unit: Unit) => void;
  closeModal: () => void;
  selectedUnit: Unit | null;
  isOpen: boolean;
}
```

### useModal (`src/hooks/useModal.ts`)
Hook to control modal. Returns `openUnitModal`, `closeModal`, `selectedUnit`, `isOpen`.

### useUnitSearch (`src/hooks/useUnitSearch.ts`)
Encapsulates search state and filtering logic:

```typescript
export const useUnitSearch = (db: IDatabase, loading: boolean) => {
  const [query, setQuery] = useState<QueryState>({ filters: [], operator: 'or' });
  const [filters, setFilters] = useState<FiltersState>({ factions: [] });

  const filteredUnits = useMemo(() => {
    if (query.filters.length === 0) return [];
    let results = db.searchWithModifiers(query.filters, query.operator);
    if (filters.factions.length > 0) {
      results = results.filter(unit => 
        unit.factions.some(fid => filters.factions.includes(fid))
      );
    }
    return results;
  }, [query, filters, loading, db]);

  return { query, setQuery, filters, setFilters, filteredUnits, hasSearch: query.filters.length > 0 };
};
```

---

## Utility Modules

### factions.ts (`src/utils/factions.ts`)
Contains `FactionRegistry` class for:
- Faction name lookups (full name, short name)
- Super-faction grouping (PanO → Acontecimento, Military Orders, etc.)
- Data availability checking (which factions have JSON files)

**Key exports**:
- `FactionInfo` interface: Complete faction metadata
- `SuperFaction` interface: Parent + sectorials grouping
- `FactionRegistry` class: All faction operations

**Short name derivation**: Uses `SHORT_NAME_OVERRIDES` map and automatic derivation for unmapped factions.

### fireteams.ts (`src/utils/fireteams.ts`)
Fireteam bonus calculation logic:

**Key exports**:
- `getUnitTags(name, comment)`: Parses "Counts as" and "Wildcard" from unit comments
- `calculateFireteamLevel(teamName, members)`: Determines fireteam level (1-5) based on composition
- `getFireteamBonuses(team, members)`: Returns array of active/inactive bonuses
- `analyzeUnitForTeam(unit, team, entry)`: Checks if unit can join team type

**Fireteam bonus levels**:
1. Level 1: Coherent Front (base activation)
2. Level 2: BS Attack (+1 SD)
3. Level 3: +3 Discover and +1" Dodge
4. Level 4: +1 BS
5. Level 5: Sixth Sense

### conversions.ts (`src/utils/conversions.ts`)
Unit conversion utilities:
- `cmToInches(cm)`: Converts centimeters to inches (data is in cm)
- `formatDistance(cm)`: Returns formatted string like `4"` or `8"`

---

## Type System

All types are in `src/types/index.ts`. Key interfaces:

### Unit (Enriched)
```typescript
interface Unit {
  id: number;
  isc: string;              // Internal Short Code
  name: string;
  factions: number[];       // All faction IDs
  allWeaponIds: Set<number>;
  allSkillIds: Set<number>;
  allEquipmentIds: Set<number>;
  allItemsWithMods: ItemWithModifier[];  // For modifier-aware search
  pointsRange: [number, number];         // [min, max] cost
  raw: UnitRaw;             // Original JSON data
}
```

### ItemWithModifier
```typescript
interface ItemWithModifier {
  id: number;
  name: string;
  type: 'skill' | 'equipment' | 'weapon';
  modifiers: number[];  // The 'extra' values
}
```

### Profile (from raw data)
```typescript
interface Profile {
  id: number;
  name: string;
  move: number[];       // [first, second] movement values in cm
  cc: number; bs: number; ph: number; wip: number;
  arm: number; bts: number; w: number; s: number;
  str?: boolean;        // true = Structure (TAG), false = Wounds
  type?: number;        // 1=LI, 2=MI, 3=HI, 5=TAG, etc.
  skills: { id: number; extra?: number[] }[];
  equip: { id: number; extra?: number[] }[];
  weapons: { id: number; extra?: number[] }[];
}
```

### SearchSuggestion
```typescript
interface SearchSuggestion {
  id: number;
  name: string;           // Base name: "Mimetism"
  displayName: string;    // "Mimetism(-6)" or "Mimetism (any)"
  type: 'weapon' | 'skill' | 'equipment';
  modifiers: number[];
  isAnyVariant: boolean;
}
```

### Fireteam Types
```typescript
interface FireteamUnit {
  name: string;
  slug: string;
  min: number;
  max: number;
  required?: boolean;
  comment?: string;  // Contains "Wildcard", "Counts as X", etc.
}

interface Fireteam {
  name: string;
  type: string[];    // ["CORE", "HARIS", "DUO"]
  units: FireteamUnit[];
  obs?: string;
}

interface FireteamChart {
  spec: Record<string, number>;
  desc?: string;
  teams: Fireteam[];
}
```

---

## Styling System

### Design Tokens
All CSS custom properties are defined in `src/index.css`:

```css
:root {
  /* Core Colors */
  --bg-primary: #0a0a0b;
  --bg-secondary: #111113;
  --bg-tertiary: #18181b;
  --bg-elevated: #1f1f23;

  /* Surface Colors */
  --surface: rgba(255, 255, 255, 0.03);
  --surface-hover: rgba(255, 255, 255, 0.06);
  --surface-active: rgba(255, 255, 255, 0.08);

  /* Text Colors */
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;

  /* Accent */
  --accent: #6366f1;      /* Indigo */
  
  /* Category Colors (for icons/badges) */
  --weapon-color: #f97316;  /* Orange */
  --skill-color: #8b5cf6;   /* Purple */
  --equip-color: #06b6d4;   /* Cyan */
}
```

### Tailwind CSS v4
Uses v4 syntax with `@import "tailwindcss"` instead of `@tailwind directives`.
Tailwind config extends CSS variables for semantic color usage.

### CSS Organization
- `src/index.css`: Main stylesheet (1756 lines)
  - Design tokens
  - Base reset styles
  - Component styles (organized by section)
- Page-specific CSS: `RangesPage.css`, `ComparePage.css`, `FireteamsPage.css`

### Style Pattern
Prefer CSS classes over inline styles. Use Tailwind utilities for minor adjustments but CSS classes for complex components.

---

## Development Workflow

### Commands
```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Run tests in watch mode
npm test

# Run linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Vite Configuration
```typescript
// vite.config.ts
export default defineConfig({
  base: '/infinity-data-browser/',  // GitHub Pages subpath
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
});
```

### ESLint Configuration
Uses flat config format (`eslint.config.js`):
- TypeScript ESLint recommended rules
- React Hooks rules
- React Refresh rules for Vite HMR

### TypeScript Configuration
Strict mode enabled (`tsconfig.app.json`):
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- Target: ES2022

---

## Testing Strategy

### Framework
- **Vitest**: Test runner (compatible with Jest API)
- **React Testing Library**: Component testing
- **jsdom**: Browser environment simulation

### Test Files
- `src/services/Database.test.ts`: Tests search logic, modifier matching
- `src/hooks/useUnitSearch.test.ts`: Tests hook state management
- `src/utils/factions.test.ts`: Tests faction registry
- `src/utils/fireteams.test.ts`: Tests fireteam bonus calculations

### Testing Patterns
- Services are tested with mocked `fetch()`
- Hooks tested with mocked Database dependency
- Manual testing for UI layout and complex interactions

### Running Tests
```bash
npm test           # Watch mode
npm test -- --run  # Single run
```

---

## Deployment

### GitHub Pages
Deployed automatically on push to `main` via `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

### Important Notes
- Uses `HashRouter` for client-side routing (GitHub Pages requirement)
- Base path set to `/infinity-data-browser/` in Vite config
- Data files included in build (symlinked from `public/data/`)

---

## Common Tasks & Patterns

### Adding a New Page
1. Create page component in `src/pages/`
2. Add route in `src/App.tsx`:
   ```tsx
   <Route path="/new-page" element={<NewPage />} />
   ```
3. Add navigation link in `src/components/NavBar.tsx`

### Adding a New Search Type
1. Add new map in `Database.ts` (e.g., `ammunitionMap`)
2. Update `init()` to populate from metadata
3. Extend `searchWithModifiers()` filter logic
4. Update `QueryBuilder.tsx` suggestions and type handling

### Adding a Column to ResultsTable
1. Add to `columns` state array with visibility default
2. Add header cell in thead
3. Add case to render switch in tbody
4. Add CSS class `.td-[column-id]` if needed

### Modifying Faction Grouping
Edit `SHORT_NAME_OVERRIDES` in `src/utils/factions.ts` for display names.
The hierarchical grouping comes from the `parent` field in metadata.

### Adding a New Filter Type
1. Extend `FiltersState` interface in `FilterBar.tsx`
2. Add UI controls in `FilterBar.tsx`
3. Update `useUnitSearch` hook to apply new filter

### Opening Unit Modal Programmatically
```tsx
const { openUnitModal } = useModal();
const db = useDatabase();

const handleClick = (slug: string) => {
  const unit = db.getUnitBySlug(slug);
  if (unit) openUnitModal(unit);
};
```

### Getting Item Names from IDs
```typescript
// Weapons
db.weaponMap.get(id);      // Returns weapon name
db.getWikiLink('weapon', id);

// Skills
db.skillMap.get(id);

// Equipment
db.equipmentMap.get(id);

// Modifiers
db.getExtraName(modId);    // Returns "-3", "-6", etc.
db.extrasMap.get(modId);   // Same as above
```

---

## Code Conventions & Anti-Patterns

### DO ✅
- Use `useDatabase()` hook to access database, not direct import
- Use `db.getExtraName(modId)` for modifier display strings
- Use CSS custom properties for colors/spacing
- Memoize filtered/computed data with `useMemo`
- Keep component files focused (<300 lines preferred)
- Use TypeScript strict mode features

### DON'T ❌
- Import `DatabaseImplementation` directly in components
- Hardcode modifier display values
- Use inline styles for complex styling
- Store derived state (compute from source of truth)
- Ignore TypeScript errors (`any` should be rare)
- Create global singletons outside of Context pattern

### Naming Conventions
- Files: PascalCase for components (`QueryBuilder.tsx`), camelCase for utils
- Components: PascalCase function names
- Hooks: `use` prefix (`useUnitSearch`)
- CSS classes: kebab-case (`filter-button`)
- Types/Interfaces: PascalCase

### Unit Deduplication
Units appear in multiple faction files. `Database.ts` deduplicates by ISC (Internal Short Code) during ingestion. The `Unit.factions` array is the authoritative source for which factions can take a unit.

---

## Troubleshooting

### Common Issues

**"useDatabase must be used within DatabaseProvider"**
Component is rendering before `DatabaseProvider` wrapper. Check that the component is inside the provider tree in `main.tsx`.

**Search returns no results for known items**
Check if modifier matching is correct. Items with modifiers need `extra` field populated in the data file.

**Styles not applying**
Verify CSS class names match. Tailwind v4 uses different syntax. Check `index.css` for component styles.

**Build fails with type errors**
Run `npm run lint` to identify issues. Strict mode catches unused variables/parameters.

**Data not loading**
Check browser console for fetch errors. Verify `public/data/` symlink exists and points to `../data/`.

**Routing not working on GitHub Pages**
Must use `HashRouter`, not `BrowserRouter`. URLs should be like `/#/reference`, not `/reference`.

### Performance Considerations
- Data is ~45MB JSON loaded at startup
- `useMemo` prevents recalculation on every render
- D3 charts render client-side, may be slow with many data points
- Large faction comparisons (5+ factions) can be computationally expensive

---

## Data Notes for Game Context

### Infinity the Game
- Sci-fi tactical miniatures game by Corvus Belli
- Units have profiles with stats (CC, BS, PH, WIP, ARM, BTS, W, S)
- Weapons have range modifiers (bonuses/penalties at different distances)
- Skills and equipment modify gameplay (e.g., Mimetism gives defensive modifier)
- Factions have "sectorial armies" (themed sub-factions with restricted unit selection)
- Fireteams allow coordinated activation with bonuses

### Key Game Terms
- **ISC**: Internal Short Code (unique unit identifier)
- **Vanilla**: The parent faction with full unit access
- **Sectorial**: Themed sub-faction with limited but focused unit selection
- **Fireteam**: 2-5 models that activate together for bonuses
- **LI/MI/HI**: Light/Medium/Heavy Infantry classifications
- **TAG**: Tactical Armored Gear (big robots)
- **REM**: Remote (autonomous units)

---

*Last updated: December 2024*
*Document version: 2.0 (comprehensive rewrite)*

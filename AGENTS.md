# AGENTS.md - Agent Context for Infinity Data Explorer

## Project Overview

**Infinity Data Explorer** is a web application for querying and exploring unit data from the Infinity tabletop miniatures game. Users can search for units by weapon, skill, or equipment, filter by faction, and view which factions have or don't have access to specific capabilities.

### Core Purpose
- Allow users to answer questions like: "Which factions have access to Mimetism(-6)?" or "What units have a Heavy Machine Gun?"
- Display search results with faction grouping, modifier details, and comparison views
- Provide a fast, modern UI experience with responsive design

---

## Technology Stack

### Frontend (Primary)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS v4 + custom CSS variables
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend
- None - purely client-side application
- Data is loaded from static JSON files at runtime

### Python Scripts (Utilities)
- Standalone script `scripts/identify_factions.py` for data analysis
- No external dependencies beyond Python stdlib

---

## Directory Structure

infinity-data/
├── src/                    # React application source
│   ├── components/         # React components
│   │   ├── App.tsx         # Main layout and composition
│   │   ├── QueryBuilder.tsx# Search input with autocomplete
│   │   ├── ResultsTable.tsx# Table view of results
│   │   ├── FactionView.tsx # Faction-grouped view with compare mode
│   │   └── FilterBar.tsx   # Faction filter controls
│   ├── context/            # React Contexts
│   │   └── DatabaseContext.tsx # Database dependency injection
│   ├── hooks/              # Custom Hooks
│   │   └── useUnitSearch.ts # Search state and logic
│   ├── services/
│   │   ├── Database.ts     # Data loading and search logic
│   │   └── Database.test.ts# Unit tests
│   ├── utils/
│   │   └── factions.ts     # Faction grouping and registry
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   ├── index.css           # All styles (CSS variables + component styles)
│   ├── main.tsx            # Entry point with Providers
│   └── setupTests.ts       # Vitest environment setup
├── public/
│   └── data -> ../data     # Symlink to data directory
├── data/                   # Source unit data (45 JSON files)
│   ├── metadata.json       # Global lookup tables (skills, weapons, etc.)
│   └── [faction].json      # Per-faction unit data files
├── scripts/                # Python utility scripts
│   └── identify_factions.py
├── docs/                   # Documentation
│   ├── DATA_STRUCTURE.md   # Explains JSON data format
│   └── design.md           # Design decisions and notes
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── .gitignore
```

---

## Data Architecture

### Data Files
- **Location**: `data/` directory (symlinked via `public/data/` for Vite)
- **Format**: JSON files representing each faction/sectorial army
- **Size**: ~45MB total across 45 files

### Key Data Structures

#### metadata.json
Global lookup tables mapping IDs to names:
```json
{
  "factions": [{ "id": 1, "name": "PanOceania", "slug": "panoceania" }, ...],
  "weapons": [{ "id": 101, "name": "Combi Rifle" }, ...],
  "skills": [{ "id": 191, "name": "Mimetism", "wiki": "..." }, ...],
  "equips": [{ "id": 50, "name": "Multispectral Visor L1" }, ...]
}
```

#### [faction].json
Per-faction unit data:
```json
{
  "units": [
    {
      "id": 12345,
      "isc": "FUSILIER",
      "name": "Fusilier",
      "factions": [1, 101],  // Faction IDs this unit belongs to
      "profileGroups": [...]  // Profiles with skills, weapons, equipment
    }
  ],
  "filters": {
    "extras": [  // ID -> display value mapping for modifiers
      { "id": 6, "name": "-3" },
      { "id": 7, "name": "-6" }
    ]
  }
}
```

#### Modifier System
Skills/equipment can have modifiers (e.g., "Mimetism(-6)"):
- The `extra` field on a skill/equip contains modifier IDs: `{ "id": 191, "extra": [6] }`
- The `extras` array in the faction file maps IDs to display values: `{ "id": 6, "name": "-3" }`
- So `extra: [6]` for Mimetism displays as "Mimetism(-3)"

---

## Key Components

### Database.ts (`src/services/Database.ts`)
Core service implementing `IDatabase` interface:
- **Dependency Injection**: Accessed via `useDatabase()` hook (Context-based)
- **Key Methods**:
  - `searchWithModifiers()` - Main search function
  - `getSuggestions()` - Generates search autocomplete suggestions from all items
  - `getGroupedFactions()` - Returns factions organized by super-faction
  - `factionHasData()` - Checks data availability

### useUnitSearch (`src/hooks/useUnitSearch.ts`)
Encapsulates search state and logic:
- Manages `QueryState` (filters, operators)
- Handles `filteredUnits` memoization results based on database queries
- Detaches business logic from the `App.tsx` view

### QueryBuilder.tsx
Search input UI:
- Uses `useDatabase()` to fetch suggestions via `db.getSuggestions()`
- Manages local input state and simplified UI logic
- Displays modifier variants (e.g., "Mimetism(-6)", "Mimetism (any)")

### factions.ts (`src/utils/factions.ts`)
`FactionRegistry` class for faction organization:
- Groups sectorials under parent factions
- Provides short display names
- Handles vanilla vs sectorial distinction

---

## Key UI Patterns

### Design System
All styles use CSS custom properties defined in `src/index.css`:
```css
--bg-primary: #0a0b0d;
--accent: #60a5fa;
--success: #22c55e;
--error: #ef4444;
```

### Column Visibility
ResultsTable has configurable columns via the "Columns" button:
- Name (always visible)
- Factions (visible by default)
- Match (hidden by default - shows what matched the query)

### Filter State
```typescript
interface FiltersState {
  factions: number[];  // Selected faction IDs (empty = all)
}
```

### Query State
```typescript
interface QueryState {
  filters: QueryFilter[];  // Active search terms
  operator: 'and' | 'or';
}

interface QueryFilter {
  type: 'weapon' | 'skill' | 'equipment';
  baseId: number;
  modifiers: number[];
  matchAnyModifier: boolean;  // true for "(any)" variants
}
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run Unit Tests
npm test

# Build for production
npm run build

# Run Python scripts
python scripts/identify_factions.py
```

---

## Common Tasks for Agents

### Adding a New Column to ResultsTable
1. Add to `columns` state in `ResultsTable.tsx`
2. Add case to the render switch in the tbody
3. Add CSS for `.td-[column-id]` if needed

### Adding a New Search Type
1. Add new map in `Database.ts` (e.g., `hackMap`)
2. Update `init()` to populate from metadata
3. Add to `searchWithModifiers()` filter logic
4. Update `QueryBuilder.tsx` to generate suggestions

### Modifying Faction Grouping
- Edit `SUPER_FACTIONS` in `src/utils/factions.ts`
- Each entry defines parent faction and child sectorials

### Adding a New Filter Type
1. Add to `FiltersState` interface in `FilterBar.tsx` / `useUnitSearch.ts`
2. Add UI in `FilterBar.tsx`
3. Update `useUnitSearch` hook to apply the new filter logic

---

## Testing Strategy

- **Framework**: Vitest + React Testing Library + JSDOM
- **Command**: `npm test`
- **Unit Tests**:
  - `src/services/Database.test.ts`: Verifies search logic, modifier matching, and suggestions
  - `src/hooks/useUnitSearch.test.ts`: Verifies state management and filter application
- **Methodology**:
  - Services are tested in isolation (mocked fetch)
  - Hooks are tested with mocked Database dependency
  - Manual testing for UI layout and complex interactions

---

## Known Patterns and Conventions

1. **Dependency Injection**: Use `useDatabase()` hook to access the `IDatabase` instance. Avoid global singletons.
2. **Deduplication**: Units appear in multiple faction files; `Database.ts` deduplicates by ISC
3. **Modifier Display**: Always use `db.extrasMap.get(modId)` to get display string
4. **Faction Access**: A unit's `factions` array is authoritative for who can take it
5. **Super-factions**: Parent factions (PanOceania, Yu Jing) contain both vanilla and sectorials
6. **Symlink for data**: `public/data` → `../data` to avoid duplication

---

## File Size Reference

- Total data: ~45MB JSON
- Built JS bundle: ~340KB (109KB gzipped)
- Built CSS: ~24KB (4.4KB gzipped)

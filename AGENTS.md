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
- Standalone scripts in `scripts/` for data analysis
- No external dependencies beyond Python stdlib

---

## Directory Structure

```
infinity-data/
├── src/                    # React application source
│   ├── components/         # React components
│   │   ├── App.tsx         # Main app component
│   │   ├── QueryBuilder.tsx# Search input with suggestions
│   │   ├── ResultsTable.tsx# Table view of results
│   │   ├── FactionView.tsx # Faction-grouped view with compare mode
│   │   └── FilterBar.tsx   # Faction filter controls
│   ├── services/
│   │   └── Database.ts     # Data loading and search logic
│   ├── utils/
│   │   └── factions.ts     # Faction grouping and registry
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   └── index.css           # All styles (CSS variables + component styles)
├── public/
│   └── data -> ../data     # Symlink to data directory
├── data/                   # Source unit data (45 JSON files)
│   ├── metadata.json       # Global lookup tables (skills, weapons, etc.)
│   └── [faction].json      # Per-faction unit data files
├── scripts/                # Python utility scripts
│   ├── identify_factions.py
│   └── query_infinity.py
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
Singleton that handles all data loading and searching:
- `init()` - Loads metadata and all faction JSON files
- `extrasMap` - Maps modifier IDs to display strings (from `extras` arrays)
- `searchWithModifiers()` - Main search function supporting modifier-aware queries
- `getGroupedFactions()` - Returns factions organized by super-faction

### QueryBuilder.tsx
Search input with autocomplete:
- Shows suggestions for weapons, skills, equipment
- Displays modifier variants (e.g., "Mimetism(-6)", "Mimetism(-3)", "Mimetism (any)")
- "(any)" variant matches all modifier levels including no modifier

### FactionView.tsx
Three view modes:
1. **Flat** - Alphabetical list of factions with/without access
2. **Grouped** - Organized by super-faction (PanO, Yu Jing, etc.)
3. **Compare** - Shows all sectorials per super-faction with color-coded access

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

# Build for production
npm run build

# Run Python scripts
python scripts/identify_factions.py
python scripts/query_infinity.py --skill "Mimetism" --by-faction
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
1. Add to `FiltersState` interface in `FilterBar.tsx`
2. Add UI in `FilterBar.tsx`
3. Add filter logic in `filteredUnits` memo in `App.tsx`

---

## Testing Notes

- No automated tests currently
- Manual testing: run `npm run dev`, search for various terms
- Verify: modifiers display correctly, faction filtering works, compare view shows access

---

## Known Patterns and Conventions

1. **Deduplication**: Units appear in multiple faction files; `Database.ts` deduplicates by ISC
2. **Modifier Display**: Always use `db.extrasMap.get(modId)` to get display string
3. **Faction Access**: A unit's `factions` array is authoritative for who can take it
4. **Super-factions**: Parent factions (PanOceania, Yu Jing) contain both vanilla and sectorials
5. **Symlink for data**: `public/data` → `../data` to avoid duplication

---

## File Size Reference

- Total data: ~45MB JSON
- Built JS bundle: ~340KB (109KB gzipped)
- Built CSS: ~24KB (4.4KB gzipped)

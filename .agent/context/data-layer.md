# Data Layer Deep Dive

## Data Files Location
- Source: `data/` directory (46 files, ~45MB total)
- Served via: `public/data/` symlink
- Loaded at: App startup in `Database.init()`

## metadata.json Structure
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

## [faction].json Structure
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

## Modifier System (The `extra` Field)

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

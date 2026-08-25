# Data Update Diff Toolkit

Compare an old snapshot of `data/` against the current `data/` to surface
exactly what changed between Corvus Belli data versions.

## Scripts

### `diff-by-faction.mjs` — unit-level summary
Walks each faction's processed file and reports unit-level adds/removes/modifies.
Skill/weapon/equipment changes are aggregated across all profiles + options of
each unit and reported by mod-aware `displayName` (same convention as
`diff-by-profile.mjs`). Use this for a quick faction-by-faction overview.

```bash
node update_diffs/diff-by-faction.mjs <old-root> <new-root> <out-dir>
```

### `diff-by-profile.mjs` — profile-level mod-aware diff
Walks `profileGroups → profiles` and `profileGroups → options`, matches by
profile/option name, and reports stat changes, plus skill/weapon/equipment
changes by their **mod-aware `displayName`**:

- `Mimetism(-3)` is distinguished from `Mimetism(-6)`
- `Thunderbolt(+2B)` is distinguished from `Thunderbolt`
- `BS Attack(+1B)` vs `BS Attack(+1SD)` shows up as a real change
- `CC Weapon(PS=5)` vs `CC Weapon(PS=4)` captures Physical Strength deltas

```bash
node update_diffs/diff-by-profile.mjs <old-root> <new-root> <out-dir>
```

This is the script that lines up best with CB's official changelog
("Options and Costs Review", "New profiles", etc.).

## One-shot pipeline

```bash
update_diffs/run-pipeline.sh                              # full: snapshot → refresh → ETL → diff → HTML
update_diffs/run-pipeline.sh --no-refresh                 # skip CB API fetch (re-uses current data/)
SNAPSHOT_DIR=/tmp/old update_diffs/run-pipeline.sh --reuse-snapshot --no-refresh
                                                          # diff against an existing snapshot
```

The pipeline writes a fresh snapshot to `/tmp/infinity-data-snapshot-<timestamp>`,
records its path in `/tmp/infinity-data-snapshot-latest.txt`, and at the end
prints the path to the rendered HTML.

## Note on reinforcement units

Reinforcement units live in their own faction IDs (those ending in `99`, e.g.
ALEPH Operations reinforcements = faction 799). `data/metadata.json` excludes
those factions, `scripts/refresh_data.ts` doesn't fetch them, and the ETL
filters them at `scripts/process-data.ts:617`. As a result no `Reinf.` units
appear in `data/processed/` and the diff reports are reinforcement-clean by
construction — no extra filtering needed.

## Note on universal mercenaries

The CB API returns universal mercenaries (Bashi Bazouks, CSU, Wolfgang, Emily
Handelman, Major Lunah, etc.) in **every** faction file, even factions that
can't actually field them (e.g. Shindenbutai, JSA). The ETL faithfully
preserves them with `factionIds: []` since the raw `unit.factions` array is
empty for these.

The diff scripts filter out any unit with `factionIds.length === 0` so each
faction's diff only contains units that genuinely belong to that faction. This
brought total modifications from ~367 down to ~152 in the current update —
the ~215-modification gap was the same set of mercenary changes appearing
once per faction. The filter is in `diff-by-faction.mjs` and `diff-by-profile.mjs`
as `isUniversalMerc(unit)`.

If you want a global mercenary changes report later, those units could be
diffed once from any faction file (they're identical across all of them).

## Manual steps (what the pipeline does internally)

1. **Snapshot before refresh:**
   ```bash
   SNAP=/tmp/infinity-data-snapshot-$(date +%Y%m%d-%H%M%S)
   mkdir -p "$SNAP" && cp -r data "$SNAP/"
   echo "$SNAP" > /tmp/infinity-data-snapshot-latest.txt
   ```

2. **Refresh:**
   ```bash
   npx tsx scripts/refresh_data.ts   # pulls per-faction data + rebuilds metadata.json catalog
   npm run etl                       # regenerates data/processed/
   ```

3. **Reprocess the snapshot with the new metadata** (otherwise IDs newly added in
   this update render as `Weapon#NNN` in the snapshot and create false diffs):
   ```bash
   WORK=/tmp/snapshot-reprocess
   rm -rf "$WORK" && cp -r "$SNAP" "$WORK"
   cp data/metadata.json "$WORK/data/metadata.json"
   rm -rf "$WORK/data/processed"
   mv data data.real && ln -s "$WORK/data" data
   npm run etl
   rm data && mv data.real data
   ```

4. **Generate the reports:**
   ```bash
   node update_diffs/diff-by-faction.mjs "$WORK" . update_diffs/by-faction
   node update_diffs/diff-by-profile.mjs "$WORK" . update_diffs/by-profile
   ```

5. **Render to browsable HTML** (optional):
   ```bash
   node update_diffs/render-html.mjs
   # open update_diffs/html/index.html
   ```
   Produces a static site at `update_diffs/html/` with a sidebar nav, a tab
   switcher between the two report styles, and color-coded add / remove / modify
   markers. No JS dependencies, no build step.

## Why `refresh_data.ts` rebuilds `metadata.json`

The CB API exposes per-faction data at `api.corvusbelli.com/army/units/en/<id>`
but does not expose a public metadata endpoint (every variant returns 403).
However, each faction file ships a `filters` block with names for every weapon,
skill, equipment, and ammunition ID it references. After fetching all factions,
`refresh_data.ts` merges these `filters` blocks into `data/metadata.json` so the
ETL can resolve every ID. Stat data (burst, damage, distance, etc.) is preserved
for existing entries; new entries get only the name fields exposed by `filters`.

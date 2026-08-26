#!/usr/bin/env bash
# Generate a full data update diff: snapshot → refresh → ETL → reprocess
# snapshot under new metadata → diff (unit-level + profile-level) → render HTML.
#
# Usage:
#   update_diffs/run-pipeline.sh                # snapshot first, then refresh
#   update_diffs/run-pipeline.sh --no-refresh   # use current data/ as "new",
#                                                # diff against an existing snapshot
#   SNAPSHOT_DIR=... update_diffs/run-pipeline.sh --reuse-snapshot
#                                                # skip snapshot step, use provided
#
# Outputs:
#   update_diffs/by-faction/    — markdown reports (unit-level)
#   update_diffs/by-profile/    — markdown reports (profile-level)
#   update_diffs/html/          — browsable static site
#   $SNAPSHOT_DIR (default /tmp/infinity-data-snapshot-<timestamp>)
#                               — pre-refresh raw + reprocessed snapshot

set -euo pipefail

cd "$(dirname "$0")/.."   # project root

REFRESH=1
REUSE_SNAPSHOT=0
DEPLOY=0
for arg in "$@"; do
    case "$arg" in
        --no-refresh) REFRESH=0 ;;
        --reuse-snapshot) REUSE_SNAPSHOT=1 ;;
        --deploy) DEPLOY=1 ;;
        -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
        *) echo "Unknown arg: $arg" >&2; exit 1 ;;
    esac
done

log() { echo -e "\n\033[1;34m▸ $*\033[0m"; }

# ---------------------------------------------------------------------------
# 1. Snapshot
# ---------------------------------------------------------------------------
if [ "$REUSE_SNAPSHOT" -eq 1 ]; then
    : "${SNAPSHOT_DIR:?Set SNAPSHOT_DIR=/path/to/snapshot when using --reuse-snapshot}"
    log "Reusing snapshot: $SNAPSHOT_DIR"
    [ -d "$SNAPSHOT_DIR/data" ] || { echo "Missing $SNAPSHOT_DIR/data" >&2; exit 1; }
else
    SNAPSHOT_DIR="${SNAPSHOT_DIR:-/tmp/infinity-data-snapshot-$(date +%Y%m%d-%H%M%S)}"
    log "Snapshotting current data/ → $SNAPSHOT_DIR"
    mkdir -p "$SNAPSHOT_DIR"
    cp -r data "$SNAPSHOT_DIR/"
    echo "$SNAPSHOT_DIR" > /tmp/infinity-data-snapshot-latest.txt
fi

# ---------------------------------------------------------------------------
# 2. Refresh raw data + rebuild metadata catalogs
# ---------------------------------------------------------------------------
if [ "$REFRESH" -eq 1 ]; then
    log "Refreshing per-faction data from CB API"
    npx tsx scripts/refresh_data.ts
else
    log "Skipping refresh (--no-refresh)"
fi

# ---------------------------------------------------------------------------
# 3. Regenerate processed/ from current raw
# ---------------------------------------------------------------------------
log "Running ETL on current data/"
npm run etl

# ---------------------------------------------------------------------------
# 4. Reprocess snapshot raw with current (post-refresh) metadata
#    Required so newly-added IDs resolve to names in BOTH sides of the diff.
# ---------------------------------------------------------------------------
log "Reprocessing snapshot with current metadata"
WORK=/tmp/snapshot-reprocess
rm -rf "$WORK"
mkdir -p "$WORK"
cp -r "$SNAPSHOT_DIR/data" "$WORK/data"
cp data/metadata.json "$WORK/data/metadata.json"   # use NEW metadata to resolve IDs
rm -rf "$WORK/data/processed"

# Run ETL pointed at $WORK by temporarily symlinking ./data
mv data data.real
ln -s "$WORK/data" data
trap 'rm -f data && mv -f data.real data 2>/dev/null || true' EXIT
npm run etl
rm data && mv data.real data
trap - EXIT

# ---------------------------------------------------------------------------
# 5. Generate diffs
# ---------------------------------------------------------------------------
log "Generating profile & loadout diffs"
rm -rf update_diffs/by-profile
node update_diffs/diff-by-profile.mjs "$WORK" "$PWD" update_diffs/by-profile

# ---------------------------------------------------------------------------
# 6. Render HTML
# ---------------------------------------------------------------------------
log "Rendering HTML"
rm -rf update_diffs/html
node update_diffs/render-html.mjs

# ---------------------------------------------------------------------------
# 7. Optional Deploy
# ---------------------------------------------------------------------------
if [ "$DEPLOY" -eq 1 ]; then
    log "Deploying to infinity-changelog-host"
    npm run diff:deploy
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
echo "================================================================"
echo " Pipeline complete."
echo "================================================================"
echo " Snapshot:   $SNAPSHOT_DIR"
echo " Reports:    update_diffs/by-faction/  update_diffs/by-profile/"
echo " HTML:       update_diffs/html/index.html"
if [ "$DEPLOY" -eq 1 ]; then
    echo " Live Site:  https://liquidmetal9015.github.io/infinity-changelog-host/"
fi
echo
echo " Open:  file://$PWD/update_diffs/html/index.html"

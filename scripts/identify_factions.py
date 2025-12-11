#!/usr/bin/env python3
"""
Identify Factions Script
Analyzes JSON files in the data directory to identify which faction each file represents.
"""
import json
import os
import glob

DATA_DIR = "./data"
METADATA_FILE = os.path.join(DATA_DIR, "metadata.json")


def load_json(filepath):
    """Load and parse a JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return None


def main():
    # 1. Load Metadata to get Faction ID -> Name mapping
    metadata = load_json(METADATA_FILE)
    if not metadata:
        print("Failed to load metadata. Exiting.")
        return

    factions_map = {f['id']: f['name'] for f in metadata.get('factions', [])}
    
    # 2. Iterate through all .json files in data directory (excluding metadata.json)
    json_files = glob.glob(os.path.join(DATA_DIR, "*.json"))
    
    print(f"{'Filename':<20} | {'Faction ID':<10} | {'Faction Name'}")
    print("-" * 60)

    for filepath in sorted(json_files):
        filename = os.path.basename(filepath)
        if filename == "metadata.json":
            continue

        data = load_json(filepath)
        if not data or 'units' not in data:
            continue

        units = data['units']
        if not units:
            print(f"{filename:<20} | {'EMPTY':<10} | Unit list is empty")
            continue

        # 3. Frequency Analysis
        faction_counts = {}
        total_units = len(units)
        
        for unit in units:
            for fid in unit.get('factions', []):
                faction_counts[fid] = faction_counts.get(fid, 0) + 1
        
        # Sort by count descending
        sorted_factions = sorted(faction_counts.items(), key=lambda item: item[1], reverse=True)
        
        if not sorted_factions:
            print(f"{filename:<20} | {'EMPTY':<10} | No faction data found")
            continue

        best_fid, best_count = sorted_factions[0]
        
        # Filter for candidates that appear in >50% of units
        candidates = []
        for fid, count in sorted_factions:
            pct = (count / total_units) * 100
            if pct > 50:
                candidates.append((fid, count, pct))

        if not candidates:
            print(f"{filename:<20} | {'MIXED':<10} | Top: {factions_map.get(best_fid)} ({best_count}/{total_units})")
        else:
            cand_strs = []
            for fid, count, pct in candidates:
                name = factions_map.get(fid, "Unknown")
                cand_strs.append(f"{name} ({pct:.0f}%)")
            
            print(f"{filename:<20} | {candidates[0][0]:<10} | {', '.join(cand_strs)}")


if __name__ == "__main__":
    main()

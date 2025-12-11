#!/usr/bin/env python3
"""
Query Infinity Data Script
Command-line tool to search for units by weapon, skill, or equipment.
"""
import argparse
import json
import os
import glob
import sys
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional


# =============================================================================
# Models (inlined from infinity_tools.models)
# =============================================================================

@dataclass
class Unit:
    id: int
    isc: str
    name: str
    factions: List[int]
    profile_groups: List[Dict] = field(default_factory=list)
    
    # Computed sets for fast lookup
    all_weapon_ids: set = field(default_factory=set)
    all_skill_ids: set = field(default_factory=set)
    all_equipment_ids: set = field(default_factory=set)

    def compute_access(self):
        """Populates the cached sets of IDs accessible to this unit."""
        self.all_weapon_ids = set()
        self.all_skill_ids = set()
        self.all_equipment_ids = set()

        for pg in self.profile_groups:
            for profile in pg.get('profiles', []):
                for s in profile.get('skills', []):
                    self.all_skill_ids.add(s.get('id'))
                for e in profile.get('equip', []):
                    self.all_equipment_ids.add(e.get('id'))
                for w in profile.get('weapons', []):
                    self.all_weapon_ids.add(w.get('id'))

            for opt in pg.get('options', []):
                for s in opt.get('skills', []):
                    self.all_skill_ids.add(s.get('id'))
                for e in opt.get('equip', []):
                    self.all_equipment_ids.add(e.get('id'))
                for w in opt.get('weapons', []):
                    self.all_weapon_ids.add(w.get('id'))

    def has_weapon(self, weapon_id: int) -> bool:
        return weapon_id in self.all_weapon_ids

    def has_skill(self, skill_id: int) -> bool:
        return skill_id in self.all_skill_ids

    def has_equipment(self, equipment_id: int) -> bool:
        return equipment_id in self.all_equipment_ids


# =============================================================================
# Database (inlined from infinity_tools.database)
# =============================================================================

class Database:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.metadata_file = os.path.join(data_dir, "metadata.json")
        
        self.weapons: Dict[int, str] = {}
        self.skills: Dict[int, str] = {}
        self.equipment: Dict[int, str] = {}
        self.factions: Dict[int, str] = {}
        
        self.units: List[Unit] = []
        
        self.load_metadata()
        self.load_units()

    def load_json(self, filepath: str):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading {filepath}: {e}")
            return None

    def load_metadata(self):
        data = self.load_json(self.metadata_file)
        if not data:
            return

        for f in data.get('factions', []):
            self.factions[f['id']] = f['name']
        
        for w in data.get('weapons', []):
            self.weapons[w['id']] = w['name']
            
        for s in data.get('skills', []):
            self.skills[s['id']] = s['name']
            
        for e in data.get('equips', []):
            self.equipment[e['id']] = e['name']

    def load_units(self):
        json_files = glob.glob(os.path.join(self.data_dir, "*.json"))

        for filepath in json_files:
            if os.path.basename(filepath) == "metadata.json":
                continue
            
            data = self.load_json(filepath)
            if not data or 'units' not in data:
                continue

            for u_data in data['units']:
                unit = Unit(
                    id=u_data.get('id'),
                    isc=u_data.get('isc'),
                    name=u_data.get('name'),
                    factions=u_data.get('factions', []),
                    profile_groups=u_data.get('profileGroups', [])
                )
                unit.compute_access()
                self.units.append(unit)
    
    def normalize_name(self, name: str) -> str:
        return name.lower().strip()

    def search_id_by_name(self, name: str, source: Dict[int, str]) -> List[int]:
        """Finds all IDs where the name contains the search string."""
        query = self.normalize_name(name)
        matches = []
        for id, item_name in source.items():
            if query in self.normalize_name(item_name):
                matches.append(id)
        return matches

    def search_units(self, 
                     weapon_name: Optional[str] = None, 
                     skill_name: Optional[str] = None, 
                     equip_name: Optional[str] = None) -> List[Tuple[Unit, List[str]]]:
        
        results = []
        
        target_weapon_ids = self.search_id_by_name(weapon_name, self.weapons) if weapon_name else []
        target_skill_ids = self.search_id_by_name(skill_name, self.skills) if skill_name else []
        target_equip_ids = self.search_id_by_name(equip_name, self.equipment) if equip_name else []
        
        if not (target_weapon_ids or target_skill_ids or target_equip_ids):
            return []

        seen_unit_id_isc = set()

        for unit in self.units:
            match_reasons = []
            
            for wid in target_weapon_ids:
                if unit.has_weapon(wid):
                    match_reasons.append(f"Weapon: {self.weapons[wid]}")
            
            for sid in target_skill_ids:
                if unit.has_skill(sid):
                    match_reasons.append(f"Skill: {self.skills[sid]}")

            for eid in target_equip_ids:
                if unit.has_equipment(eid):
                    match_reasons.append(f"Equip: {self.equipment[eid]}")

            if match_reasons:
                key = unit.isc
                if key not in seen_unit_id_isc:
                    results.append((unit, match_reasons))
                    seen_unit_id_isc.add(key)
        
        return results

    def get_faction_name(self, fid: int) -> str:
        return self.factions.get(fid, f"Unknown ({fid})")


# =============================================================================
# Main Script
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Query Infinity Data")
    parser.add_argument("--data-dir", default="./data", help="Path to data directory")
    
    group = parser.add_argument_group('Search Criteria')
    group.add_argument("--weapon", "-w", help="Search for units with this weapon")
    group.add_argument("--skill", "-s", help="Search for units with this skill")
    group.add_argument("--equip", "-e", help="Search for units with this equipment")
    
    parser.add_argument("--by-faction", action="store_true", 
                        help="Aggregate results by faction and show missing factions")

    args = parser.parse_args()
    
    if not (args.weapon or args.skill or args.equip):
        parser.print_help()
        sys.exit(1)

    print("Loading data... please wait.")
    db = Database(args.data_dir)
    print(f"Loaded {len(db.units)} units.")
    
    results = db.search_units(
        weapon_name=args.weapon, 
        skill_name=args.skill, 
        equip_name=args.equip
    )
    
    if not results:
        print("No units found matching criteria.")
        return

    print(f"\nFound {len(results)} matching units.")
    
    if args.by_faction:
        faction_access = {}
        
        for unit, reasons in results:
            for fid in unit.factions:
                if fid not in faction_access:
                    faction_access[fid] = []
                faction_access[fid].append((unit, reasons))
        
        print("\n" + "="*80)
        print("FACTIONS WITH ACCESS")
        print("="*80)
        
        sorted_access_fids = sorted(faction_access.keys(), key=lambda fid: db.get_faction_name(fid))
        
        for fid in sorted_access_fids:
            fname = db.get_faction_name(fid)
            units_list = faction_access[fid]
            unit_names = sorted(list(set(u.name for u, _ in units_list)))
            print(f"\n[{fname}] ({len(unit_names)} units)")
            for name in unit_names:
                print(f"  - {name}")

        print("\n" + "="*80)
        print("FACTIONS WITHOUT ACCESS")
        print("="*80)
        
        all_fids = set(db.factions.keys())
        access_fids = set(faction_access.keys())
        missing_fids = all_fids - access_fids
        
        sorted_missing_fids = sorted(list(missing_fids), key=lambda fid: db.get_faction_name(fid))
        
        if not sorted_missing_fids:
            print("None! All factions have access.")
        else:
            for fid in sorted_missing_fids:
                fname = db.get_faction_name(fid)
                print(f"- {fname}")

    else:
        print("-" * 60)
        print(f"{'Unit Name':<30} | {'Factions':<30} | {'Match Reason'}")
        print("-" * 60)
        
        results.sort(key=lambda x: x[0].name)
        
        for unit, reasons in results:
            fnames = [db.get_faction_name(fid) for fid in unit.factions]
            
            display_faction = ""
            if fnames:
                display_faction = fnames[0]
                if len(fnames) > 1:
                    display_faction += f" (+{len(fnames)-1})"
            
            joined_reasons = ", ".join(reasons)
            print(f"{unit.name:<30} | {display_faction:<30} | {joined_reasons}")


if __name__ == "__main__":
    main()

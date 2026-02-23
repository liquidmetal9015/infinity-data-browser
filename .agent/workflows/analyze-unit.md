---
description: How to analyze a unit's capabilities in Infinity
---

# Analyze Unit Workflow

Use this workflow when you need to understand what a unit can do in Infinity.

## Steps

1. **Get the unit profile** with full stats and loadouts:
   ```
   get_unit_profile(slug: "unit-name")
   ```
   This returns stats, weapons, skills, and equipment with brief summaries.

2. **For each key skill**, verify the full rules:
   ```
   read_wiki_page(url: "Skill_Name")
   ```
   Pay special attention to:
   - EFFECTS section (what the skill does)
   - REQUIREMENTS section (when it can be used)
   - Any negative MODs that apply to enemies

3. **Check weapon profiles** if combat role matters:
   ```
   search_items(query: "weapon-name", type: "weapon")
   ```

4. **Synthesize capabilities** by category:
   - **Survivability**: ARM, BTS, Wounds, defensive skills (Mimetism, Camo, ODD)
   - **Ranged offense**: BS stat, weapon range bands, burst, damage
   - **Melee offense**: CC stat, CC weapons, Martial Arts
   - **Utility**: Specialist skills, hacking, smoke, deployables

## Example

Analyzing "Intruder":
1. `get_unit_profile(slug: "intruder")` → See MSV2, Mimetism, and weapon options
2. `read_wiki_page(url: "Multispectral_Visor")` → Understand MSV levels
3. `read_wiki_page(url: "Mimetism")` → Confirm -6 to enemy BS/Discover
4. Synthesize: "Strong gunfighter with MSV2 to bypass Camo, protected by Mimetism -6"

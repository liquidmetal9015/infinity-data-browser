---
description: How to build an Infinity army list step-by-step
---

# Build Army List Workflow

Use this workflow when helping a user build an Infinity army list.

## Prerequisites

Get faction context first:
```
get_faction_context(factionSlug: "faction-slug", includeFireteams: true, includeRoster: true)
```

This returns:
- Faction info and parent faction
- Available fireteams and their compositions
- Full unit roster with point costs

## Steps

### 1. Initialize the List

```
create_list(factionSlug: "faction-slug", pointsLimit: 300, armyName: "List Name")
```

### 2. Plan Core Structure

Before adding units, consider:
- **Lieutenant**: Required. Usually a defensive or hidden option.
- **Order generation**: Need regular orders in pool (8-10 minimum for 300pts)
- **Fireteam core**: If sectorial, plan your main fireteam first
- **Specialists**: Need button pushers for objectives (Forward Observer, Doctor, Engineer, Hacker, Specialist Operative)

### 3. Add Units

```
add_unit(unitSlug: "unit-name", optionId: 123, groupNumber: 1)
```

Check loadout options with `get_unit_profile` if needed.

### 4. Verify Fireteam Composition

```
validate_fireteam(factionId: 123, teamName: "Core Fireteam", members: ["Unit1", "Unit2", "Unit3", "Unit4", "Unit5"])
```

### 5. Check Status Regularly

```
get_list_status()
```

Returns: points spent, SWC, order counts, validation issues.

### 6. Analyze List Capabilities

After building, check:
```
analyze_classifieds(armyCode: "exported-code")
classify_units(armyCode: "exported-code", role: "specialist")
```

### 7. Export Final Code

```
export_army_code()
```

## List Building Tips

1. **Orders matter most** - More orders = more actions = more flexibility
2. **Cover your weaknesses** - If no MSV, have smoke; if no hacker, have killer hacker defense
3. **Classifieds coverage** - Ensure you can complete 3-4 different classified types
4. **Specialist redundancy** - Don't rely on single specialists for objectives
5. **Active turn threats** - Have at least 2 strong attack pieces
6. **ARO defense** - Have units that can threaten enemy active turn

## Example: Quick 300pt Outline

1. Lieutenant (cheap, hidden if possible)
2. Core Fireteam (5 members with at least 1 specialist)
3. Attack piece (good BS, high damage weapons)
4. Utility specialists (Doctor for HVT, Engineer for objectives)
5. Order padding (cheap regular troops to fill order pool)
6. Counter-picks (MSV for smoke, hackers for TAGs, etc.)

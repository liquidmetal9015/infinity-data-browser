# Infinity N5 Core Rules Summary

> **For Agents**: This document provides essential Infinity game mechanics. Always verify specific rules using `read_wiki_page` or `search_wiki` before making claims about detailed interactions.

## Game Structure

**Turns & Rounds**: Each Game Round consists of two Player Turns. During your **Active Turn**, you spend Orders. During your **Reactive Turn**, you declare AROs.

**Combat Groups**: Your army is divided into Combat Groups (max 10 troopers each). Orders are pooled within each Combat Group and cannot be shared between groups.

## Orders

Orders are the currency to activate troopers. Each Regular trooper contributes 1 Order to their Combat Group's Order Pool.

| Order Type | Added to Pool? | Who Uses It? |
|------------|---------------|--------------|
| Regular | Yes | Any trooper in same Combat Group |
| Irregular | No | Only the contributing trooper |
| Lieutenant Special | No | Only the Lieutenant |
| Tactical | No | The generating trooper (or Fireteams) |

**Key Rule**: You can spend any number of Orders on a single trooper. There's no "activation limit."

## AROs (Automatic Reaction Orders)

Reactive troopers get ONE ARO per enemy Order spent, regardless of how many Skills the active trooper declares.

**ARO Triggers**:
- Enemy activates in your Line of Fire (LoF)
- Enemy activates in your Zone of Control (ZoC) or Hacking Area
- You're hit by a Template or Comms Attack

**Critical Rule**: AROs are declared after the Active player's first Short Skill. All AROs are simultaneous.

## Rolls

**Success**: Roll d20 ≤ Success Value (Attribute + all modifiers)

**Critical**: Roll exactly equals Success Value. In Face-to-Face rolls, Criticals always win.

**Maximum Modifier**: Total modifiers cap at ±12.

**Success Value >20**: Extra numbers become Critical results. SV 23 means 20, 1, 2, 3 are all Criticals.

**Success Value <1**: Automatic failure, no roll.

## Face-to-Face Rolls

When opposing actions conflict (e.g., both shooting), both roll simultaneously:
1. Failed rolls are discarded
2. Compare successes - higher successful roll wins
3. Winner's successful dice hit the opponent
4. Criticals beat any non-Critical

**All actions are simultaneous** - you can shoot from your starting position while your target shoots at your ending position.

## Modifiers (MODs)

Common sources:
- **Range**: Weapon profile shows MOD at each range band
- **Cover**: Partial Cover = -3 to hit, +3 to Saving Roll
- **Skills/Equipment**: Mimetism, Camouflage, ODD, visors, etc.

**Negative MODs** (like Mimetism -6) apply to **enemies** targeting the user.
**Positive MODs** (like BS Attack +3) apply to the **user**.

## Cover

| Type | Effect |
|------|--------|
| Total Cover | Cannot be targeted (no LoF) |
| Partial Cover | -3 to attacker's roll, +3 to defender's Saving Roll |

**Requirement**: Trooper must be in contact with scenery that partially obscures their Silhouette.

## Damage Resolution

1. **Successful Attack** → target makes Saving Roll
2. **Saving Roll**: Roll d20 ≤ ARM (or BTS) + modifiers
3. **Failure** → lose 1 Wound (or Structure for REMs/TAGs)
4. **0 Wounds** → Unconscious state
5. **Below 0** → Dead

**Ammunition Effects**:
- **Normal (N)**: 1 Saving Roll per hit
- **DA**: 2 Saving Rolls per hit  
- **EXP**: 3 Saving Rolls per hit
- **Shock**: Unconscious → Dead (bypasses Unconscious)
- **AP**: Halve ARM value

## Key Skills

| Skill | Type | Effect |
|-------|------|--------|
| **BS Attack** | Short Skill/ARO | Ranged attack using BS attribute |
| **CC Attack** | Short Skill/ARO | Melee attack using CC attribute |
| **Dodge** | Short Skill/ARO | PH roll to avoid damage and move 2" |
| **Discover** | Short Skill/ARO | WIP roll to reveal Camouflage/Hidden |
| **Move** | Short Skill | Move up to first MOV value |
| **Reset** | Short Skill/ARO | WIP roll to cancel states/avoid hacking |

## Common States

| State | Effect |
|-------|--------|
| **Camouflaged** | Represented by Camo marker; -3 to enemy attacks |
| **Targeted** | +3 to BS Attacks against; -3 to Reset |
| **Unconscious** | Cannot act; can be Coup de Grâce'd |
| **Immobilized** | Cannot declare movement or AROs |
| **Isolated** | Irregular, cannot use Command Tokens |

## Template Weapons

**Direct Templates** (Flame, Chain Rifle): 
- Placed touching attacker, must reach target
- No roll needed - auto-hit if template touches
- Target can Dodge (F2F roll)

**Impact Templates** (Missiles, Grenades):
- BS Attack roll, template placed on target
- Everyone under template rolls Saving Rolls

## Hacking

**Hacking Area**: 8" ZoC + all Repeaters on the table

**Targets**: Only specific unit types (HI, TAG, REM, Hackers, etc.)

**Key Programs**:
- **Oblivion**: Isolate target
- **Carbonite**: Immobilize target
- **Trinity**: Direct damage (BTS Saves)

---

*Use `read_wiki_page("Topic")` to get full rules for any concept above.*

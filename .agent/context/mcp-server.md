# MCP Server

The MCP (Model Context Protocol) server exposes Infinity game data and list-building tools to AI agents. It runs as a standalone Node process via `npm run mcp` (uses `tsx`).

## Entry Point

`mcp-server/index.ts` — Creates the MCP server, registers all tools and resources.

## Resources

- `infinity://metadata` — Full metadata.json (factions, weapons, skills, equipment, ammo)
- `infinity://factions/{slug}` — Per-faction JSON data

## Tools

### Data Query Tools
| Tool | Description |
|------|-------------|
| `search_units` | Search units by name across all factions |
| `get_unit_details` | Get basic unit info by slug |
| `get_unit_profile` | Get full unit profile with stats, weapons, skills, loadout options |
| `search_items` | Search weapons, skills, equipment, or ammo by name |
| `get_faction_roster` | Get all units in a faction with point costs |
| `get_faction_context` | Get faction info, fireteams, and roster in one call |
| `validate_fireteam` | Validate a fireteam composition against the chart |

### Wiki / Rules Tools
| Tool | Description |
|------|-------------|
| `read_wiki_page` | Read a page from the Infinity wiki |
| `search_wiki` | Full-text search the Infinity wiki |
| `read_its_rules` | Read ITS tournament rules |
| `search_its_rules` | Search ITS rules |

### Army Code Tools
| Tool | Description |
|------|-------------|
| `parse_army_code` | Decode a base64 army code into unit list |
| `analyze_classifieds` | Analyze which classified objectives a list can achieve |
| `classify_units` | Classify units in a list by role |

### Dice / Analysis Tools
| Tool | Description |
|------|-------------|
| `calculate_f2f` | Calculate face-to-face roll probabilities |
| `analyze_matchup` | Analyze a combat matchup between two units |
| `compare_lists` | Compare two army lists |

### List Builder Tools
| Tool | Description |
|------|-------------|
| `create_list` | Create a new army list |
| `add_unit` | Add a unit to the active list |
| `remove_unit` | Remove a unit from the active list |
| `get_list_status` | Get current list status (points, SWC, orders) |
| `export_army_code` | Export the active list as an army code |

## Key Supporting Files

- `DatabaseAdapter.ts` — Server-side database that loads JSON data from `data/` directory
- `list-builder.ts` — `ListBuilder` class wrapping the shared list reducer for stateful list construction
- `list-utils.ts` — Hydration utilities (resolve unit slugs to full profiles)
- `skill-summaries.ts` — Enriches skill data with human-readable summaries
- `run_analysis.ts` — Standalone script for analyzing army codes
- `types.ts` — MCP-specific type definitions

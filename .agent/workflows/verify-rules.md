---
description: Protocol for verifying Infinity game rules before answering
---

# Rules Verification Workflow

Use this workflow BEFORE making any claims about Infinity N5 game mechanics.

## Core Principle

**Never rely on training data for Infinity rules.** The game has had multiple editions (N3, N4, N5) with significant rule changes. Always verify with the wiki.

## Steps

1. **Identify the rule in question**
   - What skill, equipment, state, or mechanic is involved?
   - What specific interaction is being asked about?

2. **Look up the primary rule**:
   ```
   read_wiki_page(url: "Rule_Name")
   ```
   Replace spaces with underscores. Examples:
   - `Mimetism`, `Camouflage`, `Total_Reaction`
   - `BS_Attack`, `CC_Attack`, `Dodge`
   - `Unconscious_State`, `Targeted_State`

3. **If page not found, search**:
   ```
   search_wiki(query: "search term")
   ```
   This searches full text and returns matching page names.

4. **Check related rules** for interactions:
   - If asking about attack modifiers → check both attacker skills AND target skills
   - If asking about states → check how states are applied AND removed
   - If asking about hacking → check both programs AND target requirements

5. **For tournament/ITS questions**:
   ```
   search_its_rules(query: "topic")
   read_its_rules(section: "Section Name")
   ```

## Common Rule Lookups

| Question Type | Look Up |
|--------------|---------|
| "Does X apply in ARO?" | The skill page, check for "ARO" label |
| "What MOD does X give?" | The skill page EFFECTS section |
| "Can X be hacked?" | `Hackable` and the unit's type |
| "Does X work through smoke?" | `Smoke`, `Multispectral_Visor` |
| "What does this ammo do?" | Ammo name (e.g., `Shock`, `AP`, `DA`) |

## Example

Question: "Does Mimetism work against Guided attacks?"

1. `read_wiki_page(url: "Mimetism")` → Check if it mentions Guided exceptions
2. `read_wiki_page(url: "BS_Attack")` → Find BS Attack (Guided) rules
3. Answer based on wiki content: "BS Attack (Guided) explicitly ignores Mimetism"

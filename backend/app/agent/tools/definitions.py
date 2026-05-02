"""Tool definitions (JSON schema) sent to the LLM provider."""

TOOL_DEFINITIONS: list[dict] = [
    {
        "name": "search_units",
        "description": (
            "Search for units by name or ISC, optionally filtered by faction. "
            "Returns a list of matching units with their name, ISC, faction list, and points range. "
            "Use this to find units that match criteria like 'cheap gunfighter' or to look up "
            "whether a specific unit exists in a faction."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Text to search for in unit name or ISC. Optional.",
                },
                "faction_id": {
                    "type": "integer",
                    "description": "Filter results to a specific faction by its numeric ID. Optional.",
                },
                "min_points": {
                    "type": "integer",
                    "description": "Minimum points cost filter. Optional.",
                },
                "max_points": {
                    "type": "integer",
                    "description": "Maximum points cost filter. Optional.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return. Defaults to 20.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_unit_profile",
        "description": (
            "Get detailed profile for a specific unit including stats (MOV, CC, BS, PH, WIP, ARM, BTS, W, S), "
            "available loadout options with their weapons/skills/equipment and points/SWC costs. "
            "Use this when the user asks about a specific unit's capabilities or to compare options."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "slug": {
                    "type": "string",
                    "description": "The unit's URL slug (e.g. 'fusilier', 'knauf'). "
                    "Use search_units first if you don't know the slug.",
                },
            },
            "required": ["slug"],
        },
    },
    {
        "name": "get_faction_context",
        "description": (
            "Get overview of a faction: its fireteam chart and available unit roster. "
            "Useful for list-building advice, understanding faction strengths, or when "
            "the user asks about what units or fireteams are available."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "faction_id": {
                    "type": "integer",
                    "description": "The faction's numeric ID.",
                },
                "include_roster": {
                    "type": "boolean",
                    "description": "Whether to include the unit roster. Defaults to true.",
                },
                "include_fireteams": {
                    "type": "boolean",
                    "description": "Whether to include the fireteam chart. Defaults to true.",
                },
            },
            "required": ["faction_id"],
        },
    },
    {
        "name": "validate_fireteam",
        "description": (
            "Validate whether a set of units can form a valid fireteam together and "
            "calculate the fireteam bonuses they would receive. "
            "Use this to answer 'can X, Y, Z form a fireteam?' or 'what bonuses does this fireteam get?'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "faction_id": {
                    "type": "integer",
                    "description": "The faction's numeric ID.",
                },
                "team_name": {
                    "type": "string",
                    "description": "The name of the fireteam type (e.g. 'Fusilier Core Fireteam').",
                },
                "member_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of unit ISC names to check for this fireteam.",
                },
            },
            "required": ["faction_id", "team_name", "member_names"],
        },
    },
    {
        "name": "analyze_matchup",
        "description": (
            "Calculate face-to-face roll probabilities between two combatants. "
            "Given attacker and defender stats, returns win percentages and expected wounds. "
            "Use for questions like 'will my unit beat X?' or 'what are the F2F odds?'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "active_sv": {
                    "type": "integer",
                    "description": "Active player's skill value (BS or CC).",
                },
                "active_burst": {
                    "type": "integer",
                    "description": "Active player's burst (B value).",
                },
                "active_damage": {
                    "type": "integer",
                    "description": "Active player's weapon damage.",
                },
                "active_ammo": {
                    "type": "string",
                    "description": "Active player's ammo type: NORMAL, DA, EXP, T2, PLASMA. Defaults to NORMAL.",
                },
                "reactive_sv": {
                    "type": "integer",
                    "description": "Reactive player's skill value.",
                },
                "reactive_burst": {
                    "type": "integer",
                    "description": "Reactive player's burst (usually 1 in ARO).",
                },
                "reactive_damage": {
                    "type": "integer",
                    "description": "Reactive player's weapon damage.",
                },
                "reactive_ammo": {
                    "type": "string",
                    "description": "Reactive player's ammo type. Defaults to NORMAL.",
                },
                "target_arm": {
                    "type": "integer",
                    "description": "Target's ARM value (defensive side).",
                },
                "active_arm": {
                    "type": "integer",
                    "description": "Active unit's ARM value.",
                },
            },
            "required": [
                "active_sv",
                "active_burst",
                "active_damage",
                "reactive_sv",
                "reactive_burst",
                "reactive_damage",
                "target_arm",
                "active_arm",
            ],
        },
    },
    {
        "name": "analyze_classifieds",
        "description": (
            "Analyze which classified objectives a list can complete based on the units and skills in the list. "
            "Returns which classifieds are achievable and which are not, with explanations. "
            "Use when the user asks about classified coverage or wants to optimize for objectives."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "unit_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of unit ISC names in the army list.",
                },
            },
            "required": ["unit_names"],
        },
    },
]

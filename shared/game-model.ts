/**
 * Infinity (N4) Game Domain Model
 * =================================
 * This file is the canonical reference for how CB raw data maps to game concepts.
 * It defines what every field means in game terms, not just what shape it has.
 *
 * Every component that touches unit/list/fireteam data should use these types.
 * When CB updates their data format, this file is the first place to update.
 *
 * Data source: Corvus Belli Army Builder JSON export (N4 edition)
 */

// ============================================================================
// UNIT CLASSIFICATION
// ============================================================================

/**
 * The eight troop types in N4 Infinity.
 * In CB raw JSON, stored as `profile.type` (integer).
 *
 * These determine base movement rules, TAGCom eligibility, REM pilot rules, etc.
 * Confirmed from data mining faction JSON files.
 *
 * Troop type only matters when a specific rule references it (e.g., Hacking targets
 * Hackable units). It does NOT restrict fireteam eligibility or list composition.
 */
export const UnitType = {
    LI:     1, // Light Infantry    — most common troop class
    MI:     2, // Medium Infantry   — medium armored troops
    HI:     3, // Heavy Infantry    — power armored troops
    TAG:    4, // Tactical Armored Gear — large combat vehicles, require pilot
    REM:    5, // Remote            — robotic units; require Net-Link or REM Pilot to activate
    SK:     6, // Skirmisher        — light troops with Mimetism and infiltration capabilities
    WB:     7, // Warband           — impetuous troops (Myrmidons, Yuan Yuan, Antipodes)
    TURRET: 8, // Turret / Structure — placed by troopers via Place Deployable skill during game; never generates orders
} as const;

export type UnitTypeId = typeof UnitType[keyof typeof UnitType];

// ============================================================================
// ORDERS
// ============================================================================

/**
 * Order types that a unit can generate or hold.
 * In CB raw JSON, stored in `option.orders[].type`.
 *
 * In CB raw JSON, `option.orders` is an array of { type, list, total }.
 *
 * The `list` field is used by the CB Army app to display order icons.
 * `list=1` means the order is shown/generated; `list=0` appears only on
 * LIEUTENANT orders and means it goes to the LT pool instead of shared pool.
 *
 * The `total` field indicates how many of that order type the unit generates.
 *
 * Regular vs Irregular pool assignment is encoded purely in the `type` field,
 * not in `list`. Impetuous orders are a separate pool used in the Impetuous Phase.
 *
 * A unit can generate multiple order types simultaneously:
 *   - REGULAR + IMPETUOUS (e.g. Penthesilea, Krakot Renegades)
 *   - IRREGULAR + IMPETUOUS (e.g. Yuan Yuan, McMurrough)
 *   - REGULAR + TACTICAL + LIEUTENANT (e.g. Maximus Optimate)
 *
 * Impetuous orders are always spent in the separate Impetuous Phase before
 * the main Order Phase. Being Regular/Irregular is orthogonal to Impetuous.
 */
export type OrderType =
    | 'REGULAR'    // Added to the shared order pool each round
    | 'IRREGULAR'  // Private order — used only by the owning unit, not added to shared pool
    | 'IMPETUOUS'  // Spent in the Impetuous Phase; forces unit to advance toward enemy
    | 'TACTICAL'   // Tactical Awareness order — extra order for the unit (rare; Maximus Optimate)
    | 'LIEUTENANT' // Lieutenant order — goes to LT pool (list=0), not shared pool
    ;

// ============================================================================
// UNIT CHARACTERISTICS
// ============================================================================

/**
 * Characteristic flags encoded in `profile.chars` (array of IDs).
 * These are game-rule properties that apply to the whole profile.
 *
 * From CB raw data: `filters.chars` in any faction JSON maps IDs to names.
 * Confirmed IDs from nomads.json filters.
 */
export const CharacteristicId = {
    CUBE:         1,  // Has a Cube (can be captured, interacts with Sepsitor)
    NO_CUBE:      2,  // Explicitly no Cube
    REGULAR:      3,  // Generates Regular orders (adds to shared pool)
    IRREGULAR:    4,  // Generates Irregular orders only (private pool)
    NOT_IMPETUOUS: 5, // Explicitly NOT impetuous (immune to impetuous rules)
    IMPETUOUS:    6,  // Subject to Impetuous rule each Active Turn (separate Impetuous Phase)
    CUBE_2_0:     20, // Cube 2.0 — advanced version of Cube; lore/rules interaction (see wiki Cube)
    HACKABLE:     21, // Can be targeted by Hacking programs
    PERIPHERAL:   27, // Is a Peripheral unit attached to another trooper
} as const;

export type CharacteristicId = typeof CharacteristicId[keyof typeof CharacteristicId];

// ============================================================================
// AVAILABILITY
// ============================================================================

/**
 * `profile.ava` — how many copies of this profile may appear in a list.
 *
 * Special values:
 *   ava = -1   → Not independently purchasable. Includes:
 *                (a) true peripherals (have Peripheral skill ID 243)
 *                (b) Transmutation escape profiles (TAG pilots, damaged states)
 *                Use Peripheral skill ID 243 to distinguish, NOT ava alone.
 *   ava = 255  → Unlimited (CB convention for "no cap")
 *   ava = 1-8  → Specific numeric limit
 *   ava = 0    → Data error. Only occurs once (Agamemnon's KARKATA in steel-phalanx).
 *                The ETL should normalize ava=0 on peripheral profiles to ava=-1.
 */
export const AVA_UNLIMITED = 255;
export const AVA_PERIPHERAL = -1;

// ============================================================================
// EXTRAS — SKILL AND EQUIPMENT MODIFIERS
// ============================================================================

/**
 * The "extras" system is how CB encodes skill and equipment variants.
 *
 * In raw JSON: `skill.extra = [id, ...]` where each ID references an entry in
 * `filters.extras` within the faction file. Each extra has a `name` (display string)
 * and optional `type` ("TEXT" or "DISTANCE").
 *
 * Example: Mimetism with extra=[7] resolves to Mimetism(-6).
 *          Combat Jump with extra=[255] resolves to Combat Jump (Explosion).
 *
 * This enum groups extras by semantic category so components know how to
 * interpret and display them. Derived from exhaustive audit of all faction files.
 */

/**
 * Stat roll modifiers — apply a positive/negative modifier to a skill or attack roll.
 * These appear on skills like Mimetism, Dodge, BS Attack, CC Attack.
 * Extra type: TEXT
 */
export type StatModifierExtra =
    | '+3' | '+6' | '+9'    // Positive BS/PH roll modifiers
    | '-3' | '-6' | '-8' | '-9' // Negative roll modifiers (e.g. Mimetism penalty to attacker)
    | '+1B' | '+2B'         // Extra burst dice
    | '+1SD'                // Extra simultaneous dice
    | '+1 Dam'              // +1 Damage
    | '+1 BS' | '+3 BS' | '+5 CC' // Stat bonus overrides
    ;

/**
 * Distance/range modifiers — modify a skill's deployment or movement distance.
 * Extra type: DISTANCE
 * These appear on skills like Forward Deployment, Dodge, Infiltration, Jump.
 */
export type DistanceExtra =
    | '+2.5' | '+5' | '+7.5' | '+10' | '+20' | '20' | '7.5'
    ;

/**
 * Stat override extras — set a stat to a fixed value for a specific roll.
 * Appear on skills like Combat Jump (use PH=X), Infiltration (use PH=X), Dodge.
 */
export type StatOverrideExtra =
    | 'PH=9' | 'PH=10' | 'PH=11' | 'PH=12' | 'PH=13' | 'PH=14' | 'PH=15' | 'PH=16' | 'PH=18' | 'PH=19'
    | 'WIP=14'
    | 'CC=15'
    | 'BS=13'
    ;

/**
 * Deployment variant extras — specify HOW a deployment skill works.
 * Appear on Combat Jump and Parachutist.
 *
 *   "Dep. Zone"   → Parachutist deploys within own deployment zone (weaker)
 *   "Explosion"   → Combat Jump enters as a template explosion on landing (dangerous)
 */
export type DeploymentVariantExtra = 'Dep. Zone' | 'Explosion';

/**
 * Ammo / damage type extras — specify what ammo type an attack uses.
 * Appear on BS Attack, CC Attack, and Immunity skills.
 */
export type AmmoTypeExtra =
    | 'Shock'             // Shock ammo: wounds become dead on failed ARM
    | 'AP'                // Armour Piercing: halve ARM
    | 'Guided'            // Guided: targets via Pitcher marker, ignores cover
    | 'T2'                // Teseum: causes two wounds on success
    | 'Viral'             // Viral: two BTS saves, each failure = wound
    | 'Antimaterial'      // Anti-materiel: effective vs. vehicles
    | 'Continous Damage'  // Continuous Damage: ongoing fire/toxic effect (note CB typo)
    ;

/**
 * Terrain type extras — specify which terrain type a Terrain skill covers.
 * Appear on the Terrain skill only.
 */
export type TerrainTypeExtra =
    | 'Total'          // All terrain types
    | 'Zero-G'
    | 'Aquatic'
    | 'Desert'
    | 'Jungle'
    | 'Mountain'
    | 'Aquatic/Jungle'
    ;

/**
 * Immunity type extras — specify what the unit is immune to.
 * Appear on the Immunity skill.
 */
export type ImmunityTypeExtra =
    | 'Enhanced'          // Enhanced Immunity: re-roll failed saves
    | 'ARM'               // Immune to ARM-reducing effects
    | 'POS'               // Immune to Possessed state
    | 'Shock'             // Immune to Shock ammo
    | 'Isolated'          // Immune to Isolated state
    | 'Critical'          // Immune to Critical hits
    | 'AP'                // Immune to AP effects
    | 'IMM-B'             // Immune to IMM-B state
    | 'BTS'               // Immune to BTS-affecting attacks
    | 'Viral'             // Immune to Viral ammo
    ;

/**
 * Peripheral relationship types — how a peripheral unit relates to its controller.
 * Appear on the Peripheral skill (ID 243).
 *
 * These have distinct game mechanics (see data/wiki/Peripheral.md):
 *
 * IMPORTANT: Peripherals and their Controller cannot be part of a Coordinated
 * Order or any type of Fireteam. Exception: Ancillary controllers CAN join
 * fireteams if the Ancillary is not yet deployed or is in Disconnected/Null state
 * (deploying it causes the controller to leave the fireteam automatically).
 *
 * Controller + all Peripherals count as ONE unit for Combat Group limits.
 * They are always in the same Combat Group — moving controller moves peripherals.
 * Peripherals are activated with the same Order as their Controller.
 * Most peripherals contribute zero orders (empty orders array); rare exceptions
 * exist (e.g., Billie in "Jazz & Billie" generates a Regular order).
 *
 *   Synchronized  — Must stay in Coherency with controller (ZoC range).
 *                   Both activated by the same Order.
 *                   Example: Devabot (Deva Functionaries)
 *
 *   Servant       — No distance limit. Max 2 per controller.
 *                   Only Doctor/Engineer controllers. Extends Doctor/Engineer
 *                   range — if Servant is in silhouette contact with target,
 *                   controller can use Doctor/Engineer on that target remotely.
 *                   Example: Yudbots
 *
 *   Control       — No distance limit between Controller and Peripheral, but
 *                   Peripherals must stay in Coherency with a designated Spearhead.
 *                   Max 3 per controller (forms a Control Unit).
 *                   Example: Antipodes (Antipode Assault Pack), Puppetbots
 *
 *   Ancillary     — No distance limit. NOT deployed with controller initially;
 *                   deployed via Place Deployable skill during the game.
 *                   Controller CAN join fireteams while Ancillary is undeployed
 *                   or in Disconnected/Null state.
 *                   Example: KARKATA (Maruts), TURTLEMEK (Scarface & Cordelia)
 *
 *   Cyberplug     — Has two profiles: Connected (activated with controller,
 *                   controller performs Idle) and Autonomous (independent,
 *                   receives own orders). Max 2 per controller.
 *                   Only Cyberplug skill controllers. Functions like Servant for
 *                   Doctor/Engineer purposes.
 *                   Example: Sartroids
 */
export type PeripheralType =
    | 'Synchronized'  // extra[40]
    | 'Servant'       // extra[41]
    | 'Control'       // extra[47]
    | 'Ancillary'     // extra[322]
    | 'Cyberplug'     // extra[374]
    ;

// ============================================================================
// PROFILE GROUP CATEGORIES
// ============================================================================

/**
 * `profileGroup.category` — the force org category this profile group belongs to.
 * From CB raw JSON: `filters.category` in faction files maps IDs to names.
 *
 * 0 is used for peripheral profile groups and some auto-attach non-peripheral
 * units (e.g. Scylla's CHARYBDIS FTO — generates its own order, can join fireteams).
 * 12 is "HQ / Mechanized" — rare, only used by Maruts (aleph + operations).
 */
export const ProfileCategory = {
    PERIPHERAL_OR_UNCATEGORIZED: 0,
    GARRISON:    1,
    LINE:        2,
    SPEC_TRAINED: 3,
    VETERAN:     4,
    ELITE:       5,
    HQ:          6,
    MECHANIZED:  7,
    SUPPORT:     8,
    CHARACTER:   10,
    MERCENARY:   11,
} as const;

export type ProfileCategoryId = typeof ProfileCategory[keyof typeof ProfileCategory];

// ============================================================================
// FIRETEAMS
// ============================================================================

/**
 * Fireteam types in N4 Infinity.
 *
 * A Fireteam is a group of troopers who share orders and receive combat bonuses
 * when acting together. Types define CREATION size only:
 *
 *   CORE  — 3 to 5 members at creation. Some sectorials modify this
 *           (e.g. Steel Phalanx: CORE max 4 members).
 *   HARIS — Exactly 3 members at creation.
 *   DUO   — Exactly 2 members at creation.
 *
 * After creation, type labels don't matter — a CORE can lose members below 3
 * and remain a fireteam. A fireteam is cancelled when reduced to 1 member.
 * Members must always be in the same Combat Group.
 *
 * Bonuses are based on "Fireteam Level" (how many members share the same Unit
 * name), NOT on fireteam type:
 *   Level 1 (any): activated with single Regular Order
 *   Level 2 (2+ same unit): BS Attack (+1 SD) — extra die, must discard one
 *   Level 3 (3+ same unit): +3 Discover, +1 Dodge
 *   Level 4 (4+ same unit): +1 BS
 *   Level 5 (all 5 same unit): Sixth Sense
 *
 * Cannot join a fireteam:
 *   - Peripherals and their Controllers (exception: Ancillary controllers OK
 *     while Ancillary is undeployed/Disconnected/Null)
 *   - Troopers in Marker form, Isolated State, or any Null State
 *   - Troopers with Infiltration or Airborne Deployment skills
 *   - Troopers in Suppressive Fire State
 *
 * "FTO" (Fire Team Option) profiles: when a unit has profiles marked "FTO",
 * only those specific profiles can join fireteams.
 *
 * No faction-specific fireteam types beyond CORE/HARIS/DUO were found in data.
 */
export type FireteamType = 'CORE' | 'HARIS' | 'DUO';

/**
 * `fireteamChart.spec` — maximum number of each fireteam type allowed in this faction.
 *
 * CB uses 256 as "unlimited" (same convention as weapon burst limits elsewhere).
 * A value of 0 means this fireteam type is not available to this faction.
 *
 * Example from data:
 *   bakunin:        { CORE: 1, HARIS: 1, DUO: 256 }  → 1 Core, 1 Haris, unlimited Duos
 *   combined-army:  { CORE: 0, HARIS: 1, DUO: 2 }    → no Core, 1 Haris, 2 Duos
 *   ank-program:    { CORE: 0, HARIS: 0, DUO: 0 }     → no fireteams at all
 */
export const FIRETEAM_UNLIMITED = 256;

export interface FireteamSpec {
    CORE:  number; // 0 = not available; 256 = unlimited
    HARIS: number;
    DUO:   number;
    [key: string]: number; // future-proofing only — no non-standard types found in current data
}

/**
 * A single unit entry within a fireteam composition.
 *
 * `required: true` means at least one model of ANY required unit type must be
 * present for the fireteam to be valid. You do NOT need one of each required
 * type — just one of any required type. This is typically shown as "min: *"
 * in the official fireteam chart.
 *
 * `min`/`max` constrain how many of this unit type can appear in one fireteam.
 * Typically min=0 (optional) or min=1 (required lead unit).
 *
 * `comment` is a display annotation from CB (e.g. "(Reverend)" indicating
 * the Reverend sub-tag requirement). NOT a machine-readable constraint.
 */
export interface FireteamSlot {
    slug:     string;    // Unit slug — matches unit.slug for lookup
    name:     string;    // Display name (ISC) for the unit
    min:      number;    // Minimum count of this unit in the fireteam
    max:      number;    // Maximum count of this unit in the fireteam
    required: boolean;   // Must at least one of this unit be present?
    comment:  string;    // Display annotation, not a machine-readable constraint
}

/**
 * A fireteam composition — a named group of compatible units.
 *
 * `type` is an array because the same composition can qualify for multiple
 * fireteam types. Example: "Moderators Fireteams" can form as either HARIS
 * or CORE (same units, different size).
 *
 * The total models selected from `units` must satisfy the size requirement
 * for the chosen `type` (DUO=2, HARIS=3, CORE=3-5).
 */
export interface FireteamComposition {
    name:  string;           // Display name, e.g. "Moderators Fireteams"
    type:  FireteamType[];   // Which fireteam types this composition can form
    units: FireteamSlot[];   // Units eligible to fill slots in this composition
    obs?:  string;           // Observation/note from CB (rarely populated)
}

/**
 * The complete fireteam data for a faction.
 *
 * `spec` constrains how many of each type the faction may field simultaneously.
 * `compositions` lists every valid fireteam group definition.
 */
export interface FactionFireteamChart {
    spec:         FireteamSpec;
    compositions: FireteamComposition[];
}

// ============================================================================
// SKILLS
// ============================================================================

/**
 * A skill instance as it appears on a profile or loadout option.
 *
 * `modifiers` contains the decoded extra values — what each extra ID resolves to.
 * These are display strings (e.g. "-6", "Dep. Zone", "Shock") not raw IDs.
 *
 * `displayName` is the fully assembled name: "Mimetism(-6)", "Combat Jump (Explosion)",
 * "Terrain (Total)", "BS Attack (+1B, AP)", etc.
 *
 * Why keep both `id` + `name` + `modifiers` + `displayName`?
 * — `id` is needed to look up wiki links and group related skills
 * — `name` is the base skill name for filtering ("Mimetism", not "Mimetism(-6)")
 * — `modifiers` are needed by game logic (e.g. knowing Mimetism is -6 not -3)
 * — `displayName` is what the user sees
 */
export interface SkillInstance {
    id:          number;
    name:        string;           // Base skill name, e.g. "Mimetism"
    modifiers:   string[];         // Decoded extras, e.g. ["-6"] or ["Dep. Zone"]
    displayName: string;           // Full display string, e.g. "Mimetism(-6)"
    wikiUrl?:    string;
}

/**
 * FT Master skill (ID 261) — grants bonuses when leading named unit types.
 *
 * Effects (from wiki):
 *   1. During Order Count, if FT Master is in a fireteam, all members become Regular
 *      (converts Irregular members to Regular for that turn).
 *   2. If all members are already Regular, the Team Leader gets +2" ZoC for
 *      Coherency Checks (not cumulative with other ZoC bonuses).
 *   3. If the named unit type is in the fireteam, the fireteam auto-cancels
 *      if the FT Master trooper leaves.
 *
 * The modifier names the specific unit type (e.g. "Shaolin", "Kuang Shi").
 * Extra IDs seen: [329]=Shaolin, [325]=Kuang Shi, [336]=Diablos, [338]=Morlocks etc.
 */
export const FT_MASTER_SKILL_ID = 261;

/**
 * Peripheral skill (ID 243) — marks a profile as a peripheral unit.
 * The modifier specifies the peripheral relationship type.
 *
 * Extra IDs: [40]=Synchronized, [41]=Servant, [47]=Control, [322]=Ancillary, [374]=Cyberplug
 */
export const PERIPHERAL_SKILL_ID = 243;

/**
 * Hacker skill (ID 1000) — special CB ID for the Hacker class skill.
 * Hacker upgrades are encoded as equipment extras on Hacking Device variants,
 * not as skill extras.
 */
export const HACKER_SKILL_ID = 1000;

/**
 * Skill variant extras for Doctor and Engineer:
 *   "2W" (extra[253])   — Doctor(2W): removes 2 Wounds when cancelling Unconscious
 *   "ReRoll" (extra[277]) — Doctor/Engineer(ReRoll WIP=X): failed roll can be rerolled
 *                           using the WIP value specified; must accept second result
 *   "ReRoll -3" (extra[366]) — Older notation for ReRoll with -3 WIP mod (now uses WIP=X)
 *   "Non Specialist" (extra[375]) — Chain of Command variant: bearer explicitly does
 *                                    NOT count as a specialist for ITS objectives
 */

// ============================================================================
// EQUIPMENT
// ============================================================================

/**
 * An equipment instance as it appears on a profile or loadout option.
 * Same structure as SkillInstance — extras decode to modifier strings.
 *
 * Hacking Device variants (IDs 100, 101, 145, 182) carry UPGRADE extras that
 * specify which hacking programs are available. These are display-only — the
 * actual program list is defined in the Hacking Device item description.
 *
 * Example: Hacking Device with extra[12]="UPGRADE: Trinity" means this
 * particular HD variant has the Trinity program available.
 */
export interface EquipmentInstance {
    id:          number;
    name:        string;
    modifiers:   string[];
    displayName: string;
    wikiUrl?:    string;
}

// ============================================================================
// ARMY LIST CONSTRAINTS
// ============================================================================

/**
 * Standard N4 army list structure rules.
 *
 * A list is divided into Combat Groups, each capped at 10 units.
 * Controller + all Peripherals count as ONE unit for this cap.
 *
 * The default points limit for a standard game is 300pts.
 * SWC (Support Weapon Cost) limit is always pointsLimit / 50.
 *   e.g. 300pts → 6 SWC, 200pts → 4 SWC
 *
 * Exactly one unit in the army must have the Lieutenant skill for the list
 * to be valid. The Lieutenant generates a special LT order (separate pool).
 *
 * Disabled options (peripherals auto-included via `includes`) have a points
 * cost but it does NOT count toward the army's total points budget.
 *
 * These are standard game rules, not CB data — encode them as constants
 * so they're not scattered as magic numbers across the codebase.
 */
export const LIST_DEFAULTS = {
    POINTS_LIMIT:           300,
    SWC_PER_POINTS:         50,   // 1 SWC per 50 points
    MAX_UNITS_PER_GROUP:    10,
} as const;

// ============================================================================
// MOVEMENT
// ============================================================================

/**
 * Movement values in CB raw JSON are stored as centimeters in some cases
 * and inches in others (a legacy inconsistency in their data pipeline).
 *
 * Conversion rule: if raw value >= 10, treat as centimeters and convert
 * to inches: inches = Math.round(cm * 0.4)
 * If raw value < 10, assume already in inches.
 *
 * Common values:
 *   10cm → 4"    (standard slow movement, e.g. HI, TAGs)
 *   15cm → 6"    (standard fast movement, e.g. LI, REMs)
 *   20cm → 8"    (very fast, e.g. cavalry, bikes)
 *
 * The Profile interface stores movement already converted to inches.
 * Raw CB JSON `profile.move` is [first_move_cm, second_move_cm].
 */
export const MOVEMENT_CM_TO_INCHES = 0.4;
export const MOVEMENT_CM_THRESHOLD = 10; // values >= this are centimeters

// ============================================================================
// PROFILES AND LOADOUTS
// ============================================================================

/**
 * A stat line for a unit variant. One unit can have multiple profiles
 * (e.g. "Regular" and "Impetuous" versions, or TAG + pilot profiles).
 *
 * All stats are integers. CB raw data has inconsistent nulling (null/""/0 are
 * all possible for missing values); the ETL normalizes these to 0 or null.
 *
 * `ava` = availability within the faction list:
 *   - 1-8: specific cap
 *   - 255: unlimited (AVA_UNLIMITED)
 *   - -1:  peripheral attachment (AVA_PERIPHERAL) — not independently purchasable
 *
 * `peripheralType` is set when this profile has the Peripheral skill (ID 243).
 * It describes the mechanical relationship with the controlling unit.
 *
 * BTS note: "Bio-Technological Shield" — the saving roll against hacking programs,
 * fire, and poison attacks. NOT related to grenades. (Common misread of the abbreviation.)
 *
 * `s` (silhouette) maps to base size: 1→25mm, 2→32mm, 3→40mm, 4→55mm, 5→70mm, 6→custom TAG
 */
export interface Profile {
    id:    number;
    name:  string;
    unitType: UnitTypeId;

    // Movement: [first move, second move] in inches
    move: [number, number];

    // Combat stats
    cc:  number; // Close Combat
    bs:  number; // Ballistic Skill
    ph:  number; // Physical (dodge, throw, climb)
    wip: number; // Willpower (hacking, doctor, engineer, command)
    arm: number; // Armour
    bts: number; // BioTechno Shield
    w:   number; // Wounds / Structure points
    s:   number; // Silhouette template size (1-6, corresponds to 25/32/40/55/70mm bases)

    /** True if this profile uses Structure (vehicles/TAGs) instead of Wounds */
    isStructure: boolean;

    ava:  number; // Availability (use AVA_UNLIMITED / AVA_PERIPHERAL constants)
    characteristics: CharacteristicId[];

    skills:    SkillInstance[];
    equipment: EquipmentInstance[];
    weapons:   WeaponInstance[];

    /** Set if this profile has the Peripheral skill */
    peripheralType?: PeripheralType;
}

/**
 * A weapon reference as it appears on a profile or option.
 * Weapons are defined globally in metadata; this is just the reference + modifiers.
 *
 * Note: weapon extras are rare — they appear on abstract skills like BS Attack
 * rather than on named weapons. Named weapons (Combi Rifle, HMG, etc.) generally
 * have no extras.
 */
export interface WeaponInstance {
    id:          number;
    name:        string;
    modifiers:   string[];
    displayName: string;
    wikiUrl?:    string;
}

/**
 * A loadout option — one purchasable equipment configuration for a profile group.
 * Defines the points cost, SWC, and which weapons/skills/equipment are included.
 *
 * Key mechanics:
 * — `points` is always an integer (CB raw stores as number; the ETL coerces)
 * — `swc` is a decimal (CB raw stores as string "0.5"; the ETL parses to float)
 * — `orders` defines what order pool contribution this loadout makes
 * — `minis` is the number of physical miniatures included (usually 1; can be 2+
 *    for unit packs like "2 Moderators")
 *
 * Skills/equipment/weapons here are ADDITIONS to the base profile — they add to
 * or replace what's on the profile. Check the CB wiki for which overrides which.
 *
 * `disabled` (from CB raw): when true, this option cannot be independently selected.
 * Disabled options are peripheral loadouts auto-included via the parent option's
 * `includes` array. Their points cost exists for game rules that reference cost
 * (e.g., Victory Points) but does NOT count toward the list's total points budget.
 *
 * `includes` (from CB raw): array of { q, group, option } references.
 * `group` is the 1-based profile group index (e.g., group=2 = second profile group,
 * typically the peripheral). `option` is the option index within that group.
 * `q` is the quantity included. This is how peripherals are auto-attached to their
 * parent unit's loadout selection.
 */
export interface Loadout {
    id:     number;
    name:   string;      // e.g. "Combi Rifle + Light Shotgun"
    points: number;
    swc:    number;      // Support Weapon Cost (decimal, e.g. 0.5, 1.0, 1.5)
    minis:  number;      // Number of miniatures in this loadout (usually 1)
    orders: OrderEntry[];
    skills:    SkillInstance[];
    equipment: EquipmentInstance[];
    weapons:   WeaponInstance[];
}

/**
 * An order contribution from a loadout option.
 * `inPool` = whether this order is added to the shared order pool (true = Regular).
 * `count` = how many of this order type are generated.
 *
 * Derived from CB raw: `{ type, list, total }` where list=1 means in pool.
 */
export interface OrderEntry {
    type:   OrderType;
    inPool: boolean;  // list === 1
    count:  number;   // total
}

// ============================================================================
// PROFILE GROUPS
// ============================================================================

/**
 * A profile group is a named variant of a unit — e.g. "Ninjas" vs "Reinf. Ninjas",
 * or the main TAG body vs its pilot profile.
 *
 * Every profile group contains:
 *  - One or more stat-line profiles (usually 1, sometimes 2 for TAG+pilot)
 *  - One or more loadout options (the purchasable configurations)
 *
 * `isPeripheral` is true when any profile in this group has the Peripheral
 * skill (ID 243), or when ava=-1 on all profiles.
 *
 * IMPORTANT: The old codebase used a heuristic to detect peripherals:
 *   "secondary profile group + type=5 (REM) + single option + cost ≤ 5pts"
 * This was fragile. The correct detection is the Peripheral skill (ID 243).
 * The processed model sets `isPeripheral` explicitly so no heuristic is needed.
 *
 * `category` maps to ProfileCategory — the force organisation slot.
 * Peripheral profile groups use category=0 (PERIPHERAL_OR_UNCATEGORIZED).
 * Some non-peripheral profile groups also use category=0 (e.g. CHARYBDIS FTO
 * for Scylla — an auto-attach unit that generates its own Regular order but
 * is NOT a peripheral, so it CAN join fireteams).
 *
 * Multi-profile groups (2+ stat lines) represent Transmutation forms:
 *   - Transmutation(X): profile 1 = initial form, profile 2 = damaged/transformed form
 *   - Transmutation(Escape System): e.g. TAG body → pilot when TAG is destroyed
 *   - Transmutation(Auto): can switch freely between profiles during movement
 *   - Transmutation(Hatching): starts as Seed-Embryo, hatches into Developed Form
 *   - Transmutation(WIP): passes WIP roll to switch to second profile for the turn
 * The first profile is always the starting/default state.
 * Wounds/Structure are shared across all profiles of a Transmutation unit.
 *
 * "FTO" (Fire Team Option) in profile/ISC names: when a unit has FTO profiles,
 * ONLY those profiles can join fireteams. The non-FTO profiles cannot.
 */
export interface ProfileGroup {
    id:       number;
    isc:      string;      // Display name of this variant, e.g. "Ninjas"
    category: ProfileCategoryId;
    profiles: Profile[];   // Stat lines (usually 1; TAGs may have 2: body + pilot)
    options:  Loadout[];   // Purchasable loadout configurations
    notes?:   string;      // Flavour/rules note from CB

    isPeripheral: boolean;
    peripheralType?: PeripheralType; // Set when isPeripheral=true
}

// ============================================================================
// UNITS
// ============================================================================

/**
 * A fully processed unit, ready for the list builder and explorer tools.
 *
 * ISC (Infinity Special Characteristic) is the canonical unique unit name
 * used for deduplication. The same ISC may appear in multiple factions
 * (e.g. mercenaries), in which case `factionIds` contains all of them.
 *
 * Pre-computed aggregates allow fast filtering without walking the full
 * profile/option tree at query time:
 * — `allWeaponIds`, `allSkillIds`, `allEquipmentIds`: union of all item IDs
 *   across every profile and option (used for search filters)
 * — `pointsRange`: [min, max] across all non-disabled options (used for
 *   points-budget filtering)
 * — `hasPeripherals`: quick flag for list-building UI
 */
export interface ProcessedUnit {
    id:         number;
    isc:        string;    // Unique unit name, e.g. "Ninjas"
    name:       string;    // Display name (may differ from ISC)
    slug:       string;    // URL-safe identifier
    logo?:      string;    // URL to unit logo image

    factionIds: number[];  // All faction IDs this unit belongs to

    profileGroups: ProfileGroup[];

    // Pre-computed search aggregates
    allWeaponIds:    number[];
    allSkillIds:     number[];
    allEquipmentIds: number[];
    pointsRange:     [number, number]; // [min points option, max points option]
    hasPeripherals:  boolean;
}

// ============================================================================
// FACTION
// ============================================================================

/**
 * A processed faction with its full game data.
 *
 * `parentId` is the ID of the "vanilla" (parent) faction when this is a sectorial.
 * When parentId === id, this IS the vanilla faction.
 * When parentId !== id, this is a sectorial army derived from the parent.
 *
 * Each faction file contains only the units eligible for that faction — there
 * is no "mixing" flag. Sectorials include a subset of the vanilla faction's
 * units, explicitly listed. Unit eligibility is purely based on what CB puts
 * in each faction file.
 *
 * NOTE: CB raw data has "phantom" parent IDs where the referenced parent faction
 * does not exist as a standalone entry (e.g. faction 199 with parent 191 where
 * 191 has no vanilla entry). The processed model normalises these by setting
 * parentId = null for orphaned sectorials.
 *
 * `discontinued` = true for factions removed from active play (still in data for
 * backward compatibility with old lists).
 *
 * Reinforcement factions follow a naming convention in CB data: their ID ends
 * in 91 (e.g., 191, 291, 391) and their parent ID points to the main faction
 * (e.g., 101, 201, 301). These are separate force lists used in reinforcement
 * missions — not playable as standalone armies. Skip for now.
 */
export interface ProcessedFaction {
    id:           number;
    name:         string;
    slug:         string;
    parentId:     number | null; // null if orphaned sectorial (CB phantom parent)
    isVanilla:    boolean;       // true if this is the parent army (not a sectorial)
    discontinued: boolean;
    logo:         string;

    fireteams: FactionFireteamChart | null;
}

// ============================================================================
// WEAPONS (GLOBAL CATALOG)
// ============================================================================

/**
 * A weapon definition from the global metadata catalog.
 *
 * Distance bands follow CB convention:
 *   short  → 0 to `max` inches, modifier applied
 *   medium → 0 to `max` inches, modifier applied
 *   long   → 0 to `max` inches, modifier applied
 *   max    → beyond long range; typically a heavy penalty
 *
 * All `mod` values are strings ("+3", "-3", "0", "-6") not numbers
 * because CB stores them as display strings, and some have special values.
 *
 * `burst` is a string — numeric for normal weapons (e.g. "3"), or "-" for
 * non-attack items (deployables, discover) that don't use standard attack rules.
 * No "2+1" style variable bursts have been found in data.
 *
 * `savingNum` is the number of saving rolls the target must make per hit.
 * This is derived from ammo type: DA=2, EXP=3, standard=1.
 *
 * `saving` is the attribute used for the save: "ARM", "BTS", "ARM/2", "BTS/2".
 * "ARM/2" means the AP effect — the target's ARM stat is halved for the save.
 * The saving attribute is generally derived from the weapon's ammunition type
 * except for Plasma which causes saves against multiple attributes.
 *
 * `weaponType` field: "WEAPON" (ranged/melee weapons), "EQUIPMENT" (gear items
 * listed in weapons array), "SKILL" (skill-based attacks listed in weapons array).
 * Many players don't remember which category items belong to, so the app should
 * not make strong distinctions between these in search/display.
 *
 * `ammunition` is the ammo type ID (references the global ammo catalog).
 */
export interface WeaponDefinition {
    id:           number;
    name:         string;
    weaponType:   'WEAPON' | 'CLOSE_COMBAT' | string; // CB uses "WEAPON" for ranged
    burst?:       string;   // Number of dice per order, e.g. "3" or "2+1"
    damage?:      string;   // Damage value, e.g. "13" or "-"
    saving?:      string;   // Save attribute, e.g. "ARM" or "ARM/2" or "BTS"
    savingNum?:   string;   // Number of saves required
    ammunition?:  number;   // Ammo type ID (references AmmunitionDefinition)
    properties:   string[]; // Special properties: ["Suppressive Fire", "Disposable (2)"]
    distance?:    DistanceBands;
    wikiUrl?:     string;
}

export interface DistanceBands {
    short?:  { max: number; mod: string };
    medium?: { max: number; mod: string };
    long?:   { max: number; mod: string };
    max?:    { max: number; mod: string };
}

// ============================================================================
// GLOBAL METADATA CATALOG
// ============================================================================

/**
 * The global item catalog loaded once at startup.
 * Contains all weapon, skill, equipment, and ammunition definitions
 * shared across all factions.
 */
export interface GameMetadata {
    weapons:     WeaponDefinition[];
    skills:      SkillDefinition[];
    equipment:   EquipmentDefinition[];
    ammunitions: AmmunitionDefinition[];
}

export interface SkillDefinition {
    id:      number;
    name:    string;
    wikiUrl?: string;
}

export interface EquipmentDefinition {
    id:      number;
    name:    string;
    wikiUrl?: string;
}

export interface AmmunitionDefinition {
    id:      number;
    name:    string;
    wikiUrl?: string;
}

// ============================================================================
// PROCESSED STATIC DATA OUTPUT
// ============================================================================

/**
 * The shape of the processed static JSON files output by the ETL pipeline.
 *
 * Per-faction file (`data/processed/{slug}.json`):
 *   Contains all units for this faction with fully resolved item names
 *   and pre-computed aggregates. Self-contained — no metadata lookup needed.
 *
 * Global metadata file (`data/processed/metadata.json`):
 *   Weapons, skills, equipment, and ammo catalogs with wiki links.
 *   Needed for wiki links, detailed weapon stat display, and global search.
 *
 * Global factions file (`data/processed/factions.json`):
 *   All faction definitions including fireteam charts.
 */
export interface ProcessedFactionFile {
    version:  string;           // Schema version for cache-busting, e.g. "2.0"
    faction:  ProcessedFaction;
    units:    ProcessedUnit[];
}

export interface ProcessedMetadataFile {
    version:   string;
    weapons:   WeaponDefinition[];
    skills:    SkillDefinition[];
    equipment: EquipmentDefinition[];
    ammunitions: AmmunitionDefinition[];
}

export interface ProcessedFactionsFile {
    version:  string;
    factions: ProcessedFaction[];
}

"""Python port of shared/fireteams.ts — fireteam validation and bonus calculation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class SlotAssignment:
    member_index: int
    slot_index: int
    provided_tags: list[str]


@dataclass
class FireteamBonus:
    level: int
    description: str
    is_active: bool


def get_unit_tags(name: str, comment: str | None = None) -> list[str]:
    tags: set[str] = set()
    tags.add(name.lower())

    if comment:
        lower = comment.lower()
        if "wildcard" in lower:
            tags.add("wildcard")
        clean = lower.replace("(", "").replace(")", "")
        for part in clean.replace("counts as", ",").split(","):
            t = part.strip()
            if t:
                tags.add(t)

    return list(tags)


def assign_members_to_slots(
    team: dict[str, Any],
    members: list[dict[str, Any]],
) -> list[SlotAssignment] | None:
    team_tags = get_unit_tags(
        team["name"]
        .lower()
        .replace(" fireteam", "")
        .replace(" core", "")
        .replace(" haris", "")
        .replace(" duo", "")
        .strip()
    )
    slots: list[dict[str, Any]] = team.get("units", [])
    best: list[SlotAssignment] = []

    def solve(
        member_idx: int,
        assigned: list[SlotAssignment],
        counts: list[int],
    ) -> bool:
        if member_idx == len(members):
            best[:] = list(assigned)
            return True

        m = members[member_idx]
        m_tags = get_unit_tags(m["name"], m.get("comment"))
        is_wildcard = "wildcard" in m_tags
        matches_team = any(t in tt or tt in t for t in m_tags for tt in team_tags)

        for s_idx, slot in enumerate(slots):
            if counts[s_idx] >= slot.get("max", 1):
                continue

            s_tags = get_unit_tags(slot["name"], slot.get("comment", ""))
            m_slug = m.get("slug")
            s_slug = slot.get("slug")

            if m_slug and s_slug and m_slug == s_slug:
                matches_slot = True
            else:
                matches_slot = any(t in st or st in t for t in m_tags for st in s_tags)

            can_fill = is_wildcard or matches_slot
            if not can_fill and matches_team:
                slot_matches_team = any(
                    st in tt or tt in st for st in s_tags for tt in team_tags
                )
                can_fill = slot_matches_team

            if can_fill:
                counts[s_idx] += 1
                provided = list(m_tags) + [t for t in s_tags if t not in m_tags]
                assigned.append(SlotAssignment(member_idx, s_idx, provided))

                if solve(member_idx + 1, assigned, counts):
                    return True

                assigned.pop()
                counts[s_idx] -= 1

        return False

    counts = [0] * len(slots)
    if solve(0, [], counts):
        return best
    return None


def calculate_fireteam_level(
    team: dict[str, Any],
    members: list[dict[str, Any]],
) -> int:
    if not members:
        return 0

    assignments = assign_members_to_slots(team, members)
    if not assignments:
        return 0

    normalized = (
        team["name"]
        .lower()
        .replace(" fireteam", "")
        .replace(" core", "")
        .replace(" haris", "")
        .replace(" duo", "")
        .strip()
    )

    count = 0
    for a in assignments:
        matches = any(
            t == "wildcard" or normalized in t or t in normalized
            for t in a.provided_tags
        )
        if matches:
            count += 1

    return count


def get_fireteam_bonuses(
    team: dict[str, Any],
    members: list[dict[str, Any]],
) -> list[FireteamBonus]:
    assignments = assign_members_to_slots(team, members)
    if not assignments:
        return []

    level_count = calculate_fireteam_level(team, members)
    size = len(members)
    team_type: list[str] = team.get("type", [])

    min_valid = 5
    if "CORE" in team_type:
        min_valid = min(min_valid, 3)
    if "HARIS" in team_type:
        min_valid = min(min_valid, 3)
    if "DUO" in team_type:
        min_valid = min(min_valid, 2)

    is_size_valid = False
    if size >= min_valid:
        if "DUO" in team_type and size <= 2:
            is_size_valid = True
        if "HARIS" in team_type and size <= 3:
            is_size_valid = True
        if "CORE" in team_type and size <= 5:
            is_size_valid = True

    slot_counts = [0] * len(team.get("units", []))
    for a in assignments:
        slot_counts[a.slot_index] += 1

    reqs_met = True
    for i, slot in enumerate(team.get("units", [])):
        if slot.get("min", 0) > 0 and slot_counts[i] < slot["min"]:
            reqs_met = False
            break

    required_slots = [u for u in team.get("units", []) if u.get("required")]
    if required_slots and reqs_met:
        has_required = any(
            team["units"][i].get("required") and slot_counts[i] > 0
            for i in range(len(team.get("units", [])))
        )
        if not has_required:
            reqs_met = False

    is_formed = is_size_valid and reqs_met

    bonus_chart = [
        (1, "Coherency"),
        (2, "+1 B (Requires 3+ active members)"),
        (3, "+3 BS (Requires 4+ active members)"),
        (4, "Sixth Sense (Requires 5 active members)"),
        (5, "+1 BS, Sixth Sense (Requires 5 active members)"),
    ]

    thresholds = [2, 3, 4, 5, 5]
    level_thresholds = [1, 2, 3, 4, 5]

    return [
        FireteamBonus(
            level=lvl,
            description=desc,
            is_active=(
                is_formed
                and size >= thresholds[i]
                and level_count >= level_thresholds[i]
            ),
        )
        for i, (lvl, desc) in enumerate(bonus_chart)
    ]

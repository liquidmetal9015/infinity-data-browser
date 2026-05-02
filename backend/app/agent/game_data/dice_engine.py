"""Python port of shared/dice-engine.ts — Infinity N5 F2F probability engine."""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class CombatantInput:
    sv: int
    burst: int
    damage: int
    ammo: str = "NORMAL"
    arm: int = 0
    bts: int = 0
    cont: bool = False
    crit_immune: bool = False


@dataclass
class F2FResult:
    active_wins: float
    reactive_wins: float
    draw: float
    expected_active_wounds: float
    expected_reactive_wounds: float
    wound_dist_active: dict[int, float] = field(default_factory=dict)
    wound_dist_reactive: dict[int, float] = field(default_factory=dict)


def create_infinity_die(sv: int) -> dict[int, float]:
    p = 0.05
    dist: dict[int, float] = {}

    applied_sv = sv
    bonus_crit_lower = 21

    if sv > 20:
        bonus_crit_lower = 20 - (sv - 20)
        applied_sv = 20

    for roll in range(1, 21):
        is_crit = False
        if sv > 20:
            if roll >= bonus_crit_lower:
                is_crit = True
        else:
            if roll == sv:
                is_crit = True

        if is_crit:
            f2f_val = 200
        elif roll <= applied_sv:
            f2f_val = roll
        else:
            f2f_val = 0

        dist[f2f_val] = dist.get(f2f_val, 0.0) + p

    return dist


def _get_prob_leq(die: dict[int, float], v: int) -> float:
    return sum(p for k, p in die.items() if k <= v)


def _get_max_dist(die: dict[int, float], burst: int) -> dict[int, float]:
    if burst == 0:
        return {0: 1.0}

    sorted_keys = sorted(set(die.keys()) | {0})
    dist: dict[int, float] = {}

    for i, v in enumerate(sorted_keys):
        p_leq = _get_prob_leq(die, v)
        p_less = _get_prob_leq(die, sorted_keys[i - 1]) if i > 0 else 0.0
        prob_max = p_leq**burst - p_less**burst
        if prob_max > 1e-9:
            dist[v] = prob_max

    return dist


def _n_c_k(n: int, k: int) -> float:
    if k < 0 or k > n:
        return 0.0
    return float(math.comb(n, k))


def solve_f2f(
    burst_a: int,
    burst_b: int,
    die_a: dict[int, float],
    die_b: dict[int, float],
) -> dict[str, float]:
    import json

    outcome_dist: dict[str, float] = {}
    max_a = _get_max_dist(die_a, burst_a)
    max_b = _get_max_dist(die_b, burst_b)

    for va, pa in max_a.items():
        for vb, pb in max_b.items():
            joint = pa * pb
            if joint < 1e-9:
                continue

            if va > vb:
                p_leq_va = _get_prob_leq(die_a, va)
                p_leq_vb = _get_prob_leq(die_a, vb)
                numer = p_leq_va - p_leq_vb
                p_hit = numer / p_leq_va if p_leq_va > 0 else 0.0
                is_crit = va >= 200

                for k in range(burst_a):
                    binom = (
                        _n_c_k(burst_a - 1, k)
                        * (p_hit**k)
                        * ((1 - p_hit) ** (burst_a - 1 - k))
                    )
                    res = {
                        "aSuccess": 1 + k,
                        "aCrit": is_crit,
                        "bSuccess": 0,
                        "bCrit": False,
                    }
                    key = json.dumps(res, sort_keys=True)
                    outcome_dist[key] = outcome_dist.get(key, 0.0) + joint * binom

            elif vb > va:
                p_leq_vb = _get_prob_leq(die_b, vb)
                p_leq_va = _get_prob_leq(die_b, va)
                p_hit = (p_leq_vb - p_leq_va) / p_leq_vb if p_leq_vb > 0 else 0.0
                is_crit = vb >= 200

                for k in range(burst_b):
                    binom = (
                        _n_c_k(burst_b - 1, k)
                        * (p_hit**k)
                        * ((1 - p_hit) ** (burst_b - 1 - k))
                    )
                    res = {
                        "aSuccess": 0,
                        "aCrit": False,
                        "bSuccess": 1 + k,
                        "bCrit": is_crit,
                    }
                    key = json.dumps(res, sort_keys=True)
                    outcome_dist[key] = outcome_dist.get(key, 0.0) + joint * binom

            else:
                res = {"aSuccess": 0, "aCrit": False, "bSuccess": 0, "bCrit": False}
                key = json.dumps(res, sort_keys=True)
                outcome_dist[key] = outcome_dist.get(key, 0.0) + joint

    return outcome_dist


def _convolve(d1: dict[int, float], d2: dict[int, float]) -> dict[int, float]:
    result: dict[int, float] = {}
    for v1, p1 in d1.items():
        for v2, p2 in d2.items():
            v = v1 + v2
            result[v] = result.get(v, 0.0) + p1 * p2
    return result


def _get_single_save_dist(
    threshold: int, damage: int, is_cont: bool
) -> dict[int, float]:
    p_save = max(0.0, min(1.0, threshold / 20.0))
    p_fail = 1.0 - p_save
    dist: dict[int, float] = {}

    if not is_cont:
        dist[0] = p_save
        if p_fail > 0:
            dist[damage] = p_fail
    else:
        remaining = 1.0
        wounds = 0
        for _ in range(10):
            stop = remaining * p_save
            if stop > 0:
                dist[wounds] = dist.get(wounds, 0.0) + stop
            remaining *= p_fail
            wounds += damage
            if remaining < 1e-6:
                break

    return dist


def _get_total_wounds_dist(
    saves: int, threshold: int, damage: int, cont: bool
) -> dict[int, float]:
    if saves <= 0:
        return {0: 1.0}
    single = _get_single_save_dist(threshold, damage, cont)
    result = single
    for _ in range(1, saves):
        result = _convolve(result, single)
    return result


def _calculate_expected_wounds(
    f2f_dist: dict[str, float],
    a_damage: int,
    b_arm: int,
    a_ammo: str,
    b_damage: int,
    a_arm: int,
    b_ammo: str,
    a_cont: bool,
    b_bts: int,
    b_crit_immune: bool,
    b_cont: bool,
    a_bts: int,
    a_crit_immune: bool,
) -> tuple[dict[int, float], dict[int, float]]:
    import json

    active: dict[int, float] = {0: 0.0}
    reactive: dict[int, float] = {0: 0.0}

    for outcome_key, prob in f2f_dist.items():
        ev = json.loads(outcome_key)

        if ev["aSuccess"] > ev["bSuccess"]:
            ammo_mult = {"DA": 2, "EXP": 3}.get(a_ammo, 1)
            damage = 2 if a_ammo == "T2" else a_damage
            saves = ev["aSuccess"] * ammo_mult
            if ev["aCrit"] and not b_crit_immune:
                saves += 1
            dist = _get_total_wounds_dist(saves, a_damage + b_arm, damage, a_cont)
            if a_ammo == "PLASMA":
                plasma_dist = _get_total_wounds_dist(saves, a_damage + b_bts, 1, False)
                dist = _convolve(dist, plasma_dist)
            for w, p in dist.items():
                active[w] = active.get(w, 0.0) + p * prob

        elif ev["bSuccess"] > ev["aSuccess"]:
            ammo_mult = {"DA": 2, "EXP": 3}.get(b_ammo, 1)
            damage = 2 if b_ammo == "T2" else b_damage
            saves = ev["bSuccess"] * ammo_mult
            if ev["bCrit"] and not a_crit_immune:
                saves += 1
            dist = _get_total_wounds_dist(saves, b_damage + a_arm, damage, b_cont)
            if b_ammo == "PLASMA":
                plasma_dist = _get_total_wounds_dist(saves, b_damage + a_bts, 1, False)
                dist = _convolve(dist, plasma_dist)
            for w, p in dist.items():
                reactive[w] = reactive.get(w, 0.0) + p * prob

    return active, reactive


def calculate_f2f(active: CombatantInput, reactive: CombatantInput) -> F2FResult:
    die_a = create_infinity_die(active.sv)
    die_b = create_infinity_die(reactive.sv)
    f2f_dist = solve_f2f(active.burst, reactive.burst, die_a, die_b)

    wounds_active, wounds_reactive = _calculate_expected_wounds(
        f2f_dist,
        active.damage,
        reactive.arm,
        active.ammo,
        reactive.damage,
        active.arm,
        reactive.ammo,
        active.cont,
        reactive.bts,
        reactive.crit_immune,
        reactive.cont,
        active.bts,
        active.crit_immune,
    )

    import json

    active_wins = reactive_wins = draw = 0.0
    for key, prob in f2f_dist.items():
        ev = json.loads(key)
        if ev["aSuccess"] > ev["bSuccess"]:
            active_wins += prob
        elif ev["bSuccess"] > ev["aSuccess"]:
            reactive_wins += prob
        else:
            draw += prob

    def expected(dist: dict[int, float]) -> float:
        return sum(w * p for w, p in dist.items())

    def round_dist(dist: dict[int, float]) -> dict[int, float]:
        return {w: round(p * 10000) / 100 for w, p in dist.items() if p > 0.001}

    return F2FResult(
        active_wins=round(active_wins * 10000) / 100,
        reactive_wins=round(reactive_wins * 10000) / 100,
        draw=round(draw * 10000) / 100,
        expected_active_wounds=round(expected(wounds_active) * 100) / 100,
        expected_reactive_wounds=round(expected(wounds_reactive) * 100) / 100,
        wound_dist_active=round_dist(wounds_active),
        wound_dist_reactive=round_dist(wounds_reactive),
    )

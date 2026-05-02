import { describe, it, expect } from 'vitest';
import { ToolExecutor } from '../src/agent/tools/executor.js';
import { GameDataLoader } from '../src/agent/gameData/loader.js';

describe('ToolExecutor.analyze_matchup', () => {
    it('uses shared/dice-engine for F2F math (BS13 B3 vs BS11 B1)', async () => {
        const exec = new ToolExecutor(GameDataLoader.getInstance());
        const result = await exec.execute('analyze_matchup', {
            active_sv: 13, active_burst: 3, active_damage: 13, active_arm: 3,
            reactive_sv: 11, reactive_burst: 1, reactive_damage: 13,
            target_arm: 3,
        });
        const parsed = JSON.parse(result) as { active_wins_pct: number };
        expect(parsed.active_wins_pct).toBeGreaterThan(70);
        expect(parsed.active_wins_pct).toBeLessThan(85);
    });
});

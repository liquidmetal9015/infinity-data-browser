import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

export class RateLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RateLimitError';
    }
}

function currentYearMonth(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
}

export async function checkAndIncrementUsage(userId: string, monthlyLimit: number): Promise<number> {
    const yearMonth = currentYearMonth();
    const result = await db.execute<{ message_count: number }>(sql`
        INSERT INTO ai_usage (user_id, year_month, message_count)
        VALUES (${userId}, ${yearMonth}, 1)
        ON CONFLICT (user_id, year_month)
        DO UPDATE SET message_count = ai_usage.message_count + 1, last_used = NOW()
        RETURNING message_count
    `);
    const row = result.rows[0];
    const count = row?.message_count ?? 0;
    if (count > monthlyLimit) {
        throw new RateLimitError(
            `Monthly AI message limit reached (${monthlyLimit} messages). Limit resets at the start of next month.`,
        );
    }
    return count;
}

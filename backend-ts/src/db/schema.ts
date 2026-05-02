import { pgTable, varchar, uniqueIndex, index, serial, integer, jsonb, foreignKey, unique, doublePrecision, timestamp, text } from "drizzle-orm/pg-core"

// Schema holds only user-owned data. Game catalog (units, factions, weapons, etc.)
// lives in static JSON under data/processed/ and is read by the SPA, the agent's
// GameDataLoader, and the MCP server's DatabaseAdapter.

export const users = pgTable("users", {
    id: varchar().primaryKey().notNull(),
    email: varchar().notNull(),
    created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex("ix_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const army_lists = pgTable("army_lists", {
    id: serial().primaryKey().notNull(),
    user_id: varchar().notNull(),
    faction_id: integer().notNull(),
    name: varchar().notNull(),
    points: integer().notNull(),
    swc: doublePrecision().notNull(),
    units_json: jsonb().notNull(),
    created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
    description: text(),
    tags: varchar().array().default([]).notNull(),
    rating: integer().default(0).notNull(),
}, (table) => [
    foreignKey({
        columns: [table.user_id],
        foreignColumns: [users.id],
        name: "army_lists_user_id_fkey",
    }),
]);

export const ai_usage = pgTable("ai_usage", {
    id: serial().primaryKey().notNull(),
    user_id: varchar().notNull(),
    year_month: varchar({ length: 7 }).notNull(),
    message_count: integer().default(0).notNull(),
    last_used: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
    index("ix_ai_usage_user_id").using("btree", table.user_id.asc().nullsLast().op("text_ops")),
    foreignKey({
        columns: [table.user_id],
        foreignColumns: [users.id],
        name: "ai_usage_user_id_fkey",
    }).onDelete("cascade"),
    unique("uq_ai_usage_user_month").on(table.user_id, table.year_month),
]);

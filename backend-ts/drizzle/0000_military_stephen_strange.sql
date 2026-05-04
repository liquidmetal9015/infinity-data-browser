-- Creates the full schema for fresh databases.
-- On existing Alembic-managed databases this is a no-op because Drizzle will
-- see the migration as already applied in __drizzle_migrations.
CREATE TABLE IF NOT EXISTS "users" (
    "id" varchar PRIMARY KEY NOT NULL,
    "email" varchar NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ix_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "army_lists" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" varchar NOT NULL,
    "faction_id" integer NOT NULL,
    "name" varchar NOT NULL,
    "points" integer NOT NULL,
    "swc" double precision NOT NULL,
    "units_json" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "description" text,
    "tags" varchar[] DEFAULT '{}' NOT NULL,
    "rating" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "army_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" varchar NOT NULL,
    "year_month" varchar(7) NOT NULL,
    "message_count" integer DEFAULT 0 NOT NULL,
    "last_used" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "uq_ai_usage_user_month" UNIQUE ("user_id", "year_month")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_ai_usage_user_id" ON "ai_usage" USING btree ("user_id");

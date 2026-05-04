ALTER TABLE "ammunitions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "equipment" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "factions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fireteam_charts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loadouts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "skills" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "unit_factions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "units" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "weapons" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ammunitions" CASCADE;--> statement-breakpoint
DROP TABLE "equipment" CASCADE;--> statement-breakpoint
DROP TABLE "factions" CASCADE;--> statement-breakpoint
DROP TABLE "fireteam_charts" CASCADE;--> statement-breakpoint
DROP TABLE "loadouts" CASCADE;--> statement-breakpoint
DROP TABLE "profiles" CASCADE;--> statement-breakpoint
DROP TABLE "skills" CASCADE;--> statement-breakpoint
DROP TABLE "unit_factions" CASCADE;--> statement-breakpoint
DROP TABLE "units" CASCADE;--> statement-breakpoint
DROP TABLE "weapons" CASCADE;--> statement-breakpoint
ALTER TABLE "army_lists" DROP CONSTRAINT IF EXISTS "army_lists_faction_id_fkey";

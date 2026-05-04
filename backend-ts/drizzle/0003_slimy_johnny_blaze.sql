-- Removes old Alembic-managed game data tables (ammunitions, equipment, etc.).
-- On fresh databases these tables never exist, so everything is guarded.
DO $$
DECLARE
    t text;
    game_tables text[] := ARRAY[
        'ammunitions', 'equipment', 'factions', 'fireteam_charts',
        'loadouts', 'profiles', 'skills', 'unit_factions', 'units', 'weapons'
    ];
BEGIN
    FOREACH t IN ARRAY game_tables LOOP
        IF EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
            EXECUTE format('DROP TABLE %I CASCADE', t);
        END IF;
    END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "army_lists" DROP CONSTRAINT IF EXISTS "army_lists_faction_id_fkey";

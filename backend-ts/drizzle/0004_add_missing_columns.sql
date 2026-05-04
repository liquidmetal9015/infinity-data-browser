ALTER TABLE "army_lists" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "army_lists" ADD COLUMN IF NOT EXISTS "tags" varchar[] DEFAULT '{}' NOT NULL;

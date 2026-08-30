CREATE TABLE `index_cards` (
	`section_id` text PRIMARY KEY NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`title_fa` text DEFAULT '' NOT NULL,
	`caption_en` text DEFAULT '' NOT NULL,
	`caption_fa` text DEFAULT '' NOT NULL,
	`cover_image` text,
	`cover_alt_en` text,
	`cover_alt_fa` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

--> statement-breakpoint
-- THE FIVE ROWS, SEEDED HERE (prompt 13).
--
-- Hand-written below the generated CREATE TABLE, deliberately. `section_id` is one of the
-- five ids in `common/constants/site.ts`'s NAV and the set never grows, so the rows are a
-- property of the schema rather than content somebody authored — there is nothing for a
-- seed script to read them from and no second source they could drift against.
--
-- Every column takes its DEFAULT, so a freshly migrated database has five EMPTY cards and
-- the five columns keep rendering `nav.<id>` / `cap.<id>` from the message catalog exactly
-- as they did before this table existed. `INSERT OR IGNORE` so re-running against a
-- database that already has them is a no-op rather than a constraint error, which is the
-- same idempotence `scripts/seed-taxonomy.ts` gets from its upsert.
--
-- A MISSING ROW IS STILL NOT AN ERROR. `index-card-service.ts` synthesises an empty card
-- for any section it does not find, so this seed is a convenience for the editor — who
-- otherwise meets an empty form with no row behind it — and never a requirement.
INSERT OR IGNORE INTO `index_cards` (`section_id`) VALUES ('projects');--> statement-breakpoint
INSERT OR IGNORE INTO `index_cards` (`section_id`) VALUES ('design');--> statement-breakpoint
INSERT OR IGNORE INTO `index_cards` (`section_id`) VALUES ('media');--> statement-breakpoint
INSERT OR IGNORE INTO `index_cards` (`section_id`) VALUES ('studio');--> statement-breakpoint
INSERT OR IGNORE INTO `index_cards` (`section_id`) VALUES ('contact');

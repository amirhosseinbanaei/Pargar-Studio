CREATE TABLE `taxonomy_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject` text NOT NULL,
	`axis` text NOT NULL,
	`value` text NOT NULL,
	`label_en` text NOT NULL,
	`label_fa` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_terms_identity_unique` ON `taxonomy_terms` (`subject`,`axis`,`value`);
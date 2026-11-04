ALTER TABLE `playlists` ADD `source` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `playlists` ADD `source_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `unavailable` integer DEFAULT false NOT NULL;
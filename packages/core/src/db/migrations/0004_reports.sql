CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`playlist_name` text DEFAULT '' NOT NULL,
	`reason` text NOT NULL,
	`video_count` integer DEFAULT 0 NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reports_playlist` ON `reports` (`playlist_id`,`created_at`);
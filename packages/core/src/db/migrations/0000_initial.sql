CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`dirty` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_playlists_dirty` ON `playlists` (`dirty`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`youtube_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`thumbnail_url` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`watched` integer DEFAULT false NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`dirty` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_videos_playlist` ON `videos` (`playlist_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_videos_dirty` ON `videos` (`dirty`);
CREATE TABLE `under_attack_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Under Attack Toggle Rule' NOT NULL,
	`zone_config_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rate_limit_threshold` integer DEFAULT 10000 NOT NULL,
	`auto_off` integer DEFAULT false NOT NULL,
	`off_threshold` integer,
	`window_seconds` integer DEFAULT 300 NOT NULL,
	`recovery_level` text DEFAULT 'medium' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`zone_config_id`) REFERENCES `zone_configs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);

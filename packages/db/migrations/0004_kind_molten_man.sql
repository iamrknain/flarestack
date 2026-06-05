CREATE TABLE `vercel_bot_protection_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Vercel Bot Protection Rule' NOT NULL,
	`vercel_project_ref` text NOT NULL,
	`user_id` text NOT NULL,
	`rate_limit_threshold` integer DEFAULT 10000 NOT NULL,
	`auto_off` integer DEFAULT false NOT NULL,
	`off_threshold` integer,
	`window_seconds` integer DEFAULT 300 NOT NULL,
	`action` text DEFAULT 'challenge' NOT NULL,
	`send_notification` integer DEFAULT false NOT NULL,
	`notify_emails` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`vercel_project_ref`) REFERENCES `vercel_projects` (`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `vercel_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`vercel_project_id` text NOT NULL,
	`vercel_team_id` text,
	`vercel_token` text NOT NULL,
	`domain` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `vercel_traffic_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`minute` integer NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

--> statement-breakpoint
CREATE TABLE `vercel_under_attack_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Vercel Under Attack Rule' NOT NULL,
	`vercel_project_ref` text NOT NULL,
	`user_id` text NOT NULL,
	`rate_limit_threshold` integer DEFAULT 10000 NOT NULL,
	`auto_off` integer DEFAULT false NOT NULL,
	`off_threshold` integer,
	`window_seconds` integer DEFAULT 300 NOT NULL,
	`send_notification` integer DEFAULT false NOT NULL,
	`notify_emails` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`vercel_project_ref`) REFERENCES `vercel_projects` (`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
PRAGMA foreign_keys = OFF;

--> statement-breakpoint
CREATE TABLE `__new_action_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`zone_config_id` text,
	`vercel_project_ref` text,
	`rule_id` text NOT NULL,
	`action_taken` text NOT NULL,
	`target_type` text DEFAULT 'IP' NOT NULL,
	`target_value` text NOT NULL,
	`request_count` integer,
	`metadata` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`zone_config_id`) REFERENCES `zone_configs` (`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vercel_project_ref`) REFERENCES `vercel_projects` (`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
INSERT INTO
	`__new_action_logs` (
		"id",
		"user_id",
		"zone_config_id",
		"vercel_project_ref",
		"rule_id",
		"action_taken",
		"target_type",
		"target_value",
		"request_count",
		"metadata",
		"timestamp"
	)
SELECT
	"id",
	"user_id",
	"zone_config_id",
	NULL,
	"rule_id",
	"action_taken",
	"target_type",
	"target_value",
	"request_count",
	"metadata",
	"timestamp"
FROM
	`action_logs`;

--> statement-breakpoint
DROP TABLE `action_logs`;

--> statement-breakpoint
ALTER TABLE `__new_action_logs`
RENAME TO `action_logs`;

--> statement-breakpoint
PRAGMA foreign_keys = ON;
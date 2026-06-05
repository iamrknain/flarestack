CREATE TABLE `vercel_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`vercel_token` text NOT NULL,
	`vercel_team_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `vercel_projects` ADD `vercel_account_ref` text NOT NULL REFERENCES vercel_accounts(id);--> statement-breakpoint
ALTER TABLE `vercel_projects` DROP COLUMN `vercel_team_id`;--> statement-breakpoint
ALTER TABLE `vercel_projects` DROP COLUMN `vercel_token`;
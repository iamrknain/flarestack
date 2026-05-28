ALTER TABLE `under_attack_rules` ADD `send_notification` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `under_attack_rules` ADD `notify_emails` text;
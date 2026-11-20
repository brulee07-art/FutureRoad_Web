CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`team_id` integer NOT NULL,
	`round` integer NOT NULL,
	`status` text NOT NULL,
	`raw_cs` integer,
	`flags` text NOT NULL,
	`revision` integer NOT NULL,
	`request_id` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attempt_history` (
	`request_id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`failures` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `judge_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`pin_hash` text,
	`salt` text,
	`updated_at` integer NOT NULL
);

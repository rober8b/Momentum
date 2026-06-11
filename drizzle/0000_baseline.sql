CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"subject_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"status" text DEFAULT 'todo' NOT NULL,
	"resources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" text DEFAULT 'project' NOT NULL,
	"title" text NOT NULL,
	"draft" text,
	"hook" text,
	"platforms" text[] DEFAULT '{"x","linkedin"}' NOT NULL,
	"status" text DEFAULT 'idea' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"related_project" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freelance_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"icon" text,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"stack" text,
	"next_step" text,
	"last_update" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freelance_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"client_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"priority" text DEFAULT 'med' NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"success" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "own_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"icon" text,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_update" text,
	"next_step" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"semester" text NOT NULL,
	"schedule" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"vault_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"password_hash" text,
	"role" text DEFAULT 'member' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invalidate_sessions_before" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vault_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"exported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "workblocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" text DEFAULT 'task' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"priority" text DEFAULT 'med' NOT NULL,
	"due_date" date,
	"client" text DEFAULT '' NOT NULL,
	"notes" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_items" ADD CONSTRAINT "build_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_items" ADD CONSTRAINT "community_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_items" ADD CONSTRAINT "community_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelance_clients" ADD CONSTRAINT "freelance_clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelance_tasks" ADD CONSTRAINT "freelance_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelance_tasks" ADD CONSTRAINT "freelance_tasks_client_id_freelance_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."freelance_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "own_projects" ADD CONSTRAINT "own_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_exports" ADD CONSTRAINT "vault_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workblocks" ADD CONSTRAINT "workblocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_tokens_token_hash_idx" ON "api_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "assignments_user_status_idx" ON "assignments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "assignments_user_due_idx" ON "assignments" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "assignments_subject_idx" ON "assignments" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "build_items_user_status_idx" ON "build_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "build_items_user_published_idx" ON "build_items" USING btree ("user_id","published_at");--> statement-breakpoint
CREATE INDEX "community_items_user_status_idx" ON "community_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "freelance_clients_user_status_idx" ON "freelance_clients" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "freelance_tasks_user_status_idx" ON "freelance_tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "freelance_tasks_client_idx" ON "freelance_tasks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_account_idx" ON "oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "organizations_user_idx" ON "organizations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "own_projects_user_status_idx" ON "own_projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "prt_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prt_token_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workblocks_user_status_idx" ON "workblocks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "workblocks_user_position_idx" ON "workblocks" USING btree ("user_id","status","position");
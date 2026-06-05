CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"status" text DEFAULT 'todo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "build_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"semester" text NOT NULL,
	"schedule" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"vault_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "workblocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text DEFAULT 'task' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"priority" text DEFAULT 'med' NOT NULL,
	"due_date" date,
	"client" text DEFAULT 'aleph' NOT NULL,
	"notes" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_subject_idx" ON "assignments" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "assignments_status_idx" ON "assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assignments_due_idx" ON "assignments" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "build_items_status_idx" ON "build_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "build_items_published_idx" ON "build_items" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "workblocks_status_idx" ON "workblocks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workblocks_priority_idx" ON "workblocks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "workblocks_position_idx" ON "workblocks" USING btree ("status","position");
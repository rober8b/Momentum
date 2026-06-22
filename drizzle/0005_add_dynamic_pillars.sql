CREATE TABLE "pillar_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pillar_id" uuid NOT NULL,
	"parent_item_id" uuid,
	"is_container" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"view_type" text DEFAULT 'list' NOT NULL,
	"status_workflow" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_template" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pillar_items" ADD CONSTRAINT "pillar_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pillar_items" ADD CONSTRAINT "pillar_items_pillar_id_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."pillars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pillar_items" ADD CONSTRAINT "pillar_items_parent_item_id_pillar_items_id_fk" FOREIGN KEY ("parent_item_id") REFERENCES "public"."pillar_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pillars" ADD CONSTRAINT "pillars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pillar_items_user_pillar_idx" ON "pillar_items" USING btree ("user_id","pillar_id");--> statement-breakpoint
CREATE INDEX "pillar_items_pillar_status_idx" ON "pillar_items" USING btree ("pillar_id","status");--> statement-breakpoint
CREATE INDEX "pillar_items_parent_idx" ON "pillar_items" USING btree ("parent_item_id");--> statement-breakpoint
CREATE INDEX "pillars_user_idx" ON "pillars" USING btree ("user_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "pillars_user_key_idx" ON "pillars" USING btree ("user_id","key");
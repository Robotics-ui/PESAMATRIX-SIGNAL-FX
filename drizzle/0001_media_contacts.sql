CREATE TABLE "media_files" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"filename" text NOT NULL,
"original_name" text NOT NULL,
"mime_type" text NOT NULL,
"size" integer NOT NULL,
"url" text NOT NULL,
"category" text NOT NULL,
"description" text,
"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"name" text NOT NULL,
"phone" text NOT NULL,
"whatsapp" text,
"label" text DEFAULT 'Support' NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp DEFAULT now() NOT NULL,
"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "contacts" ("name", "phone", "whatsapp", "label") VALUES
  ('PMatrix Support', '+254717434943', '+254717434943', 'Support'),
  ('PMatrix Support', '+254781585319', NULL, 'Support');

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "full_name" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "plan_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trading_days" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "total_amount" numeric(10, 2) NOT NULL DEFAULT '0.00';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_settings" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"fee_per_day" numeric(10, 2) DEFAULT '500.00' NOT NULL,
"min_days" integer DEFAULT 5 NOT NULL,
"max_days" integer DEFAULT 60 NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_accounts" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"provider_name" text NOT NULL,
"mt5_login" text NOT NULL,
"broker_name" text NOT NULL,
"server_name" text NOT NULL,
"strategy_description" text,
"risk_level" text DEFAULT 'medium' NOT NULL,
"win_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
"total_trades" integer DEFAULT 0 NOT NULL,
"monthly_return" numeric(8, 2) DEFAULT '0.00' NOT NULL,
"max_drawdown" numeric(5, 2) DEFAULT '0.00' NOT NULL,
"status" text DEFAULT 'active' NOT NULL,
"created_at" timestamp DEFAULT now() NOT NULL,
"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_provider_subscriptions" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"master_account_id" uuid NOT NULL,
"started_at" timestamp DEFAULT now() NOT NULL,
"is_active" boolean DEFAULT true NOT NULL,
"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_provider_subscriptions" ADD CONSTRAINT "user_provider_subscriptions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_provider_subscriptions" ADD CONSTRAINT "user_provider_subscriptions_master_account_id_fk" FOREIGN KEY ("master_account_id") REFERENCES "public"."master_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
INSERT INTO "subscription_settings" ("fee_per_day", "min_days", "max_days", "is_active") VALUES ('500.00', 5, 60, true) ON CONFLICT DO NOTHING;

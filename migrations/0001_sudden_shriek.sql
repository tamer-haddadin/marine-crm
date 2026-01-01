CREATE TABLE "liability_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker_name" varchar(255) NOT NULL,
	"insured_name" varchar(255) NOT NULL,
	"product_type" varchar(100) NOT NULL,
	"business_type" varchar(50) NOT NULL,
	"premium" numeric(10, 2) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"order_date" date NOT NULL,
	"statuses" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "liability_quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker_name" varchar(255) NOT NULL,
	"insured_name" varchar(255) NOT NULL,
	"product_type" varchar(100) NOT NULL,
	"estimated_premium" numeric(10, 2) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"quotation_date" date NOT NULL,
	"status" varchar(50) NOT NULL,
	"decline_reason" text,
	"notes" text,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "liability_orders" ADD CONSTRAINT "liability_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liability_quotations" ADD CONSTRAINT "liability_quotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
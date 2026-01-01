-- Add department column to users table
ALTER TABLE "users" ADD COLUMN "department" text NOT NULL DEFAULT 'Marine';

-- Create Property & Engineering Orders table
CREATE TABLE "property_engineering_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker_name" text NOT NULL,
	"insured_name" text NOT NULL,
	"product_type" text NOT NULL,
	"cover_group" text NOT NULL,
	"business_type" text NOT NULL,
	"premium" numeric NOT NULL,
	"currency" text NOT NULL,
	"order_date" timestamp NOT NULL,
	"statuses" text[] NOT NULL,
	"notes" text,
	"requires_pre_condition_survey" boolean DEFAULT false NOT NULL,
	"created_by" serial NOT NULL,
	"last_updated" timestamp NOT NULL
);

-- Create Property & Engineering Quotations table
CREATE TABLE "property_engineering_quotations" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker_name" text NOT NULL,
	"insured_name" text NOT NULL,
	"product_type" text NOT NULL,
	"cover_group" text NOT NULL,
	"estimated_premium" numeric NOT NULL,
	"currency" text NOT NULL,
	"quotation_date" timestamp NOT NULL,
	"status" text NOT NULL,
	"decline_reason" text,
	"notes" text,
	"requires_pre_condition_survey" boolean DEFAULT false NOT NULL,
	"created_by" serial NOT NULL,
	"last_updated" timestamp NOT NULL
);

-- Create Property & Engineering Status Logs table
CREATE TABLE "property_engineering_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" serial NOT NULL,
	"statuses" text[] NOT NULL,
	"timestamp" timestamp NOT NULL,
	"notes" text
);

-- Add foreign key constraints
ALTER TABLE "property_engineering_orders" ADD CONSTRAINT "property_engineering_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "property_engineering_quotations" ADD CONSTRAINT "property_engineering_quotations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "property_engineering_status_logs" ADD CONSTRAINT "property_engineering_status_logs_order_id_property_engineering_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."property_engineering_orders"("id") ON DELETE no action ON UPDATE no action; 
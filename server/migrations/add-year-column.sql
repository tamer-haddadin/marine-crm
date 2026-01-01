-- Migration: Add year column to all data tables and create app_settings table
-- This migration preserves existing 2025 data and adds support for year-based filtering

-- Create app_settings table for storing application-wide configuration
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default active year as 2025
INSERT INTO app_settings (key, value) VALUES ('active_year', '2025')
ON CONFLICT (key) DO NOTHING;

-- Add year column to orders table (Marine)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS year SMALLINT DEFAULT 2025 NOT NULL;

-- Add year column to quotations table (Marine)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS year SMALLINT DEFAULT 2025 NOT NULL;

-- Add year column to property_engineering_orders table
ALTER TABLE property_engineering_orders ADD COLUMN IF NOT EXISTS year SMALLINT DEFAULT 2025 NOT NULL;

-- Add year column to property_engineering_quotations table
ALTER TABLE property_engineering_quotations ADD COLUMN IF NOT EXISTS year SMALLINT DEFAULT 2025 NOT NULL;

-- Add year column to liability_orders table
ALTER TABLE liability_orders ADD COLUMN IF NOT EXISTS year SMALLINT DEFAULT 2025 NOT NULL;

-- Add year column to liability_quotations table
ALTER TABLE liability_quotations ADD COLUMN IF NOT EXISTS year SMALLINT DEFAULT 2025 NOT NULL;

-- Create indexes for year column to optimize year-based queries
CREATE INDEX IF NOT EXISTS idx_orders_year ON orders(year);
CREATE INDEX IF NOT EXISTS idx_quotations_year ON quotations(year);
CREATE INDEX IF NOT EXISTS idx_property_engineering_orders_year ON property_engineering_orders(year);
CREATE INDEX IF NOT EXISTS idx_property_engineering_quotations_year ON property_engineering_quotations(year);
CREATE INDEX IF NOT EXISTS idx_liability_orders_year ON liability_orders(year);
CREATE INDEX IF NOT EXISTS idx_liability_quotations_year ON liability_quotations(year);

-- All existing data will automatically have year = 2025 due to DEFAULT





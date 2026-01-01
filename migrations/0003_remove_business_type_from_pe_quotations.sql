-- Remove businessType column from property_engineering_quotations table
ALTER TABLE property_engineering_quotations DROP COLUMN IF EXISTS business_type; 
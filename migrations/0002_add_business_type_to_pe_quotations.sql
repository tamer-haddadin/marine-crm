-- Add businessType column to property_engineering_quotations table
ALTER TABLE property_engineering_quotations
ADD COLUMN business_type text NOT NULL DEFAULT 'New Business';
 
-- Remove the default after adding the column
ALTER TABLE property_engineering_quotations
ALTER COLUMN business_type DROP DEFAULT; 
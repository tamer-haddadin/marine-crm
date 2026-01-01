-- Add Liability & Financial quotations table
CREATE TABLE IF NOT EXISTS liability_quotations (
  id SERIAL PRIMARY KEY,
  broker_name VARCHAR(255) NOT NULL,
  insured_name VARCHAR(255) NOT NULL,
  product_type VARCHAR(100) NOT NULL,
  estimated_premium DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  quotation_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  decline_reason TEXT,
  notes TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add Liability & Financial orders table
CREATE TABLE IF NOT EXISTS liability_orders (
  id SERIAL PRIMARY KEY,
  broker_name VARCHAR(255) NOT NULL,
  insured_name VARCHAR(255) NOT NULL,
  product_type VARCHAR(100) NOT NULL,
  business_type VARCHAR(50) NOT NULL,
  premium DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  order_date DATE NOT NULL,
  statuses TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX idx_liability_quotations_user_id ON liability_quotations(user_id);
CREATE INDEX idx_liability_quotations_status ON liability_quotations(status);
CREATE INDEX idx_liability_quotations_date ON liability_quotations(quotation_date);

CREATE INDEX idx_liability_orders_user_id ON liability_orders(user_id);
CREATE INDEX idx_liability_orders_date ON liability_orders(order_date); 
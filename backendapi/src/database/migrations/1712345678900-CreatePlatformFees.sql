-- Migration: Create Platform Fees tables and seed defaults
-- Run this manually for production deployments.
-- In development, TypeORM synchronize:true handles table creation.
-- Only seed data needs to be inserted.

-- Create platform_fee_configs table
CREATE TABLE IF NOT EXISTS platform_fee_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key varchar NOT NULL,
  config_value jsonb,
  is_active boolean DEFAULT true,
  description varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create provider_subscription_plans table
CREATE TABLE IF NOT EXISTS provider_subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  description varchar,
  monthly_price decimal(10,2) NOT NULL,
  benefits jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create provider_subscriptions table
CREATE TABLE IF NOT EXISTS provider_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES providers(id),
  plan_id uuid REFERENCES provider_subscription_plans(id),
  status varchar DEFAULT 'active',
  start_date timestamp NOT NULL,
  end_date timestamp,
  cancelled_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar UNIQUE NOT NULL,
  type varchar NOT NULL,
  value decimal(10,2) NOT NULL,
  max_uses integer,
  current_uses integer DEFAULT 0,
  valid_from timestamp,
  valid_until timestamp,
  is_active boolean DEFAULT true,
  restrictions jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create promo_code_usages table
CREATE TABLE IF NOT EXISTS promo_code_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid REFERENCES promo_codes(id),
  user_id uuid REFERENCES users(id),
  booking_id uuid REFERENCES bookings(id),
  discount_amount decimal(10,2) NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Add convenience_fee column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS convenience_fee decimal(10,2) DEFAULT 0;

-- Create customer_membership_plans table
CREATE TABLE IF NOT EXISTS customer_membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  description varchar,
  monthly_price decimal(10,2) NOT NULL,
  yearly_price decimal(10,2) DEFAULT 0,
  benefits jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create customer_memberships table
CREATE TABLE IF NOT EXISTS customer_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id),
  plan_id uuid REFERENCES customer_membership_plans(id),
  status varchar DEFAULT 'active',
  billing_cycle varchar DEFAULT 'monthly',
  start_date timestamp NOT NULL,
  end_date timestamp,
  cancelled_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Seed default fee configs
INSERT INTO platform_fee_configs (id, config_key, config_value, is_active, description) VALUES
  (gen_random_uuid(), 'convenience_fee', '{"type": "percentage", "value": 5, "minAmount": 10, "maxAmount": 200}', true, 'Convenience fee charged to customers per booking'),
  (gen_random_uuid(), 'feature_convenience_fee', '{"enabled": true}', true, 'Toggle convenience fee on/off globally'),
  (gen_random_uuid(), 'feature_provider_subscriptions', '{"enabled": true}', true, 'Toggle provider subscriptions on/off'),
  (gen_random_uuid(), 'feature_promo_codes', '{"enabled": true}', true, 'Toggle promo codes on/off'),
  (gen_random_uuid(), 'instant_payout_fee', '{"type": "percentage", "value": 2.5, "minAmount": 5, "maxAmount": 500}', true, 'Fee charged for instant payout requests'),
  (gen_random_uuid(), 'feature_instant_payout', '{"enabled": true}', true, 'Toggle instant payout on/off globally'),
  (gen_random_uuid(), 'lead_quote_fee', '{"type": "fixed", "value": 10, "minAmount": 0, "maxAmount": 0}', true, 'Fee charged to providers for submitting quotes'),
  (gen_random_uuid(), 'feature_lead_quote_fee', '{"enabled": true}', true, 'Toggle lead/quote fee on/off globally'),
  (gen_random_uuid(), 'feature_customer_memberships', '{"enabled": true}', true, 'Toggle customer membership plans on/off globally')
ON CONFLICT DO NOTHING;

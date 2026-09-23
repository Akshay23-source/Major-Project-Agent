-- 010_logistics_upgrade.sql

-- 1. Add role to agents (Tenant root)
ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'ADMIN';

-- 2. Delivery Partners
CREATE TABLE IF NOT EXISTS public.delivery_partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_type TEXT,
    vehicle_number TEXT,
    license_number TEXT,
    status TEXT DEFAULT 'OFFLINE', -- ONLINE, OFFLINE, AVAILABLE, BUSY, ON_DELIVERY, INACTIVE
    rating NUMERIC DEFAULT 5.0,
    completed_deliveries INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE,
    city TEXT,
    state TEXT,
    pincode TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage their delivery partners" ON public.delivery_partners FOR ALL 
USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- 3. Driver Locations (For real-time and historical tracking)
CREATE TABLE IF NOT EXISTS public.driver_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_partner_id UUID NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    accuracy NUMERIC,
    speed NUMERIC,
    heading NUMERIC,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and Realtime for driver locations
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can view their driver locations" ON public.driver_locations FOR SELECT 
USING (
  delivery_partner_id IN (
    SELECT id FROM public.delivery_partners WHERE agent_id IN (
      SELECT id FROM public.agents WHERE auth_user_id = auth.uid()
    )
  )
);
-- Note: A policy for drivers to insert locations would be needed later when they get their own auth

-- Add realtime capability for tracking
alter publication supabase_realtime add table public.driver_locations;
alter publication supabase_realtime add table public.deliveries;
alter publication supabase_realtime add table public.delivery_partners;

-- 4. Delivery Events (Audit log for delivery lifecycle)
CREATE TABLE IF NOT EXISTS public.delivery_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- e.g., 'ASSIGNED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'DELAYED'
    description TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can view delivery events" ON public.delivery_events FOR SELECT 
USING (
  delivery_id IN (
    SELECT id FROM public.deliveries WHERE order_id IN (
      SELECT id FROM public.orders WHERE agent_id IN (
        SELECT id FROM public.agents WHERE auth_user_id = auth.uid()
      )
    )
  )
);
CREATE POLICY "Agents can insert delivery events" ON public.delivery_events FOR INSERT 
WITH CHECK (
  agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid())
);

-- 5. Update orders and deliveries schema
-- Since status is already TEXT in 000_initial_schema.sql, no strict enum migration is required,
-- but we should add delivery_partner_id to the deliveries table to link assignments.
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS delivery_partner_id UUID REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pickup_location TEXT,
ADD COLUMN IF NOT EXISTS drop_location TEXT,
ADD COLUMN IF NOT EXISTS distance NUMERIC,
ADD COLUMN IF NOT EXISTS estimated_time NUMERIC; -- in minutes

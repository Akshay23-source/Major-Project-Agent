-- 011_logistics_v2.sql

-- 1. Modify Orders for Integration Stability and Logistics State
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS external_order_id TEXT,
ADD COLUMN IF NOT EXISTS external_customer_id TEXT,
ADD COLUMN IF NOT EXISTS external_farmer_id TEXT,
ADD COLUMN IF NOT EXISTS external_product_id TEXT,
ADD COLUMN IF NOT EXISTS logistics_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';

-- 2. Create Vehicles Table
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    vehicle_number TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    capacity NUMERIC,
    capacity_unit TEXT,
    availability_status TEXT DEFAULT 'AVAILABLE',
    current_location_lat NUMERIC,
    current_location_lng NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage vehicles" ON public.vehicles FOR ALL 
USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- 3. Modify Deliveries Table
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS logistics_tracking_status TEXT DEFAULT 'PENDING';

-- 4. Create Pickups Table
CREATE TABLE IF NOT EXISTS public.pickups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    delivery_partner_id UUID REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, ASSIGNED, DRIVER_EN_ROUTE, ARRIVED, PICKED_UP, FAILED
    expected_time TIMESTAMP WITH TIME ZONE,
    actual_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pickups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage pickups" ON public.pickups FOR ALL 
USING (
  order_id IN (
    SELECT id FROM public.orders WHERE agent_id IN (
      SELECT id FROM public.agents WHERE auth_user_id = auth.uid()
    )
  )
);

-- Enable Realtime for Pickups and Vehicles
alter publication supabase_realtime add table public.pickups;
alter publication supabase_realtime add table public.vehicles;

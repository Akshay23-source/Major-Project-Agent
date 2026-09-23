-- 1. Orders and Deliveries Schema Updates
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'ADMIN';

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS external_order_id TEXT,
ADD COLUMN IF NOT EXISTS external_customer_id TEXT,
ADD COLUMN IF NOT EXISTS external_farmer_id TEXT,
ADD COLUMN IF NOT EXISTS external_product_id TEXT,
ADD COLUMN IF NOT EXISTS logistics_status TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';

ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS delivery_partner_id UUID,
ADD COLUMN IF NOT EXISTS pickup_location TEXT,
ADD COLUMN IF NOT EXISTS drop_location TEXT,
ADD COLUMN IF NOT EXISTS distance NUMERIC,
ADD COLUMN IF NOT EXISTS estimated_time NUMERIC,
ADD COLUMN IF NOT EXISTS vehicle_id UUID,
ADD COLUMN IF NOT EXISTS logistics_tracking_status TEXT DEFAULT 'PENDING';

-- 2. Delivery Partners
CREATE TABLE IF NOT EXISTS public.delivery_partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_type TEXT,
    vehicle_number TEXT,
    license_number TEXT,
    status TEXT DEFAULT 'OFFLINE',
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
DROP POLICY IF EXISTS "Agents can manage their delivery partners" ON public.delivery_partners;
CREATE POLICY "Agents can manage their delivery partners" ON public.delivery_partners FOR ALL USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- 3. Driver Locations
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
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can view their driver locations" ON public.driver_locations;
CREATE POLICY "Agents can view their driver locations" ON public.driver_locations FOR SELECT USING (
  delivery_partner_id IN (SELECT id FROM public.delivery_partners WHERE agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()))
);

-- 4. Vehicles
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
DROP POLICY IF EXISTS "Agents can manage vehicles" ON public.vehicles;
CREATE POLICY "Agents can manage vehicles" ON public.vehicles FOR ALL USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- 5. Pickups
CREATE TABLE IF NOT EXISTS public.pickups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    delivery_partner_id UUID REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'PENDING',
    expected_time TIMESTAMP WITH TIME ZONE,
    actual_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.pickups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can manage pickups" ON public.pickups;
CREATE POLICY "Agents can manage pickups" ON public.pickups FOR ALL USING (
  order_id IN (SELECT id FROM public.orders WHERE agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()))
);

-- 6. Delivery Events
CREATE TABLE IF NOT EXISTS public.delivery_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    description TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents can view delivery events" ON public.delivery_events;
CREATE POLICY "Agents can view delivery events" ON public.delivery_events FOR SELECT USING (
  delivery_id IN (SELECT id FROM public.deliveries WHERE order_id IN (SELECT id FROM public.orders WHERE agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid())))
);
DROP POLICY IF EXISTS "Agents can insert delivery events" ON public.delivery_events;
CREATE POLICY "Agents can insert delivery events" ON public.delivery_events FOR INSERT WITH CHECK (
  agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid())
);

-- 7. Constraints (Safe Adds)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deliveries_delivery_partner_id_fkey') THEN
        ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deliveries_vehicle_id_fkey') THEN
        ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 8. Add Realtime (Ignore duplicates if already added)
BEGIN;
  -- Remove to avoid duplicates, then add
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.driver_locations, public.deliveries, public.delivery_partners, public.pickups, public.vehicles;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations, public.deliveries, public.delivery_partners, public.pickups, public.vehicles;
COMMIT;

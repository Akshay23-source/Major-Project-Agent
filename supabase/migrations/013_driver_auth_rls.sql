-- 013_driver_auth_rls.sql
-- Enables Driver Login and updates RLS for the Delivery Partner workflow

-- 1. Add auth_user_id to delivery_partners to link Supabase Auth
ALTER TABLE public.delivery_partners 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create the Account Linking RPC
-- This allows a newly authenticated driver (via OTP) to claim their delivery_partner profile
-- by matching their phone number. It is SECURITY DEFINER to bypass the initial read restrictions.
CREATE OR REPLACE FUNCTION public.link_driver_account(phone_number text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id uuid;
BEGIN
  -- Ensure the user is actually authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Find a matching delivery partner record that has no linked auth_user_id yet
  -- We clean the phone_number of '+' for safe matching, depending on how it's stored.
  SELECT id INTO v_partner_id
  FROM public.delivery_partners
  WHERE (phone = phone_number OR phone = replace(phone_number, '+91', '') OR phone = replace(phone_number, '+', ''))
    AND auth_user_id IS NULL
  LIMIT 1;

  -- If found, link them
  IF v_partner_id IS NOT NULL THEN
    UPDATE public.delivery_partners
    SET auth_user_id = auth.uid()
    WHERE id = v_partner_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 3. RLS Policy Updates for Drivers

-- A. Delivery Partners
DROP POLICY IF EXISTS "Drivers can view own profile" ON public.delivery_partners;
CREATE POLICY "Drivers can view own profile" 
ON public.delivery_partners 
FOR SELECT 
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Drivers can update own profile status" ON public.delivery_partners;
CREATE POLICY "Drivers can update own profile status" 
ON public.delivery_partners 
FOR UPDATE 
USING (auth_user_id = auth.uid());

-- B. Deliveries
DROP POLICY IF EXISTS "Drivers can view assigned deliveries" ON public.deliveries;
CREATE POLICY "Drivers can view assigned deliveries" 
ON public.deliveries 
FOR SELECT 
USING (delivery_partner_id IN (SELECT id FROM public.delivery_partners WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Drivers can update assigned deliveries" ON public.deliveries;
CREATE POLICY "Drivers can update assigned deliveries" 
ON public.deliveries 
FOR UPDATE 
USING (delivery_partner_id IN (SELECT id FROM public.delivery_partners WHERE auth_user_id = auth.uid()));

-- C. Driver Locations
DROP POLICY IF EXISTS "Drivers can insert their own locations" ON public.driver_locations;
CREATE POLICY "Drivers can insert their own locations" 
ON public.driver_locations 
FOR INSERT 
WITH CHECK (delivery_partner_id IN (SELECT id FROM public.delivery_partners WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Drivers can view their own locations" ON public.driver_locations;
CREATE POLICY "Drivers can view their own locations" 
ON public.driver_locations 
FOR SELECT 
USING (delivery_partner_id IN (SELECT id FROM public.delivery_partners WHERE auth_user_id = auth.uid()));

-- D. Pickups
DROP POLICY IF EXISTS "Drivers can view their assigned pickups" ON public.pickups;
CREATE POLICY "Drivers can view their assigned pickups" 
ON public.pickups 
FOR SELECT 
USING (delivery_partner_id IN (SELECT id FROM public.delivery_partners WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Drivers can update their assigned pickups" ON public.pickups;
CREATE POLICY "Drivers can update their assigned pickups" 
ON public.pickups 
FOR UPDATE 
USING (delivery_partner_id IN (SELECT id FROM public.delivery_partners WHERE auth_user_id = auth.uid()));

-- E. Delivery Events
DROP POLICY IF EXISTS "Drivers can insert delivery events" ON public.delivery_events;
CREATE POLICY "Drivers can insert delivery events" 
ON public.delivery_events 
FOR INSERT 
WITH CHECK (
  delivery_id IN (
    SELECT id FROM public.deliveries WHERE delivery_partner_id IN (
      SELECT id FROM public.delivery_partners WHERE auth_user_id = auth.uid()
    )
  )
);

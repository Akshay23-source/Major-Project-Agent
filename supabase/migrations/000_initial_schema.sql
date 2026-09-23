-- 000_initial_schema.sql
-- Base tables for AgriAgent application

-- 1. Agents (Tenant root)
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    agent_code TEXT,
    assigned_area TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can view their own profile" ON public.agents FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "Agents can insert their own profile" ON public.agents FOR INSERT WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "Agents can update their own profile" ON public.agents FOR UPDATE USING (auth_user_id = auth.uid());

-- 2. Farmers
CREATE TABLE IF NOT EXISTS public.farmers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    village TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT,
    main_crops TEXT,
    land_size TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage their farmers" ON public.farmers FOR ALL 
USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- 3. Buyers
CREATE TABLE IF NOT EXISTS public.buyers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    location TEXT,
    type TEXT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage their buyers" ON public.buyers FOR ALL 
USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- 4. Employees
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    employee_id TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    role TEXT,
    address TEXT,
    assigned_area TEXT,
    joining_date TEXT,
    emergency_contact TEXT,
    notes TEXT,
    status TEXT,
    rating NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage their employees" ON public.employees FOR ALL 
USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- 5. Orders (Base table without product_id, which is added in 001)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT NOT NULL,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
    product TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    price NUMERIC NOT NULL,
    subtotal NUMERIC,
    commission NUMERIC,
    delivery_charge NUMERIC,
    total_amount NUMERIC NOT NULL,
    delivery_location TEXT,
    notes TEXT,
    status TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage their orders" ON public.orders FOR ALL 
USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- 6. Deliveries
CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_number TEXT NOT NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    status TEXT,
    eta TEXT,
    pickup_time TIMESTAMPTZ,
    delivery_time TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage their deliveries" ON public.deliveries FOR ALL 
USING (order_id IN (SELECT id FROM public.orders WHERE agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid())));

-- 7. Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    payment_method TEXT,
    status TEXT,
    transaction_reference TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage their payments" ON public.payments FOR ALL 
USING (order_id IN (SELECT id FROM public.orders WHERE agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid())));

-- 8. Commissions
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    rate NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage their commissions" ON public.commissions FOR ALL 
USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

-- 9. Farmer Settlements
CREATE TABLE IF NOT EXISTS public.farmer_settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    gross_amount NUMERIC NOT NULL,
    commission_deducted NUMERIC NOT NULL,
    other_deductions NUMERIC NOT NULL,
    net_amount NUMERIC NOT NULL,
    status TEXT,
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    transaction_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.farmer_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can manage their farmer settlements" ON public.farmer_settlements FOR ALL 
USING (order_id IN (SELECT id FROM public.orders WHERE agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid())));

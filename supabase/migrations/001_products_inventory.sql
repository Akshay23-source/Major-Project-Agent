-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'kg',
    price NUMERIC NOT NULL DEFAULT 0,
    min_order_quantity NUMERIC NOT NULL DEFAULT 1,
    harvest_date DATE,
    best_before_date DATE,
    status TEXT NOT NULL DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Product policies
CREATE POLICY "Agents can view their own products"
    ON public.products FOR SELECT
    USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

CREATE POLICY "Agents can insert their own products"
    ON public.products FOR INSERT
    WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

CREATE POLICY "Agents can update their own products"
    ON public.products FOR UPDATE
    USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));

CREATE POLICY "Agents can delete their own products"
    ON public.products FOR DELETE
    USING (agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid()));


-- Create inventory_history table
CREATE TABLE IF NOT EXISTS public.inventory_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    quantity_change NUMERIC NOT NULL,
    previous_stock NUMERIC NOT NULL,
    new_stock NUMERIC NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for inventory_history
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;

-- Inventory policies (Viewable by the agent who owns the product)
CREATE POLICY "Agents can view their product inventory history"
    ON public.inventory_history FOR SELECT
    USING (
        product_id IN (
            SELECT id FROM public.products 
            WHERE agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "Agents can insert into their product inventory history"
    ON public.inventory_history FOR INSERT
    WITH CHECK (
        product_id IN (
            SELECT id FROM public.products 
            WHERE agent_id IN (SELECT id FROM public.agents WHERE auth_user_id = auth.uid())
        )
    );


-- Alter orders table to include product_id reference
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

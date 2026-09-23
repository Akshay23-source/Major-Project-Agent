-- verify_logistics_deployment.sql
-- This script safely audits the current schema without modifying it.
-- It returns results as tables so you can verify the deployment status.

-- 1. TABLE STATUS
SELECT 
    table_name, 
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
    ) as exists,
    (
        SELECT rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = t.table_name
    ) as rls_enabled
FROM (VALUES 
    ('orders'),
    ('deliveries'),
    ('delivery_partners'),
    ('driver_locations'),
    ('delivery_events'),
    ('vehicles'),
    ('pickups')
) AS t(table_name);


-- 2. COLUMN STATUS (Checking key logistics extensions)
SELECT 
    table_name, 
    column_name, 
    data_type,
    EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = c.table_name 
          AND column_name = c.column_name
    ) as exists
FROM (VALUES 
    ('orders', 'external_order_id', 'text'),
    ('orders', 'logistics_status', 'text'),
    ('deliveries', 'vehicle_id', 'uuid'),
    ('deliveries', 'delivery_partner_id', 'uuid'),
    ('delivery_partners', 'status', 'text'),
    ('vehicles', 'vehicle_type', 'text')
) AS c(table_name, column_name, data_type);


-- 3. RLS POLICY STATUS
SELECT 
    tablename, 
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
    'delivery_partners', 
    'driver_locations', 
    'delivery_events', 
    'vehicles', 
    'pickups'
);

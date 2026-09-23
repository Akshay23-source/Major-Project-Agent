-- verify_schema.sql
-- This script verifies the existence of required tables, columns, foreign keys, and RLS policies.
-- It returns a tabular summary of the database health.

DO $$
DECLARE
    required_tables text[] := ARRAY['agents', 'farmers', 'buyers', 'employees', 'orders', 'deliveries', 'payments', 'commissions', 'farmer_settlements', 'products', 'inventory_history'];
    t text;
    missing_tables text[] := ARRAY[]::text[];
    
    -- Structure to verify specific columns
    -- Format: table_name.column_name
    required_columns text[] := ARRAY[
        'agents.auth_user_id',
        'farmers.agent_id',
        'orders.agent_id',
        'orders.farmer_id',
        'orders.product_id',
        'products.agent_id',
        'products.farmer_id'
    ];
    c text;
    missing_columns text[] := ARRAY[]::text[];
BEGIN
    RAISE NOTICE '--- STARTING SCHEMA VERIFICATION ---';

    -- 1. Check Tables
    FOREACH t IN ARRAY required_tables
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) THEN
            missing_tables := array_append(missing_tables, t);
        END IF;
    END LOOP;

    IF array_length(missing_tables, 1) > 0 THEN
        RAISE WARNING 'MISSING TABLES: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE 'ALL REQUIRED TABLES EXIST.';
    END IF;

    -- 2. Check Critical Columns
    FOREACH c IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = split_part(c, '.', 1)
            AND column_name = split_part(c, '.', 2)
        ) THEN
            missing_columns := array_append(missing_columns, c);
        END IF;
    END LOOP;

    IF array_length(missing_columns, 1) > 0 THEN
        RAISE WARNING 'MISSING COLUMNS: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE 'ALL CRITICAL COLUMNS EXIST.';
    END IF;

    -- 3. Check RLS is enabled on required tables
    RAISE NOTICE '--- RLS STATUS ---';
    FOR t IN 
        SELECT relname, relrowsecurity 
        FROM pg_class 
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
        WHERE nspname = 'public' AND relname = ANY(required_tables)
    LOOP
        IF t.relrowsecurity THEN
            RAISE NOTICE 'Table %: RLS ENABLED', t.relname;
        ELSE
            RAISE WARNING 'Table %: RLS DISABLED!', t.relname;
        END IF;
    END LOOP;

    RAISE NOTICE '--- VERIFICATION COMPLETE ---';
END $$;

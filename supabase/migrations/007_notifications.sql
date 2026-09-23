-- 007_notifications.sql

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    type VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id UUID,
    related_type VARCHAR(50),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_agent_id ON public.notifications(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for Agent isolation
CREATE POLICY "Agents can view their own notifications"
    ON public.notifications FOR SELECT
    USING (agent_id IN (
        SELECT id FROM public.agents WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "Agents can insert their own notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (agent_id IN (
        SELECT id FROM public.agents WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "Agents can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (agent_id IN (
        SELECT id FROM public.agents WHERE auth_user_id = auth.uid()
    ))
    WITH CHECK (agent_id IN (
        SELECT id FROM public.agents WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "Agents can delete their own notifications"
    ON public.notifications FOR DELETE
    USING (agent_id IN (
        SELECT id FROM public.agents WHERE auth_user_id = auth.uid()
    ));

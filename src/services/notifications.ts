import { supabase } from "../lib/supabase";

export interface AppNotification {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  message: string;
  related_id?: string;
  related_type?: "order" | "delivery" | "product" | "farmer" | "buyer" | "employee" | "payment" | "settlement";
  read: boolean;
  created_at: string;
}

export const getNotifications = async (): Promise<AppNotification[]> => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50); // limit to recent for performance

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
  return data || [];
};

export const getUnreadCount = async (): Promise<number> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return 0;

  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (!agentData) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentData.id)
    .eq("read", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }
  return count || 0;
};

export const createNotification = async (
  type: string,
  title: string,
  message: string,
  relatedId?: string,
  relatedType?: "order" | "delivery" | "product" | "farmer" | "buyer" | "employee" | "payment" | "settlement"
): Promise<void> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return;

  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (!agentData) return;

  // Idempotency check: don't create duplicate unread notifications for the same event
  if (relatedId && relatedType) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("agent_id", agentData.id)
      .eq("related_id", relatedId)
      .eq("related_type", relatedType)
      .eq("type", type)
      .eq("read", false)
      .maybeSingle();

    if (existing) {
      return; // Already have an unread notification of this exact type/reference, so ignore
    }
  }

  const { error } = await supabase
    .from("notifications")
    .insert({
      agent_id: agentData.id,
      type,
      title,
      message,
      related_id: relatedId,
      related_type: relatedType,
      read: false
    });

  if (error) {
    console.error("Error creating notification:", error);
  }
};

export const markNotificationRead = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);

  if (error) {
    console.error("Error marking notification as read:", error);
  }
};

export const markAllAsRead = async (): Promise<void> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return;

  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (!agentData) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("agent_id", agentData.id)
    .eq("read", false);

  if (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

export const deleteNotification = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting notification:", error);
  }
};

export const clearNotifications = async (): Promise<void> => {
  const { data: userAuth } = await supabase.auth.getUser();
  if (!userAuth.user) return;

  const { data: agentData } = await supabase
    .from("agents")
    .select("id")
    .eq("auth_user_id", userAuth.user.id)
    .single();

  if (!agentData) return;

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("agent_id", agentData.id);

  if (error) {
    console.error("Error clearing notifications:", error);
  }
};

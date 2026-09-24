import { api } from "../lib/api";

export type RelatedType = "order" | "delivery" | "product" | "farmer" | "buyer" | "employee" | "payment" | "settlement";

export interface AppNotification {
  id: string;
  agent_id: string;
  type: string;
  title: string;
  message: string;
  related_id?: string;
  related_type?: RelatedType;
  read: boolean;
  created_at: string;
}

export const getNotifications = async (): Promise<AppNotification[]> => {
  try {
    return await api.get<AppNotification[]>("/notifications");
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
};

export const getUnreadCount = async (): Promise<number> => {
  try {
    return (await api.get<{ count: number }>("/notifications/unread-count")).count || 0;
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }
};

/** Duplicate unread notifications for the same record are skipped by the server. */
export const createNotification = async (
  type: string,
  title: string,
  message: string,
  relatedId?: string,
  relatedType?: RelatedType
): Promise<void> => {
  try {
    await api.post("/notifications", { type, title, message, related_id: relatedId, related_type: relatedType });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

export const markNotificationRead = async (id: string): Promise<void> => {
  try {
    await api.post(`/notifications/${id}/read`);
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

export const markAllAsRead = async (): Promise<void> => {
  try {
    await api.post("/notifications/read-all");
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

export const deleteNotification = async (id: string): Promise<void> => {
  try {
    await api.delete(`/notifications/${id}`);
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
};

export const clearNotifications = async (): Promise<void> => {
  try {
    await api.delete("/notifications");
  } catch (error) {
    console.error("Error clearing notifications:", error);
  }
};

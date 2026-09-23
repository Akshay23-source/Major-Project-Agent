import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { 
  AppNotification, 
  getNotifications, 
  markNotificationRead, 
  markAllAsRead, 
  deleteNotification, 
  clearNotifications 
} from "../../../src/services/notifications";
import { Colors } from "../../../src/theme/colors";

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"All" | "Unread">("All");

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load notifications.");
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNotifications().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      await loadNotifications();
    } catch (e) {
      Alert.alert("Error", "Failed to mark all as read.");
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All",
      "Are you sure you want to delete all notifications? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive", 
          onPress: async () => {
            await clearNotifications();
            await loadNotifications();
          }
        }
      ]
    );
  };

  const handlePress = async (notification: AppNotification) => {
    // Mark as read if unread
    if (!notification.read) {
      await markNotificationRead(notification.id);
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    }

    // Navigate to related record
    if (notification.related_id && notification.related_type) {
      switch (notification.related_type) {
        case "order":
          router.push(`/(agent)/orders/${notification.related_id}`);
          break;
        case "delivery":
          router.push(`/(agent)/deliveries/${notification.related_id}`);
          break;
        case "product":
          router.push(`/(agent)/products/${notification.related_id}`);
          break;
        case "farmer":
          router.push(`/(agent)/farmers/${notification.related_id}`);
          break;
        case "buyer":
          router.push(`/(agent)/buyers/${notification.related_id}`);
          break;
        case "employee":
          router.push(`/(agent)/employees/${notification.related_id}`);
          break;
        case "payment":
          router.push(`/(agent)/payments/${notification.related_id}`);
          break;
        case "settlement":
          router.push(`/(agent)/payments/settlements/${notification.related_id}`);
          break;
        default:
          break;
      }
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete", "Remove this notification?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          await deleteNotification(id);
          setNotifications(prev => prev.filter(n => n.id !== id));
        }
      }
    ]);
  };

  const getIconForType = (type: string) => {
    if (type.includes("Order")) return "cart";
    if (type.includes("Delivery")) return "bicycle";
    if (type.includes("Stock")) return "cube";
    if (type.includes("Payment") || type.includes("Settlement")) return "wallet";
    if (type.includes("Farmer")) return "leaf";
    if (type.includes("Employee")) return "people";
    return "notifications";
  };

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // in seconds
    
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 172800) return "Yesterday";
    return date.toLocaleDateString();
  };

  const displayedNotifications = filter === "Unread" 
    ? notifications.filter(n => !n.read) 
    : notifications;

  const renderItem = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity 
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handlePress(item)}
      onLongPress={() => handleDelete(item.id)}
    >
      <View style={[styles.iconWrapper, !item.read && { backgroundColor: Colors.primary }]}>
        <Ionicons 
          name={getIconForType(item.type) as any} 
          size={24} 
          color={!item.read ? Colors.surface : Colors.primary} 
        />
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, !item.read && styles.unreadText]}>{item.title}</Text>
          <Text style={styles.time}>{getRelativeTime(item.created_at)}</Text>
        </View>
        <Text style={styles.message}>{item.message}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
          <Ionicons name="trash-outline" size={24} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filters}>
          <TouchableOpacity 
            style={[styles.filterBtn, filter === "All" && styles.filterBtnActive]}
            onPress={() => setFilter("All")}
          >
            <Text style={[styles.filterText, filter === "All" && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterBtn, filter === "Unread" && styles.filterBtnActive]}
            onPress={() => setFilter("Unread")}
          >
            <Text style={[styles.filterText, filter === "Unread" && styles.filterTextActive]}>Unread</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markReadBtn}>
          <Ionicons name="checkmark-done" size={18} color={Colors.primary} style={{ marginRight: 4 }} />
          <Text style={styles.markReadText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : displayedNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>You're all caught up!</Text>
          <Text style={styles.emptySubtitle}>No {filter === "Unread" ? "unread " : ""}notifications to show.</Text>
        </View>
      ) : (
        <FlatList
          data={displayedNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    padding: 16, 
    backgroundColor: Colors.surface, 
    borderBottomWidth: 1, 
    borderBottomColor: Colors.border 
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: Colors.primaryDark },
  clearButton: { padding: 4 },
  
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  filters: { flexDirection: 'row', gap: 8 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: Colors.background },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 14, fontWeight: 'bold', color: Colors.textSecondary },
  filterTextActive: { color: Colors.surface },
  
  markReadBtn: { flexDirection: 'row', alignItems: 'center' },
  markReadText: { fontSize: 14, fontWeight: 'bold', color: Colors.primary },

  list: { padding: 16, paddingBottom: 40 },
  
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center'
  },
  unreadCard: {
    backgroundColor: `${Colors.primary}08`,
    borderColor: `${Colors.primary}30`
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  content: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '500', color: Colors.text },
  unreadText: { fontWeight: 'bold', color: Colors.primaryDark },
  time: { fontSize: 12, color: Colors.textSecondary },
  message: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: 8 },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: "bold", color: Colors.text, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' }
});

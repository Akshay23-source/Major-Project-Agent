import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Agent, getCurrentAgent, updateCurrentAgent } from "../../src/services/agent";
import { supabase } from "../../src/lib/supabase";
import { Colors } from "../../src/theme/colors";

export default function SettingsScreen() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        const data = await getCurrentAgent();
        setAgent(data);
        setLoading(false);
      };
      load();
    }, [])
  );

  const toggleNotifications = async () => {
    if (!agent || updating) return;
    const newStatus = !agent.notifications_enabled;
    // Optimistic UI update
    setAgent({ ...agent, notifications_enabled: newStatus });
    
    setUpdating(true);
    await updateCurrentAgent({ notifications_enabled: newStatus });
    setUpdating(false);
  };

  const cycleTheme = async () => {
    if (!agent || updating) return;
    const themes: Array<"System" | "Light" | "Dark"> = ["System", "Light", "Dark"];
    const nextTheme = themes[(themes.indexOf(agent.theme || "System") + 1) % themes.length];
    
    setAgent({ ...agent, theme: nextTheme });
    
    setUpdating(true);
    await updateCurrentAgent({ theme: nextTheme });
    setUpdating(false);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out of your account?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Logout", 
        style: "destructive", 
        onPress: async () => {
          await supabase.auth.signOut();
          // AuthProvider handles navigation to login
        }
      }
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!agent) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* ACCOUNT */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.card}>
          <SettingsItem icon="person-outline" title="Profile" onPress={() => router.push("/profile")} />
          <View style={styles.divider} />
          <SettingsItem icon="create-outline" title="Edit Profile" onPress={() => router.push("/edit-profile")} />
          <View style={styles.divider} />
          <SettingsItem icon="shield-checkmark-outline" title="Security & Password" onPress={() => router.push("/settings/security")} hideChevron={false} />
        </View>

        {/* PREFERENCES */}
        <Text style={styles.sectionHeader}>PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} style={styles.icon} />
              <Text style={styles.settingTitle}>Notifications</Text>
            </View>
            <Switch
              value={agent.notifications_enabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={agent.notifications_enabled ? Colors.primary : Colors.textSecondary}
              disabled={updating}
            />
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={cycleTheme} activeOpacity={0.7} disabled={updating}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="color-palette-outline" size={22} color={Colors.textSecondary} style={styles.icon} />
              <Text style={styles.settingTitle}>Appearance</Text>
            </View>
            <View style={styles.settingRowRight}>
              <Text style={styles.settingValue}>{agent.theme || "System"}</Text>
              <Ionicons name="chevron-forward" size={20} color={Colors.border} />
            </View>
          </TouchableOpacity>
        </View>

        {/* SYSTEM */}
        <Text style={styles.sectionHeader}>SYSTEM</Text>
        <View style={styles.card}>
          <SettingsItem icon="information-circle-outline" title="About Agri Agent" onPress={() => router.push("/about")} />
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingRowLeft}>
              <Ionicons name="phone-portrait-outline" size={22} color={Colors.textSecondary} style={styles.icon} />
              <Text style={styles.settingTitle}>Version</Text>
            </View>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>
        </View>

        {/* SESSION */}
        <Text style={styles.sectionHeader}>SESSION</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={Colors.error} style={styles.icon} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsItem({ icon, title, onPress, hideChevron }: any) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.settingRowLeft}>
        <Ionicons name={icon} size={22} color={Colors.textSecondary} style={styles.icon} />
        <Text style={styles.settingTitle}>{title}</Text>
      </View>
      {!hideChevron && <Ionicons name="chevron-forward" size={20} color={Colors.border} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: Colors.surface, elevation: 2 },
  backButton: { width: 30 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.primaryDark },
  content: { padding: 20, paddingBottom: 40 },
  sectionHeader: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8, marginTop: 16, paddingLeft: 8 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, overflow: "hidden", elevation: 1 },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  settingRowLeft: { flexDirection: "row", alignItems: "center" },
  settingRowRight: { flexDirection: "row", alignItems: "center" },
  icon: { marginRight: 12 },
  settingTitle: { fontSize: 15, fontWeight: "600", color: Colors.text },
  settingValue: { fontSize: 14, color: Colors.textSecondary, marginRight: 8 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 50 },
  logoutRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  logoutText: { fontSize: 15, fontWeight: "700", color: Colors.error },
});

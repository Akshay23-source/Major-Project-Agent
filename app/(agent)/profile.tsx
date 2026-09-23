import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { Agent, getCurrentAgent } from "../../src/services/agent";
import { Colors } from "../../src/theme/colors";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        setLoading(true);
        const data = await getCurrentAgent();
        setProfile(data);
        setLoading(false);
      };
      loadProfile();
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  const getInitials = (name: string) => {
    return name ? name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "AA";
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatAddress = () => {
    const parts = [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not set";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push("/edit-profile")}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.agentInfo}>Agent | Code: {profile.agent_code || "N/A"}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <InfoRow icon="person-outline" label="Full Name" value={profile.name} />
          <InfoRow icon="mail-outline" label="Email Address" value={profile.email || "Not set"} />
          <InfoRow icon="call-outline" label="Phone Number" value={profile.phone || "Not set"} />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Business Details</Text>
          <InfoRow icon="business-outline" label="Business Name" value={profile.business_name || "Not set"} />
          <InfoRow icon="map-outline" label="Address" value={formatAddress()} />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Work Details</Text>
          <InfoRow icon="id-card-outline" label="Agent Code" value={profile.agent_code || "Not set"} />
          <InfoRow icon="location-outline" label="Assigned Area" value={profile.assigned_area || "Not set"} />
          <InfoRow icon="calendar-outline" label="Joined Date" value={formatDate(profile.created_at)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap, label: string, value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon} size={20} color={Colors.textSecondary} style={styles.icon} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: Colors.surface, elevation: 2 },
  backButton: { width: 30 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.primaryDark },
  editText: { fontSize: 16, fontWeight: "700", color: Colors.primary },
  content: { padding: 20, paddingBottom: 40 },
  profileHeader: { alignItems: "center", marginBottom: 24, paddingVertical: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: "800", color: Colors.surface },
  name: { fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 4 },
  agentInfo: { fontSize: 14, color: Colors.textSecondary, fontWeight: "600" },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 16 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoRowLeft: { flexDirection: "row", alignItems: "center" },
  icon: { marginRight: 12 },
  label: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" },
  value: { fontSize: 14, fontWeight: "600", color: Colors.text, textAlign: "right", flex: 1, paddingLeft: 20 },
});

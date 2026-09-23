import { SafeAreaView } from 'react-native-safe-area-context';
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#14532D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={42} color="#FFFFFF" />
          </View>
          <Text style={styles.brandName}>Agri Agent</Text>
          <Text style={styles.subtitle}>Empowering agriculture, connecting communities</Text>
        </View>

        <View style={styles.card}>
          <InfoRow label="App Version" value="1.0.0" />
          <View style={styles.divider} />
          <InfoRow label="Technology" value="Expo / React Native" />
        </View>

        <Text style={styles.footerText}>
          Designed for agricultural agents to seamlessly manage farmers and orders locally on device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F8F3" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: "#FFFFFF", elevation: 2 },
  backButton: { width: 30 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#14532D" },
  content: { padding: 20, paddingBottom: 40 },
  logoContainer: { alignItems: "center", marginTop: 20, marginBottom: 40 },
  logoCircle: { width: 82, height: 82, borderRadius: 41, backgroundColor: "#15803D", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  brandName: { fontSize: 30, fontWeight: "800", color: "#14532D" },
  subtitle: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 8, maxWidth: 270 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, marginBottom: 24, elevation: 1 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  label: { fontSize: 15, color: "#4B5563", fontWeight: "600" },
  value: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  divider: { height: 1, backgroundColor: "#F3F4F6" },
  footerText: { fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
});

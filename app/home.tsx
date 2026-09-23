import { SafeAreaView } from 'react-native-safe-area-context';
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.name}>Agri Agent</Text>
          </View>

          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons
              name="notifications-outline"
              size={24}
              color="#14532D"
            />

            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* AI Agent Card */}
        <TouchableOpacity
          style={styles.aiCard}
          onPress={() => router.push("/voice")}
          activeOpacity={0.85}
        >
          <View style={styles.aiIcon}>
            <Ionicons
              name="mic-outline"
              size={32}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.aiContent}>
            <Text style={styles.aiTitle}>Talk to Agri AI</Text>

            <Text style={styles.aiDescription}>
              Ask questions about crops, farming, weather and markets.
            </Text>

            <View style={styles.aiAction}>
              <Text style={styles.aiActionText}>Start Voice Assistant</Text>

              <Ionicons
                name="arrow-forward"
                size={17}
                color="#FFFFFF"
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Quick Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Services</Text>

          <Text style={styles.seeAll}>View all</Text>
        </View>

        <View style={styles.servicesGrid}>

          {/* Crop Advice */}
          <TouchableOpacity style={styles.serviceCard}>
            <View style={[styles.serviceIcon, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons
                name="leaf-outline"
                size={25}
                color="#15803D"
              />
            </View>

            <Text style={styles.serviceTitle}>Crop Advice</Text>

            <Text style={styles.serviceDescription}>
              Get crop recommendations
            </Text>
          </TouchableOpacity>

          {/* Weather */}
          <TouchableOpacity style={styles.serviceCard}>
            <View style={[styles.serviceIcon, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons
                name="partly-sunny-outline"
                size={25}
                color="#2563EB"
              />
            </View>

            <Text style={styles.serviceTitle}>Weather</Text>

            <Text style={styles.serviceDescription}>
              Check local conditions
            </Text>
          </TouchableOpacity>

          {/* Disease Detection */}
          <TouchableOpacity style={styles.serviceCard}>
            <View style={[styles.serviceIcon, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons
                name="scan-outline"
                size={25}
                color="#D97706"
              />
            </View>

            <Text style={styles.serviceTitle}>Disease Scan</Text>

            <Text style={styles.serviceDescription}>
              Detect crop diseases
            </Text>
          </TouchableOpacity>

          {/* Market */}
          <TouchableOpacity style={styles.serviceCard}>
            <View style={[styles.serviceIcon, { backgroundColor: "#F3E8FF" }]}>
              <Ionicons
                name="trending-up-outline"
                size={25}
                color="#9333EA"
              />
            </View>

            <Text style={styles.serviceTitle}>Market Prices</Text>

            <Text style={styles.serviceDescription}>
              Check current prices
            </Text>
          </TouchableOpacity>

        </View>

        {/* Marketplace */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Farm Marketplace</Text>

          <Text style={styles.seeAll}>Explore</Text>
        </View>

        <TouchableOpacity style={styles.marketCard}>
          <View style={styles.marketIcon}>
            <Ionicons
              name="storefront-outline"
              size={30}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.marketContent}>
            <Text style={styles.marketTitle}>
              Buy & Sell Agricultural Products
            </Text>

            <Text style={styles.marketDescription}>
              Connect farmers, buyers and agricultural businesses.
            </Text>

            <View style={styles.marketLink}>
              <Text style={styles.marketLinkText}>
                Open Marketplace
              </Text>

              <Ionicons
                name="arrow-forward"
                size={16}
                color="#15803D"
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Today's Farming Tip */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Farming Tip</Text>
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <Ionicons
              name="bulb-outline"
              size={24}
              color="#CA8A04"
            />
          </View>

          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>
              Smart Irrigation
            </Text>

            <Text style={styles.tipText}>
              Water your crops during the early morning or evening
              to reduce evaporation and improve water efficiency.
            </Text>
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F8F3",
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  greeting: {
    fontSize: 14,
    color: "#64748B",
  },

  name: {
    fontSize: 27,
    fontWeight: "800",
    color: "#14532D",
    marginTop: 3,
  },

  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  notificationDot: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    top: 10,
    right: 11,
  },

  aiCard: {
    backgroundColor: "#15803D",
    borderRadius: 22,
    padding: 20,
    flexDirection: "row",
    marginBottom: 28,
  },

  aiIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },

  aiContent: {
    flex: 1,
  },

  aiTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
  },

  aiDescription: {
    color: "#DCFCE7",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  aiAction: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 7,
  },

  aiActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#17251B",
  },

  seeAll: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },

  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  serviceCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  serviceTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#17251B",
  },

  serviceDescription: {
    fontSize: 11,
    color: "#718096",
    marginTop: 5,
    lineHeight: 16,
  },

  marketCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    marginBottom: 28,
  },

  marketIcon: {
    width: 55,
    height: 55,
    borderRadius: 17,
    backgroundColor: "#15803D",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  marketContent: {
    flex: 1,
  },

  marketTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17251B",
  },

  marketDescription: {
    fontSize: 12,
    color: "#718096",
    lineHeight: 18,
    marginTop: 5,
  },

  marketLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },

  marketLinkText: {
    fontSize: 12,
    color: "#15803D",
    fontWeight: "800",
  },

  tipCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 18,
    padding: 17,
    flexDirection: "row",
  },

  tipIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  tipContent: {
    flex: 1,
  },

  tipTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#92400E",
  },

  tipText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#78350F",
    marginTop: 5,
  },
});
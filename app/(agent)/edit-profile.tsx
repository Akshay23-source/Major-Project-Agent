import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Agent, getCurrentAgent, updateCurrentAgent } from "../../src/services/agent";
import { Colors } from "../../src/theme/colors";

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setStateValue] = useState("");
  const [pincode, setPincode] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await getCurrentAgent();
      if (data) {
        setProfile(data);
        setName(data.name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setBusinessName(data.business_name || "");
        setAddress(data.address || "");
        setCity(data.city || "");
        setStateValue(data.state || "");
        setPincode(data.pincode || "");
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Invalid Input", "Name cannot be empty.");
      return;
    }
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Invalid Input", "Please enter a valid email address.");
      return;
    }

    setSaving(true);
    const updated = await updateCurrentAgent({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      business_name: businessName.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      pincode: pincode.trim() || null,
    });
    setSaving(false);

    if (updated) {
      Alert.alert("Profile Updated", "Your changes have been saved.", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } else {
      Alert.alert("Error", "Failed to update profile.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <InputField label="Full Name *" icon="person-outline" value={name} onChangeText={setName} />
          <InputField label="Email Address" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <InputField label="Phone Number" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Business Details</Text>
          <InputField label="Business Name" icon="business-outline" value={businessName} onChangeText={setBusinessName} />
          <InputField label="Street Address" icon="map-outline" value={address} onChangeText={setAddress} />
          <InputField label="City" icon="business-outline" value={city} onChangeText={setCity} />
          <InputField label="State" icon="map-outline" value={state} onChangeText={setStateValue} />
          <InputField label="Pincode" icon="location-outline" value={pincode} onChangeText={setPincode} keyboardType="numeric" />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InputField({ label, icon, value, onChangeText, keyboardType, autoCapitalize }: any) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <Ionicons name={icon} size={20} color={Colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          placeholderTextColor={Colors.textSecondary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: Colors.surface, elevation: 2 },
  backButton: { width: 30 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.primaryDark },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginBottom: 20, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 8 },
  inputContainer: { height: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.background, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: Colors.text },
  saveButton: { height: 55, backgroundColor: Colors.primary, borderRadius: 14, justifyContent: "center", alignItems: "center", elevation: 2 },
  saveText: { color: Colors.surface, fontSize: 16, fontWeight: "800" },
});

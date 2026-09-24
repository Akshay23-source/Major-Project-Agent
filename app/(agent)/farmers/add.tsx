import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { createFarmer } from "../../../src/services/farmers";
import { createNotification } from "../../../src/services/notifications";

export default function AddFarmerScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [crop, setCrop] = useState("");
  const [farmName, setFarmName] = useState("");
  const [landSize, setLandSize] = useState("");
  const [farmSizeUnit, setFarmSizeUnit] = useState("Acres");
  const [verificationStatus, setVerificationStatus] = useState<"Verified" | "Pending" | "Rejected">("Pending");

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing information", "Please enter the farmer's name.");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("Missing information", "Please enter the phone number.");
      return;
    }

    if (phone.replace(/\D/g, "").length < 10) {
      Alert.alert(
        "Invalid phone number",
        "Please enter a valid 10-digit phone number."
      );
      return;
    }

    if (!village.trim()) {
      Alert.alert("Missing information", "Please enter the village.");
      return;
    }

    try {
      const newFarmerData = {
        name,
        phone,
        village,
        district,
        state,
        pincode,
        farm_name: farmName,
        main_crops: crop,
        land_size: landSize,
        farm_size_unit: farmSizeUnit,
        verification_status: verificationStatus,
      };

      const createdFarmer = await createFarmer(newFarmerData);
      
      if (!createdFarmer) {
        Alert.alert("Error", "Failed to save farmer data. Please try again.");
        return;
      }

      await createNotification(
        "farmer_created",
        "New Farmer Added",
        `${name} was added as a new farmer.`,
        createdFarmer.id,
        "farmer"
      );

      Alert.alert(
        "Farmer Added",
        `${name} has been added successfully.`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error("Error saving farmer", error);
      Alert.alert("Error", "Failed to save farmer data.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#14532D"
            />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>Add Farmer</Text>
            <Text style={styles.subtitle}>
              Register a new farmer
            </Text>
          </View>
        </View>

        {/* Profile Icon */}
        <View style={styles.profileContainer}>
          <View style={styles.profileCircle}>
            <Ionicons
              name="person-outline"
              size={38}
              color="#15803D"
            />
          </View>

          <Text style={styles.profileTitle}>
            Farmer Information
          </Text>

          <Text style={styles.profileSubtitle}>
            Enter the farmer's basic details
          </Text>
        </View>

        {/* Basic Information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Basic Information
          </Text>

          <InputField
            label="Farmer Name *"
            icon="person-outline"
            placeholder="Enter full name"
            value={name}
            onChangeText={setName}
          />

          <InputField
            label="Phone Number *"
            icon="call-outline"
            placeholder="10-digit mobile number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={10}
          />

          <InputField
            label="Village *"
            icon="location-outline"
            placeholder="Enter village name"
            value={village}
            onChangeText={setVillage}
          />

          <InputField
            label="District"
            icon="map-outline"
            placeholder="Enter district"
            value={district}
            onChangeText={setDistrict}
          />

          <InputField
            label="State"
            icon="map-outline"
            placeholder="Enter state"
            value={state}
            onChangeText={setStateName}
          />

          <InputField
            label="Pincode"
            icon="location-outline"
            placeholder="Enter pincode"
            value={pincode}
            onChangeText={setPincode}
            keyboardType="phone-pad"
            maxLength={6}
          />
        </View>

        {/* Farming Information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Farming Information
          </Text>
          
          <InputField
            label="Farm Name"
            icon="home-outline"
            placeholder="e.g. Green Valley Farm"
            value={farmName}
            onChangeText={setFarmName}
          />

          <InputField
            label="Main Crops"
            icon="leaf-outline"
            placeholder="e.g. Rice, Coconut, Tomato"
            value={crop}
            onChangeText={setCrop}
          />

          <InputField
            label="Farm Size"
            icon="resize-outline"
            placeholder="e.g. 2.5"
            value={landSize}
            onChangeText={setLandSize}
            keyboardType="phone-pad"
          />

          <InputField
            label="Size Unit"
            icon="apps-outline"
            placeholder="e.g. Acres, Hectares"
            value={farmSizeUnit}
            onChangeText={setFarmSizeUnit}
          />
        </View>

        {/* Status */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {(["Verified", "Pending", "Rejected"] as const).map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#DCE5DD', backgroundColor: '#FAFCFA' },
                  verificationStatus === status && { backgroundColor: '#15803D', borderColor: '#15803D' }
                ]}
                onPress={() => setVerificationStatus(status)}
              >
                <Text style={[{ color: '#374151', fontWeight: '600' }, verificationStatus === status && { color: '#FFF' }]}>{status}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location Note */}
        <View style={styles.locationCard}>
          <Ionicons
            name="information-circle-outline"
            size={21}
            color="#15803D"
          />

          <Text style={styles.locationText}>
            GPS location can be added later when location services
            are connected.
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={22}
            color="#FFFFFF"
          />

          <Text style={styles.saveText}>
            Save Farmer
          </Text>
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelText}>
            Cancel
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InputField({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  maxLength,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "phone-pad" | "email-address";
  maxLength?: number;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputContainer}>
        <Ionicons
          name={icon}
          size={19}
          color="#64748B"
          style={styles.inputIcon}
        />

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize="words"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F8F3",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 18,
    marginBottom: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  headerText: {
    marginLeft: 13,
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#14532D",
  },

  subtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  profileContainer: {
    alignItems: "center",
    marginBottom: 22,
  },

  profileCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  profileTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#17251B",
  },

  profileSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#17251B",
    marginBottom: 5,
  },

  inputGroup: {
    marginTop: 15,
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },

  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: "#DCE5DD",
    borderRadius: 14,
    backgroundColor: "#FAFCFA",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },

  inputIcon: {
    marginRight: 9,
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: "#17251B",
  },

  locationCard: {
    backgroundColor: "#ECFDF3",
    borderRadius: 15,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  locationText: {
    flex: 1,
    fontSize: 11,
    color: "#166534",
    lineHeight: 17,
    marginLeft: 9,
  },

  saveButton: {
    height: 55,
    borderRadius: 15,
    backgroundColor: "#15803D",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  saveText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 8,
  },

  cancelButton: {
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },

  cancelText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },
});

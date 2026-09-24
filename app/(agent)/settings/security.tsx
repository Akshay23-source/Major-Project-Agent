import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from "react";
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
import { changePassword } from "../../../src/services/agent";
import { Colors } from "../../../src/theme/colors";

export default function SecurityScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!currentPassword) {
      Alert.alert("Current Password Required", "Enter your current password to confirm it's you.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Invalid Password", "Password must be at least 8 characters long.");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert("Password Mismatch", "The new passwords do not match.");
      return;
    }

    setSaving(true);
    const success = await changePassword(newPassword, currentPassword);
    setSaving(false);

    if (success) {
      Alert.alert("Success", "Your password has been updated securely.", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } else {
      Alert.alert("Error", "Failed to update password. Check your current password and try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <Text style={styles.description}>
            Use a strong password that you aren't using for any other accounts.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Password *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Enter current password"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Enter new password"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password *</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Confirm new password"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.saveText}>Update Password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: Colors.surface, elevation: 2 },
  backButton: { width: 30 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.primaryDark },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, marginBottom: 20, elevation: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 8 },
  description: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 8 },
  inputContainer: { height: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.background, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: Colors.text },
  saveButton: { height: 55, backgroundColor: Colors.primary, borderRadius: 14, justifyContent: "center", alignItems: "center", elevation: 2 },
  saveText: { color: Colors.surface, fontSize: 16, fontWeight: "800" },
});

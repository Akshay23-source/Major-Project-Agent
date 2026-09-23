import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function OTPScreen() {
  const [otp, setOtp] = useState("");

  const handleVerify = () => {
    if (otp.length === 6) {
      router.replace("/(agent)");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>

          {/* Icon */}
          <View style={styles.iconCircle}>
            <Ionicons
              name="shield-checkmark-outline"
              size={42}
              color="#FFFFFF"
            />
          </View>

          {/* Heading */}
          <Text style={styles.title}>Verify Your Number</Text>

          <Text style={styles.description}>
            We've sent a 6-digit verification code to your mobile number.
          </Text>

          {/* OTP */}
          <Text style={styles.label}>Enter OTP</Text>

          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={(text) =>
              setOtp(text.replace(/[^0-9]/g, "").slice(0, 6))
            }
            keyboardType="number-pad"
            maxLength={6}
            placeholder="------"
            placeholderTextColor="#9CA3AF"
            textAlign="center"
          />

          {/* Verify */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              otp.length !== 6 && styles.disabledButton,
            ]}
            onPress={handleVerify}
            disabled={otp.length !== 6}
          >
            <Text style={styles.verifyText}>Verify OTP</Text>

            <Ionicons
              name="arrow-forward"
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity style={styles.resendButton}>
            <Text style={styles.resendText}>
              Didn't receive the code?{" "}
              <Text style={styles.resendLink}>Resend OTP</Text>
            </Text>
          </TouchableOpacity>

          {/* Back */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color="#166534"
            />

            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F8F3",
  },

  keyboard: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },

  iconCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#15803D",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 28,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#14532D",
    textAlign: "center",
  },

  description: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 30,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
  },

  otpInput: {
    height: 60,
    borderWidth: 1,
    borderColor: "#B7D7C0",
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 10,
    color: "#14532D",
  },

  verifyButton: {
    height: 56,
    backgroundColor: "#15803D",
    borderRadius: 15,
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  disabledButton: {
    opacity: 0.5,
  },

  verifyText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  resendButton: {
    alignItems: "center",
    marginTop: 24,
  },

  resendText: {
    color: "#6B7280",
    fontSize: 13,
  },

  resendLink: {
    color: "#15803D",
    fontWeight: "800",
  },

  backButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 30,
  },

  backText: {
    color: "#166534",
    fontSize: 14,
    fontWeight: "700",
  },
});
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { authApi, errorMessage } from "../../src/lib/api";

export default function LoginScreen() {
  const [activeTab, setActiveTab] = useState<'email' | 'driver'>('email');

  // Agent (email) state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Driver (email) state
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPassword, setDriverPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // --- AGENT: EMAIL + PASSWORD ---
  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await authApi.agentLogin(email.trim(), password);
      router.replace("/dashboard");
    } catch (e) {
      Alert.alert("Login Failed", errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // --- DRIVER: EMAIL + PASSWORD ---
  const handleDriverLogin = async () => {
    if (!driverEmail.trim() || !driverPassword) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await authApi.driverLogin(driverEmail.trim(), driverPassword);
      router.replace("/(driver)/dashboard");
    } catch (e) {
      Alert.alert("Login Failed", errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <Text style={styles.title}>Login</Text>
            <Text style={styles.subtitle}>Welcome back! Please login to{"\n"}continue</Text>
          </View>

          {/* TABS */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'email' && styles.activeTab]} 
              onPress={() => setActiveTab('email')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'email' && styles.activeTabText]}>Agent</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'driver' && styles.activeTab]} 
              onPress={() => setActiveTab('driver')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'driver' && styles.activeTabText]}>Driver</Text>
            </TouchableOpacity>
          </View>

          {/* DYNAMIC FORM */}
          <View style={styles.formContainer}>
            
            {activeTab === 'email' ? (
              // EMAIL FORM
              <>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                  onPress={handleEmailLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>{loading ? "Authenticating..." : "Login"}</Text>
                </TouchableOpacity>
              </>
            ) : (
              // DRIVER EMAIL FORM
              <>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    value={driverEmail}
                    onChangeText={setDriverEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#9CA3AF"
                    value={driverPassword}
                    onChangeText={setDriverPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                  onPress={handleDriverLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>{loading ? "Authenticating..." : "Login"}</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 40 : 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FAFCFA',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#C3E8CC',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#0B8F3C',
  },
  formContainer: {
    flex: 1,
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
    borderColor: "#E5E7EB",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
  },
  mobileInputRow: {
    flexDirection: 'row',
    height: 52,
    marginBottom: 20,
  },
  countryCode: {
    width: 80,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
  },
  countryCodeText: {
    fontSize: 14,
    color: "#111827",
    fontWeight: '500',
  },
  mobileInput: {
    flex: 1,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: "#E5E7EB",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 28,
    marginTop: -8,
  },
  forgotText: {
    color: "#0B8F3C",
    fontWeight: "600",
    fontSize: 13,
  },
  primaryButton: {
    height: 54,
    backgroundColor: "#0B8F3C",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: '#0B8F3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 36,
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#F3F4F6",
  },
  orText: {
    marginHorizontal: 16,
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  socialRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 40,
  },
  socialButton: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
  },
  socialText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    color: "#6B7280",
    fontSize: 14,
  },
  signupLink: {
    color: "#0B8F3C",
    fontWeight: "700",
    fontSize: 14,
  },
});
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
import { supabase } from "../../src/lib/supabase";
import * as Linking from "expo-linking";
import { getCurrentAgent } from "../../src/services/agent";
import { getCurrentDriver, linkDriverAccount } from "../../src/services/driver/auth";

export default function LoginScreen() {
  const [activeTab, setActiveTab] = useState<'email' | 'mobile'>('email');
  
  // Email State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Mobile State
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  
  const [loading, setLoading] = useState(false);

  // --- EMAIL FLOW ---
  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        Alert.alert(
          "Email Not Confirmed",
          "Please verify your email before logging in.",
          [
            { text: "Try Again", style: "cancel" },
            { 
              text: "Resend Email", 
              onPress: async () => {
                const { error: resendError } = await supabase.auth.resend({
                  type: 'signup',
                  email,
                });
                if (resendError) Alert.alert("Error", resendError.message);
                else Alert.alert("Success", "Confirmation email resent. Check your inbox.");
              }
            }
          ]
        );
      } else {
        Alert.alert("Login Failed", error.message);
      }
    } else {
      const isAgent = await getCurrentAgent();
      if (isAgent) {
        router.replace("/dashboard");
      } else {
        const isDriver = await getCurrentDriver();
        if (isDriver) {
          router.replace("/(driver)/dashboard");
        } else {
          Alert.alert("Access Denied", "Your account is not registered as an Agent or Driver.");
        }
      }
    }
  };

  // --- MOBILE FLOW ---
  const handleSendOtp = async () => {
    if (mobile.length !== 10) {
      Alert.alert("Invalid Mobile", "Please enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${mobile}`
    });
    setLoading(false);
    
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setIsOtpSent(true);
      Alert.alert("OTP Sent", "Please check your messages.");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert("Invalid OTP", "Please enter the 6-digit OTP.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: `+91${mobile}`,
      token: otp,
      type: 'sms'
    });
    setLoading(false);
    
    if (error) {
      Alert.alert("Verification Failed", error.message);
    } else {
      const isAgent = await getCurrentAgent();
      if (isAgent) {
        router.replace("/dashboard");
      } else {
        // Try linking the mobile number as a driver account first
        await linkDriverAccount(`+91${mobile}`);
        
        const isDriver = await getCurrentDriver();
        if (isDriver) {
          router.replace("/(driver)/dashboard");
        } else {
          Alert.alert("Access Denied", "No driver profile found for this number.");
        }
      }
    }
  };

  // --- OAUTH FLOW ---
  const handleOAuth = async (provider: 'google' | 'facebook') => {
    try {
      const redirectUri = Linking.createURL('/');
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: false,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert(`${provider === 'google' ? 'Google' : 'Facebook'} sign-in could not be completed.`, err.message);
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
              <Text style={[styles.tabText, activeTab === 'email' && styles.activeTabText]}>Email</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'mobile' && styles.activeTab]} 
              onPress={() => { setActiveTab('mobile'); setIsOtpSent(false); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'mobile' && styles.activeTabText]}>Mobile</Text>
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

                <TouchableOpacity style={styles.forgotButton} onPress={() => router.push("/forgot-password")}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

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
              // MOBILE FORM
              <>
                <Text style={styles.label}>Mobile Number</Text>
                <View style={styles.mobileInputRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>+91</Text>
                    <Ionicons name="chevron-down" size={14} color="#6B7280" />
                  </View>
                  <TextInput
                    style={styles.mobileInput}
                    placeholder="Enter mobile number"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={mobile}
                    onChangeText={(text) => setMobile(text.replace(/[^0-9]/g, ""))}
                  />
                </View>

                {isOtpSent && (
                  <>
                    <Text style={styles.label}>OTP Code</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={setOtp}
                      />
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, loading && { opacity: 0.7 }, { marginTop: isOtpSent ? 16 : 28 }]}
                  onPress={isOtpSent ? handleVerifyOtp : handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>
                    {loading ? "Please wait..." : (isOtpSent ? "Verify & Login" : "Send OTP")}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* OAUTH & FOOTER (Shared) */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.orText}>or continue with</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialButton} onPress={() => handleOAuth('google')}>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.socialButton} onPress={() => handleOAuth('facebook')}>
                <Ionicons name="logo-facebook" size={20} color="#4267B2" />
                <Text style={styles.socialText}>Facebook</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/signup")}>
                <Text style={styles.signupLink}>Sign up</Text>
              </TouchableOpacity>
            </View>

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
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

export default function SignupScreen() {
  const [activeTab, setActiveTab] = useState<'email' | 'mobile'>('email');
  
  const [fullName, setFullName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Email State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Mobile State
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  
  const [loading, setLoading] = useState(false);

  // --- EMAIL SIGNUP ---
  const handleEmailSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    if (!agreedToTerms) {
      Alert.alert("Error", "You must agree to the Terms & Conditions.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });
    setLoading(false);

    if (error) {
      console.error("[Signup Error] Code:", error.code, "Message:", error.message, "Status:", error.status);
      
      if (error.message.includes('rate limit')) {
        Alert.alert("Rate Limit Exceeded", "Too many signup attempts. Please wait before trying again.");
      } else if (error.message.includes('Network request failed')) {
        Alert.alert("Network Error", "Unable to connect to the authentication server. Please check your internet connection.");
      } else if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
        Alert.alert("Account Exists", "This email is already registered. Please log in.");
      } else if (error.message.toLowerCase().includes('password')) {
        Alert.alert("Weak Password", "Your password does not meet the required security rules.");
      } else {
        Alert.alert("Signup Failed", error.message);
      }
    } else {
      Alert.alert('Success', 'Account created. Please check your email to confirm your account.');
      router.back(); // Return to login
    }
  };

  // --- MOBILE SIGNUP (OTP FLOW) ---
  const handleSendOtp = async () => {
    if (!fullName) {
      Alert.alert("Error", "Please enter your full name.");
      return;
    }
    if (mobile.length !== 10) {
      Alert.alert("Invalid Mobile", "Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!agreedToTerms) {
      Alert.alert("Error", "You must agree to the Terms & Conditions.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${mobile}`,
      options: {
        data: {
          full_name: fullName,
        }
      }
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
      Alert.alert("Success", "Account verified successfully.");
      router.replace("/dashboard");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <Text style={styles.title}>Sign Up</Text>
            <Text style={styles.subtitle}>Create your account to get started</Text>
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

          {/* SHARED FIELDS */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#9CA3AF"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

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
                  />
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Create a password"
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

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // MOBILE FORM (OTP Based)
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
              </>
            )}

            {/* TERMS CHECKBOX */}
            <TouchableOpacity 
              style={styles.termsContainer} 
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxActive]}>
                {agreedToTerms && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the <Text style={styles.linkText}>Terms & Conditions</Text>{"\n"}
                and <Text style={styles.linkText}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            {/* ACTION BUTTON */}
            {activeTab === 'email' ? (
              <TouchableOpacity
                style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={handleEmailSignup}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{loading ? "Creating Account..." : "Sign Up"}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, loading && { opacity: 0.7 }]}
                onPress={isOtpSent ? handleVerifyOtp : handleSendOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? "Please wait..." : (isOtpSent ? "Verify & Sign Up" : "Send OTP")}
                </Text>
              </TouchableOpacity>
            )}

            {/* FOOTER */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>Login</Text>
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
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 32,
    marginTop: 8,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: "#0B8F3C",
    borderColor: "#0B8F3C",
  },
  termsText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 20,
    flex: 1,
  },
  linkText: {
    color: "#0B8F3C",
    fontWeight: "700",
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
    marginBottom: 32,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    color: "#6B7280",
    fontSize: 14,
  },
  loginLink: {
    color: "#0B8F3C",
    fontWeight: "700",
    fontSize: 14,
  },
});

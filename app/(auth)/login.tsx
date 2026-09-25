import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, errorMessage } from '../../src/lib/api';
import { AuthButton, AuthHero, AuthInput, useEntrance } from '../../src/components/auth';
import { BrandColors, BrandRadius, BrandShadow, BrandSpace, BrandType, TOUCH_TARGET } from '../../src/theme/brand';

type Role = 'agent' | 'driver';

const ROLES: { key: Role; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'agent', label: 'Agent', icon: 'briefcase-outline' },
  { key: 'driver', label: 'Driver', icon: 'car-outline' },
];

/** Remember Me keeps only the role + email/phone on this device (never the password). */
const REMEMBER_KEY = 'agri_remember_login';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digitsOf = (v: string) => v.replace(/\D/g, '');

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<Role>('agent');

  // Agent (email) state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Driver (phone) state
  const [driverPhone, setDriverPhone] = useState('');
  const [driverPassword, setDriverPassword] = useState('');

  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ id?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const sheetAnim = useEntrance(80);
  const formAnim = useEntrance(0, role, 10);

  // Restore the remembered role + identifier
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REMEMBER_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as { role: Role; id: string };
        setRole(saved.role);
        if (saved.role === 'agent') setEmail(saved.id);
        else setDriverPhone(saved.id);
        setRememberMe(true);
      } catch {
        // storage unavailable: start empty
      }
    })();
  }, []);

  const persistRemember = async (r: Role, id: string) => {
    try {
      if (rememberMe) await AsyncStorage.setItem(REMEMBER_KEY, JSON.stringify({ role: r, id }));
      else await AsyncStorage.removeItem(REMEMBER_KEY);
    } catch {
      // non-critical
    }
  };

  const switchRole = (r: Role) => {
    setRole(r);
    setErrors({});
    setFormError(null);
  };

  // --- AGENT: EMAIL + PASSWORD ---
  const handleEmailLogin = async () => {
    const next: typeof errors = {};
    if (!email.trim()) next.id = 'Email is required';
    else if (!EMAIL_RE.test(email.trim())) next.id = 'Enter a valid email address';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    setFormError(null);
    if (next.id || next.password) return;

    setLoading(true);
    try {
      await authApi.agentLogin(email.trim(), password);
      await persistRemember('agent', email.trim().toLowerCase());
      router.replace('/dashboard');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // --- DRIVER: PHONE + PASSWORD ---
  const handleDriverLogin = async () => {
    const next: typeof errors = {};
    if (!driverPhone.trim()) next.id = 'Mobile number is required';
    else if (digitsOf(driverPhone).length < 10) next.id = 'Enter a valid 10-digit mobile number';
    if (!driverPassword) next.password = 'Password is required';
    setErrors(next);
    setFormError(null);
    if (next.id || next.password) return;

    setLoading(true);
    try {
      await authApi.driverLogin(driverPhone.trim(), driverPassword);
      await persistRemember('driver', driverPhone.trim());
      router.replace('/(driver)/dashboard');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password',
      role === 'agent'
        ? 'Please contact your AgriAgent administrator to reset your password.'
        : 'Ask the agent who registered you to reset your password.'
    );
  };

  const isAgent = role === 'agent';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero tagline="Farm-to-buyer logistics, connected to Farm Marketplace" showChips />

        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + BrandSpace.xxl }, sheetAnim]}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to manage marketplace orders, pickups and your delivery fleet.
          </Text>

          <Text style={styles.fieldLabel}>Sign in as</Text>
          <View style={styles.roleContainer}>
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.roleButton, active && styles.roleButtonActive]}
                  onPress={() => switchRole(r.key)}
                >
                  <Ionicons name={r.icon} size={16} color={active ? BrandColors.white : BrandColors.muted} />
                  <Text style={[styles.roleButtonText, active && styles.roleButtonTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Animated.View style={formAnim}>
            {!!formError && (
              <View style={styles.formError}>
                <Ionicons name="alert-circle" size={18} color={BrandColors.error} />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            )}

            {isAgent ? (
              <AuthInput
                key="agent-id"
                label="Email Address"
                icon="mail-outline"
                placeholder="you@example.com"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.id) setErrors((e) => ({ ...e, id: undefined }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={errors.id}
              />
            ) : (
              <AuthInput
                key="driver-id"
                label="Mobile Number"
                icon="call-outline"
                placeholder="Number registered by your agent"
                value={driverPhone}
                onChangeText={(v) => {
                  setDriverPhone(v);
                  if (errors.id) setErrors((e) => ({ ...e, id: undefined }));
                }}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={15}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                error={errors.id}
              />
            )}

            <AuthInput
              ref={passwordRef}
              label="Password"
              icon="lock-closed-outline"
              placeholder="Enter your password"
              value={isAgent ? password : driverPassword}
              onChangeText={(v) => {
                if (isAgent) setPassword(v);
                else setDriverPassword(v);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              passwordToggle
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={isAgent ? handleEmailLogin : handleDriverLogin}
              error={errors.password}
            />

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                onPress={() => setRememberMe((v) => !v)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe && <Ionicons name="checkmark" size={14} color={BrandColors.white} />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <AuthButton
              title={isAgent ? 'Login as Agent' : 'Login as Driver'}
              icon="arrow-forward"
              onPress={isAgent ? handleEmailLogin : handleDriverLogin}
              loading={loading}
              loadingText="Signing in…"
            />
          </Animated.View>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>
              {isAgent ? "Don't have an account? " : 'First time here? '}
            </Text>
            <TouchableOpacity onPress={() => router.push({ pathname: '/register', params: { role } })}>
              <Text style={styles.registerLink}>{isAgent ? 'Register' : 'Activate account'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerDivider} />
            <View style={styles.footerRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={BrandColors.muted} />
              <Text style={styles.footerText}>Secure sign-in · Your data stays on AgriAgent servers</Text>
            </View>
            <Text style={styles.footerBrand}>AgriAgent Logistics · A Farm Marketplace partner</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BrandColors.background },
  scroll: { flexGrow: 1 },
  sheet: {
    flex: 1,
    backgroundColor: BrandColors.surface,
    borderTopLeftRadius: BrandRadius.xxl,
    borderTopRightRadius: BrandRadius.xxl,
    marginTop: -BrandSpace.xxl,
    paddingHorizontal: BrandSpace.xl,
    paddingTop: BrandSpace.xl,
    ...BrandShadow.lg,
  },
  title: {
    fontSize: BrandType.size.huge,
    lineHeight: BrandType.leading.huge,
    fontWeight: BrandType.weight.extrabold,
    color: BrandColors.text,
    letterSpacing: BrandType.tracking.tight,
  },
  subtitle: {
    marginTop: BrandSpace.xs,
    marginBottom: BrandSpace.xl,
    fontSize: BrandType.size.sm,
    lineHeight: BrandType.leading.sm,
    color: BrandColors.textSecondary,
  },
  fieldLabel: {
    fontSize: BrandType.size.xs,
    lineHeight: BrandType.leading.xs,
    fontWeight: BrandType.weight.bold,
    color: BrandColors.textSecondary,
    letterSpacing: BrandType.tracking.wider,
    textTransform: 'uppercase',
    marginBottom: BrandSpace.sm,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: BrandSpace.xs,
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: BrandRadius.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: BrandSpace.xs,
    marginBottom: BrandSpace.xl,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BrandSpace.xs + 2,
    minHeight: TOUCH_TARGET,
    borderRadius: BrandRadius.md,
  },
  roleButtonActive: { backgroundColor: BrandColors.primary, ...BrandShadow.xs },
  roleButtonText: {
    fontSize: BrandType.size.sm,
    fontWeight: BrandType.weight.semibold,
    color: BrandColors.textSecondary,
  },
  roleButtonTextActive: { color: BrandColors.white },
  formError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BrandSpace.sm,
    backgroundColor: BrandColors.errorSoft,
    borderRadius: BrandRadius.md,
    padding: BrandSpace.md - 4,
    marginBottom: BrandSpace.md,
  },
  formErrorText: {
    flex: 1,
    color: BrandColors.error,
    fontSize: BrandType.size.sm,
    lineHeight: BrandType.leading.sm,
    fontWeight: BrandType.weight.medium,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: BrandSpace.md,
    marginBottom: BrandSpace.xl,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minHeight: TOUCH_TARGET },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BrandRadius.sm,
    borderWidth: 2,
    borderColor: BrandColors.borderStrong,
    marginRight: BrandSpace.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: BrandColors.primary, borderColor: BrandColors.primary },
  rememberText: { fontSize: BrandType.size.sm, color: BrandColors.textSecondary },
  forgotButton: { justifyContent: 'center', minHeight: TOUCH_TARGET },
  forgotText: { fontSize: BrandType.size.sm, color: BrandColors.primary, fontWeight: BrandType.weight.semibold },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: BrandSpace.lg,
  },
  registerText: { fontSize: BrandType.size.sm, color: BrandColors.textSecondary },
  registerLink: { fontSize: BrandType.size.sm, fontWeight: BrandType.weight.bold, color: BrandColors.primary },
  footer: { marginTop: BrandSpace.xxl, alignItems: 'center', gap: BrandSpace.xs + 2 },
  footerDivider: { width: 48, height: 4, borderRadius: 2, backgroundColor: BrandColors.border, marginBottom: BrandSpace.sm },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: BrandType.size.xs, color: BrandColors.muted },
  footerBrand: {
    fontSize: BrandType.size.xs,
    color: BrandColors.textSecondary,
    fontWeight: BrandType.weight.semibold,
    letterSpacing: BrandType.tracking.wide,
  },
});

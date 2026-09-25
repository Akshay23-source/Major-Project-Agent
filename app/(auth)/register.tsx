import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi, errorMessage, setSession, Session } from '../../src/lib/api';
import { AuthButton, AuthHero, AuthInput, useEntrance } from '../../src/components/auth';
import { BrandColors, BrandRadius, BrandShadow, BrandSpace, BrandType } from '../../src/theme/brand';

type Role = 'agent' | 'driver';

const STEPS = ['Role', 'Details', 'Security'] as const;

const ROLE_CARDS: {
  key: Role;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  perks: string[];
}[] = [
  {
    key: 'agent',
    title: 'Logistics Agent',
    body: 'Receive Farm Marketplace orders and run dispatch.',
    icon: 'briefcase',
    tint: BrandColors.primarySoft,
    perks: ['Accept marketplace orders', 'Assign drivers & vehicles', 'Track every delivery live'],
  },
  {
    key: 'driver',
    title: 'Delivery Driver',
    body: 'Activate the account your agent created for you.',
    icon: 'car',
    tint: BrandColors.tintAmber,
    perks: ['See assigned pickups', 'Update delivery status', 'Share live location'],
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digitsOf = (v: string) => v.replace(/\D/g, '');

/** 0–4 score for the strength bar. */
const passwordScore = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
};
const STRENGTH = [
  { label: 'Too short', color: BrandColors.error },
  { label: 'Weak', color: BrandColors.error },
  { label: 'Fair', color: BrandColors.warning },
  { label: 'Good', color: BrandColors.info },
  { label: 'Strong', color: BrandColors.success },
];

type Errors = Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirm', string>>;

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ role?: string }>();

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>(params.role === 'driver' ? 'driver' : 'agent');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Session | null>(null);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const sheetAnim = useEntrance(80);
  const stepAnim = useEntrance(0, step, 14);

  // Progress bar animation
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: created ? STEPS.length : step + 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step, created, progress]);

  const isAgent = role === 'agent';
  const clear = (k: keyof Errors) => errors[k] && setErrors((e) => ({ ...e, [k]: undefined }));

  // ── Validation per step ─────────────────────
  const validateDetails = () => {
    const e: Errors = {};
    if (isAgent) {
      if (name.trim().length < 2) e.name = 'Enter your full name (at least 2 characters)';
      if (!email.trim()) e.email = 'Email is required';
      else if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address';
      if (phone.trim() && digitsOf(phone).length < 10) e.phone = 'Enter a valid 10-digit mobile number';
    } else if (digitsOf(phone).length < 10) {
      e.phone = 'Enter the 10-digit number your agent registered';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateSecurity = () => {
    const e: Errors = {};
    if (password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!confirm) e.confirm = 'Please confirm your password';
    else if (confirm !== password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    setFormError(null);
    if (step === 1 && !validateDetails()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setFormError(null);
    setErrors({});
    if (step > 0) setStep((s) => s - 1);
    else if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  // ── Submit (existing backend endpoints) ─────
  const handleSubmit = async () => {
    setFormError(null);
    if (!validateSecurity()) return;
    setLoading(true);
    try {
      const session = isAgent
        ? await authApi.agentSignup({
            name: name.trim(),
            email: email.trim(),
            password,
            ...(phone.trim() ? { phone: phone.trim() } : {}),
          })
        : await authApi.driverActivate(phone.trim(), password);
      setCreated(session);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!created) return;
    await setSession(created);
    router.replace(created.role === 'driver' ? '/(driver)/dashboard' : '/dashboard');
  };

  // ── Render ──────────────────────────────────
  const progressWidth = progress.interpolate({ inputRange: [0, STEPS.length], outputRange: ['0%', '100%'] });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AuthHero
          onBack={created ? undefined : goBack}
          tagline={isAgent ? 'Create your logistics agent account' : 'Activate your delivery driver account'}
        />

        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + BrandSpace.xxl }, sheetAnim]}>
          {created ? (
            <SuccessView session={created} onContinue={handleContinue} />
          ) : (
            <>
              {/* Stepper */}
              <View style={styles.stepper}>
                <View style={styles.stepTrack}>
                  <Animated.View style={[styles.stepFill, { width: progressWidth }]} />
                </View>
                <View style={styles.stepLabels}>
                  {STEPS.map((label, i) => {
                    const done = i < step;
                    const active = i === step;
                    return (
                      <View key={label} style={styles.stepItem}>
                        <View style={[styles.stepDot, (done || active) && styles.stepDotActive]}>
                          {done ? (
                            <Ionicons name="checkmark" size={12} color={BrandColors.white} />
                          ) : (
                            <Text style={[styles.stepNum, active && { color: BrandColors.white }]}>{i + 1}</Text>
                          )}
                        </View>
                        <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <Animated.View style={stepAnim}>
                {step === 0 && (
                  <>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Step 1 of 3 · Who will be using AgriAgent?</Text>

                    {ROLE_CARDS.map((card) => {
                      const active = role === card.key;
                      return (
                        <TouchableOpacity
                          key={card.key}
                          activeOpacity={0.9}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          onPress={() => setRole(card.key)}
                          style={[styles.roleCard, active && styles.roleCardActive]}
                        >
                          <View style={styles.roleCardTop}>
                            <View style={[styles.roleIcon, { backgroundColor: card.tint }]}>
                              <Ionicons
                                name={card.icon}
                                size={24}
                                color={card.key === 'agent' ? BrandColors.primary : BrandColors.accent}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.roleTitle}>{card.title}</Text>
                              <Text style={styles.roleBody}>{card.body}</Text>
                            </View>
                            <View style={[styles.radio, active && styles.radioActive]}>
                              {active && <View style={styles.radioDot} />}
                            </View>
                          </View>
                          <View style={styles.perks}>
                            {card.perks.map((p) => (
                              <View key={p} style={styles.perkRow}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={15}
                                  color={active ? BrandColors.primary : BrandColors.muted}
                                />
                                <Text style={styles.perkText}>{p}</Text>
                              </View>
                            ))}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    <AuthButton title="Continue" icon="arrow-forward" onPress={goNext} style={styles.cta} />
                  </>
                )}

                {step === 1 && (
                  <>
                    <Text style={styles.title}>{isAgent ? 'Your details' : 'Find your account'}</Text>
                    <Text style={styles.subtitle}>
                      Step 2 of 3 · {isAgent ? 'Tell us who you are.' : 'Use the number your agent added you with.'}
                    </Text>

                    {isAgent ? (
                      <>
                        <AuthInput
                          label="Full Name"
                          required
                          icon="person-outline"
                          placeholder="e.g. Ravi Kumar"
                          value={name}
                          onChangeText={(v) => {
                            setName(v);
                            clear('name');
                          }}
                          autoCapitalize="words"
                          autoComplete="name"
                          textContentType="name"
                          returnKeyType="next"
                          onSubmitEditing={() => emailRef.current?.focus()}
                          error={errors.name}
                        />
                        <AuthInput
                          ref={emailRef}
                          label="Email"
                          required
                          icon="mail-outline"
                          placeholder="you@example.com"
                          value={email}
                          onChangeText={(v) => {
                            setEmail(v);
                            clear('email');
                          }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoComplete="email"
                          textContentType="emailAddress"
                          returnKeyType="next"
                          onSubmitEditing={() => phoneRef.current?.focus()}
                          error={errors.email}
                          hint="You'll use this email to sign in."
                        />
                        <AuthInput
                          ref={phoneRef}
                          label="Phone"
                          icon="call-outline"
                          placeholder="10-digit mobile number"
                          value={phone}
                          onChangeText={(v) => {
                            setPhone(v);
                            clear('phone');
                          }}
                          keyboardType="phone-pad"
                          autoComplete="tel"
                          textContentType="telephoneNumber"
                          maxLength={15}
                          returnKeyType="done"
                          onSubmitEditing={goNext}
                          error={errors.phone}
                          hint="Optional · shared with your drivers for pickups."
                        />
                      </>
                    ) : (
                      <>
                        <View style={styles.infoCard}>
                          <Ionicons name="information-circle" size={20} color={BrandColors.info} />
                          <Text style={styles.infoText}>
                            Drivers are added by their agent. Enter the mobile number your agent registered, then set
                            your own password.
                          </Text>
                        </View>
                        <AuthInput
                          label="Mobile Number"
                          required
                          icon="call-outline"
                          placeholder="Number registered by your agent"
                          value={phone}
                          onChangeText={(v) => {
                            setPhone(v);
                            clear('phone');
                          }}
                          keyboardType="phone-pad"
                          autoComplete="tel"
                          textContentType="telephoneNumber"
                          maxLength={15}
                          returnKeyType="done"
                          onSubmitEditing={goNext}
                          error={errors.phone}
                        />
                      </>
                    )}

                    <AuthButton title="Continue" icon="arrow-forward" onPress={goNext} style={styles.cta} />
                  </>
                )}

                {step === 2 && (
                  <>
                    <Text style={styles.title}>Secure your account</Text>
                    <Text style={styles.subtitle}>Step 3 of 3 · Choose a password of at least 8 characters.</Text>

                    {!!formError && (
                      <View style={styles.formError}>
                        <Ionicons name="alert-circle" size={18} color={BrandColors.error} />
                        <Text style={styles.formErrorText}>{formError}</Text>
                      </View>
                    )}

                    <AuthInput
                      label="Password"
                      required
                      icon="lock-closed-outline"
                      placeholder="Create a password"
                      value={password}
                      onChangeText={(v) => {
                        setPassword(v);
                        clear('password');
                      }}
                      passwordToggle
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="next"
                      onSubmitEditing={() => confirmRef.current?.focus()}
                      error={errors.password}
                      containerStyle={{ marginBottom: BrandSpace.sm }}
                    />
                    <StrengthBar password={password} />

                    <AuthInput
                      ref={confirmRef}
                      label="Confirm Password"
                      required
                      icon="shield-checkmark-outline"
                      placeholder="Re-enter your password"
                      value={confirm}
                      onChangeText={(v) => {
                        setConfirm(v);
                        clear('confirm');
                      }}
                      passwordToggle
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="go"
                      onSubmitEditing={handleSubmit}
                      error={errors.confirm}
                    />

                    <View style={styles.summary}>
                      <Ionicons
                        name={isAgent ? 'briefcase-outline' : 'car-outline'}
                        size={16}
                        color={BrandColors.primary}
                      />
                      <Text style={styles.summaryText} numberOfLines={1}>
                        {isAgent ? `${name.trim() || 'Agent'} · ${email.trim()}` : `Driver · ${phone.trim()}`}
                      </Text>
                      <TouchableOpacity onPress={() => setStep(1)} hitSlop={8}>
                        <Text style={styles.summaryEdit}>Edit</Text>
                      </TouchableOpacity>
                    </View>

                    <AuthButton
                      title={isAgent ? 'Create Account' : 'Activate Account'}
                      icon="checkmark-circle-outline"
                      onPress={handleSubmit}
                      loading={loading}
                      loadingText={isAgent ? 'Creating account…' : 'Activating…'}
                      style={styles.cta}
                    />
                  </>
                )}
              </Animated.View>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}>
                  <Text style={styles.loginLink}>Login</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StrengthBar({ password }: { password: string }) {
  if (!password) return <View style={{ height: BrandSpace.md }} />;
  const score = password.length < 8 ? 0 : passwordScore(password);
  const s = STRENGTH[score];
  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBars}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.strengthBar, { backgroundColor: i <= Math.max(score, 1) ? s.color : BrandColors.border }]} />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function SuccessView({ session, onContinue }: { session: Session; onContinue: () => void }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const fade = useEntrance(150);
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [scale]);

  const isDriver = session.role === 'driver';
  return (
    <View style={styles.successWrap}>
      <Animated.View style={[styles.successHalo, { transform: [{ scale }] }]}>
        <View style={styles.successCircle}>
          <Ionicons name="checkmark" size={44} color={BrandColors.white} />
        </View>
      </Animated.View>
      <Animated.View style={[{ alignItems: 'center', alignSelf: 'stretch' }, fade]}>
        <Text style={[styles.title, { textAlign: 'center' }]}>{isDriver ? 'Account activated!' : 'Account created!'}</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          Welcome, {session.user.name}.{' '}
          {isDriver
            ? 'You can now see your assigned pickups and update deliveries.'
            : 'Marketplace orders sent to your account will appear on your dashboard.'}
        </Text>
        <View style={styles.successCard}>
          <Ionicons name={isDriver ? 'car' : 'briefcase'} size={18} color={BrandColors.primary} />
          <Text style={styles.successCardText}>
            {isDriver ? `Driver · ${session.user.phone ?? ''}` : `Agent · ${session.user.email ?? ''}`}
          </Text>
        </View>
        <AuthButton title="Continue to Dashboard" icon="arrow-forward" onPress={onContinue} style={styles.cta} />
      </Animated.View>
    </View>
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
  // Stepper
  stepper: { marginBottom: BrandSpace.xl },
  stepTrack: { height: 4, borderRadius: 2, backgroundColor: BrandColors.border, overflow: 'hidden' },
  stepFill: { height: 4, borderRadius: 2, backgroundColor: BrandColors.primary },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: BrandSpace.sm + 2 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.surfaceAlt,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
  },
  stepDotActive: { backgroundColor: BrandColors.primary, borderColor: BrandColors.primary },
  stepNum: { fontSize: BrandType.size.xs, fontWeight: BrandType.weight.bold, color: BrandColors.textSecondary },
  stepLabel: { fontSize: BrandType.size.xs, color: BrandColors.muted, fontWeight: BrandType.weight.semibold },
  stepLabelActive: { color: BrandColors.primaryDark },
  // Headings
  title: {
    fontSize: BrandType.size.xxxl,
    lineHeight: BrandType.leading.xxxl,
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
  // Role cards
  roleCard: {
    borderRadius: BrandRadius.lg,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surfaceAlt,
    padding: BrandSpace.md,
    marginBottom: BrandSpace.md,
  },
  roleCardActive: { borderColor: BrandColors.primary, backgroundColor: BrandColors.primaryTint, ...BrandShadow.sm },
  roleCardTop: { flexDirection: 'row', alignItems: 'center', gap: BrandSpace.md - 4 },
  roleIcon: { width: 48, height: 48, borderRadius: BrandRadius.md, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: BrandType.size.md, fontWeight: BrandType.weight.bold, color: BrandColors.text },
  roleBody: { marginTop: 2, fontSize: BrandType.size.xs + 1, lineHeight: 18, color: BrandColors.textSecondary },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BrandColors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: BrandColors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BrandColors.primary },
  perks: { marginTop: BrandSpace.sm + 4, gap: 6, paddingLeft: 60 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perkText: { fontSize: BrandType.size.xs + 1, color: BrandColors.textSecondary },
  cta: { marginTop: BrandSpace.sm },
  // Info / errors
  infoCard: {
    flexDirection: 'row',
    gap: BrandSpace.sm,
    backgroundColor: BrandColors.infoSoft,
    borderRadius: BrandRadius.md,
    padding: BrandSpace.md - 4,
    marginBottom: BrandSpace.md,
  },
  infoText: { flex: 1, fontSize: BrandType.size.sm - 1, lineHeight: 19, color: BrandColors.text },
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
  // Strength
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: BrandSpace.sm, marginBottom: BrandSpace.md },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: BrandType.size.xs, fontWeight: BrandType.weight.bold, minWidth: 60, textAlign: 'right' },
  // Summary
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSpace.sm,
    backgroundColor: BrandColors.primaryTint,
    borderRadius: BrandRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.primarySoft,
    paddingHorizontal: BrandSpace.md - 4,
    paddingVertical: BrandSpace.sm + 2,
    marginBottom: BrandSpace.md,
  },
  summaryText: { flex: 1, fontSize: BrandType.size.sm, color: BrandColors.text, fontWeight: BrandType.weight.medium },
  summaryEdit: { fontSize: BrandType.size.sm, color: BrandColors.primary, fontWeight: BrandType.weight.bold },
  // Footer link
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: BrandSpace.lg,
  },
  loginText: { fontSize: BrandType.size.sm, color: BrandColors.textSecondary },
  loginLink: { fontSize: BrandType.size.sm, fontWeight: BrandType.weight.bold, color: BrandColors.primary },
  // Success
  successWrap: { alignItems: 'center', paddingTop: BrandSpace.lg },
  successHalo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: BrandColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: BrandSpace.xl,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...BrandShadow.md,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSpace.sm,
    backgroundColor: BrandColors.surfaceAlt,
    borderRadius: BrandRadius.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: BrandSpace.md,
    paddingVertical: BrandSpace.sm + 4,
    marginBottom: BrandSpace.lg,
    alignSelf: 'stretch',
  },
  successCardText: { flex: 1, fontSize: BrandType.size.sm, color: BrandColors.text, fontWeight: BrandType.weight.semibold },
});

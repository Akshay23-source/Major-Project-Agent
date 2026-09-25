import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors, BrandRadius, BrandSpace, BrandType } from '../../theme/brand';

interface Props extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Adds the eye show/hide toggle for password fields. */
  passwordToggle?: boolean;
  containerStyle?: ViewStyle;
}

/** Labelled input with leading icon, focus ring, error and hint — same as Farm Marketplace's Input. */
const AuthInput = forwardRef<TextInput, Props>(function AuthInput(
  { label, icon, error, hint, required, passwordToggle, containerStyle, style, onFocus, onBlur, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const accent = error ? BrandColors.error : focused ? BrandColors.primary : BrandColors.muted;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {!!label && (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={{ color: BrandColors.error }}> *</Text> : null}
        </Text>
      )}
      <View
        style={[
          styles.field,
          { borderColor: error ? BrandColors.error : focused ? BrandColors.primary : BrandColors.border },
          focused && !error && styles.fieldFocused,
        ]}
      >
        {icon && <Ionicons name={icon} size={20} color={accent} style={styles.icon} />}
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={passwordToggle ? hidden : rest.secureTextEntry}
          placeholderTextColor={BrandColors.muted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {passwordToggle && (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={BrandColors.muted} />
          </TouchableOpacity>
        )}
      </View>
      {!!error && (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle" size={13} color={BrandColors.error} />
          <Text style={[styles.message, { color: BrandColors.error }]}>{error}</Text>
        </View>
      )}
      {!error && !!hint && <Text style={[styles.message, styles.hint]}>{hint}</Text>}
    </View>
  );
});

export default AuthInput;

const styles = StyleSheet.create({
  wrap: { marginBottom: BrandSpace.md },
  label: {
    fontSize: BrandType.size.sm,
    lineHeight: BrandType.leading.sm,
    fontWeight: BrandType.weight.semibold,
    color: BrandColors.text,
    marginBottom: BrandSpace.xs + 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.input,
    borderRadius: BrandRadius.md,
    borderWidth: 1.5,
    paddingHorizontal: BrandSpace.md,
    minHeight: 52,
  },
  fieldFocused: { backgroundColor: BrandColors.surface },
  icon: { marginRight: BrandSpace.sm },
  input: {
    flex: 1,
    fontSize: BrandType.size.md,
    color: BrandColors.text,
    paddingVertical: BrandSpace.sm,
  },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: BrandSpace.xs },
  message: { fontSize: BrandType.size.xs, lineHeight: BrandType.leading.xs },
  hint: { color: BrandColors.textSecondary, marginTop: BrandSpace.xs },
});

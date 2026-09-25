import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientFill from './GradientFill';
import { BrandColors, BrandRadius, BrandShadow, BrandSpace, BrandType } from '../../theme/brand';

type Variant = 'primary' | 'outline' | 'ghost';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/** Large (56px) button: gradient primary, outline or ghost — Farm Marketplace Button size="lg". */
export default function AuthButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'right',
  loading = false,
  loadingText,
  disabled = false,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const fg = variant === 'primary' ? BrandColors.white : BrandColors.primary;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        variant === 'primary' && BrandShadow.sm,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        isDisabled && !loading && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' && <GradientFill style={styles.fill} />}
      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator size="small" color={fg} />
          {!!loadingText && <Text style={[styles.label, { color: fg }]}>{loadingText}</Text>}
        </View>
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && <Ionicons name={icon} size={20} color={fg} />}
          <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && <Ionicons name={icon} size={20} color={fg} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: BrandRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: BrandSpace.xl,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  fill: { borderRadius: BrandRadius.md },
  outline: { borderWidth: 1.5, borderColor: BrandColors.primary, backgroundColor: 'transparent' },
  ghost: { backgroundColor: BrandColors.primarySoft },
  disabled: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: BrandSpace.sm },
  label: {
    fontSize: BrandType.size.md,
    fontWeight: BrandType.weight.bold,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});

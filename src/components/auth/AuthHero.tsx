import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientFill from './GradientFill';
import { BrandColors, BrandRadius, BrandSpace, BrandType, TOUCH_TARGET } from '../../theme/brand';

interface Props {
  /** Shows a round back button in the top-left (register screen). */
  onBack?: () => void;
  /** Small line under the brand name. */
  tagline?: string;
  /** Show the feature chips (login screen). */
  showChips?: boolean;
}

const CHIPS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'leaf-outline', label: 'Farm pickups' },
  { icon: 'car-outline', label: 'Drivers' },
  { icon: 'navigate-outline', label: 'Live tracking' },
];

/** Green gradient header with soft light blobs, logo well and brand — Farm Marketplace style. */
export default function AuthHero({ onBack, tagline, showChips }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.hero, { paddingTop: insets.top + BrandSpace.lg }]}>
      <GradientFill />
      <View style={styles.blobOne} pointerEvents="none" />
      <View style={styles.blobTwo} pointerEvents="none" />

      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity
            style={styles.roundButton}
            onPress={onBack}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={BrandColors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoWell}>
            <Ionicons name="leaf" size={28} color={BrandColors.white} />
            <View style={styles.logoBadge}>
              <Ionicons name="cube" size={11} color={BrandColors.primaryDark} />
            </View>
          </View>
        )}
        <View style={styles.pill}>
          <Ionicons name="storefront-outline" size={13} color={BrandColors.white} />
          <Text style={styles.pillText}>Farm Marketplace partner</Text>
        </View>
      </View>

      <View style={styles.brandRow}>
        {onBack && (
          <View style={[styles.logoWell, styles.logoWellSmall]}>
            <Ionicons name="leaf" size={22} color={BrandColors.white} />
          </View>
        )}
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.brand} numberOfLines={1}>
            AgriAgent Logistics
          </Text>
          {!!tagline && (
            <Text style={styles.tagline} numberOfLines={2}>
              {tagline}
            </Text>
          )}
        </View>
      </View>

      {showChips && (
        <View style={styles.chipRow}>
          {CHIPS.map((c) => (
            <View key={c.label} style={styles.chip}>
              <Ionicons name={c.icon} size={13} color={BrandColors.white} />
              <Text style={styles.chipText}>{c.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const glass = {
  backgroundColor: 'rgba(255,255,255,0.22)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.38)',
};

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: BrandSpace.xl,
    paddingBottom: BrandSpace.xxl + BrandSpace.xl,
    overflow: 'hidden',
  },
  blobOne: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: BrandRadius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  blobTwo: {
    position: 'absolute',
    bottom: -90,
    left: -60,
    width: 170,
    height: 170,
    borderRadius: BrandRadius.full,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: BrandSpace.md,
  },
  logoWell: {
    width: 58,
    height: 58,
    borderRadius: BrandRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },
  logoWellSmall: { width: 46, height: 46 },
  logoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: BrandRadius.full,
    backgroundColor: BrandColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: BrandRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...glass,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: BrandSpace.sm + 4,
    paddingVertical: 6,
    borderRadius: BrandRadius.full,
    ...glass,
  },
  pillText: {
    color: BrandColors.white,
    fontSize: BrandType.size.xs,
    fontWeight: BrandType.weight.semibold,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSpace.sm + 2,
    marginTop: BrandSpace.lg,
  },
  brand: {
    fontSize: BrandType.size.xl,
    lineHeight: BrandType.leading.xl,
    fontWeight: BrandType.weight.extrabold,
    color: BrandColors.white,
    letterSpacing: BrandType.tracking.wide,
  },
  tagline: {
    marginTop: 2,
    fontSize: BrandType.size.sm,
    lineHeight: BrandType.leading.sm,
    color: 'rgba(255,255,255,0.85)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BrandSpace.sm,
    marginTop: BrandSpace.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BrandRadius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  chipText: {
    color: BrandColors.white,
    fontSize: BrandType.size.xs,
    fontWeight: BrandType.weight.medium,
  },
});

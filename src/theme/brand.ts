/**
 * Farm Marketplace design language, shared with Agri Agent.
 *
 * Values are copied from the Farm Marketplace app (constants/ThemeColors.ts,
 * Typography.ts, Layout.ts) so both apps look like one product family.
 * Used by the auth screens; the rest of the app keeps src/theme/colors.ts.
 */
import { ViewStyle } from 'react-native';

export const BrandColors = {
  primary: '#2F8F3E',
  primaryLight: '#5FC544',
  primaryDark: '#1F6B2B',
  primarySoft: '#E9F6EA',
  primaryTint: '#F2FAF3',

  secondary: '#1B7F5C',
  secondarySoft: '#E6F4EF',
  accent: '#E9A23B',

  background: '#F3F5F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F9F8',
  input: '#F6F8F7',

  white: '#FFFFFF',
  text: '#1B1D1C',
  textSecondary: '#6E7A74',
  muted: '#98A29D',
  border: '#E5EBE7',
  borderStrong: '#D3DCD7',

  error: '#D14343',
  errorSoft: '#FDECEC',
  success: '#2F8F3E',
  successSoft: '#E9F6EA',
  warning: '#E08A16',
  warningSoft: '#FDF3E2',
  info: '#2A7DBF',
  infoSoft: '#E8F2FA',
  tintAmber: '#FDF4E3',
  tintBlue: '#E8F3FB',
} as const;

/** CTA gradient used by the primary button and hero surfaces (same as Farm Marketplace). */
export const BrandGradients = {
  primary: ['#5FC544', '#2F8F3E'] as const,
  dark: ['#1F6B2B', '#14471D'] as const,
};

export const BrandType = {
  size: { xxs: 10, xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24, xxxl: 28, huge: 32 },
  leading: { xs: 16, sm: 20, md: 24, lg: 26, xl: 28, xxl: 32, xxxl: 36, huge: 40 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800' } as const,
  tracking: { tight: -0.4, normal: 0, wide: 0.4, wider: 1.1 },
};

export const BrandSpace = { xs: 4, sm: 8, md: 16, lg: 20, xl: 24, xxl: 32 };

export const BrandRadius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 9999 };

export const TOUCH_TARGET = 44;

const shadow = (height: number, opacity: number, radius: number, elevation: number): ViewStyle => ({
  shadowColor: '#0B2015',
  shadowOffset: { width: 0, height },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
});

export const BrandShadow = {
  xs: shadow(1, 0.05, 3, 1),
  sm: shadow(2, 0.07, 8, 2),
  md: shadow(4, 0.1, 14, 4),
  lg: shadow(8, 0.13, 22, 8),
};

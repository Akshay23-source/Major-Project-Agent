import React, { useId } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { BrandGradients } from '../../theme/brand';

interface Props {
  colors?: readonly [string, string];
  style?: ViewStyle | ViewStyle[];
}

/**
 * Diagonal two-stop gradient (top-left → bottom-right), drawn with react-native-svg,
 * matching Farm Marketplace's expo-linear-gradient hero and buttons without a new dependency.
 */
export default function GradientFill({ colors = BrandGradients.primary, style }: Props) {
  const id = `grad${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

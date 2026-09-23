import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform
} from "react-native";
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/src/theme';

export default function SplashScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Top Section */}
      <View style={styles.topSection}>
        <View style={styles.logoContainer}>
          <Ionicons name="leaf" size={32} color="#0B8F3C" style={styles.leafIcon} />
          <Text style={styles.brandName}>AgriAgent</Text>
        </View>
        <Text style={styles.subtitle}>
          Your smart partner in{"\n"}building a better farm future.
        </Text>
      </View>

      {/* Middle Section - Illustration */}
      <View style={styles.illustrationContainer}>
        <Image 
          source={require('../assets/splash-illustration.png')} 
          style={styles.illustration}
          resizeMode="cover"
        />
      </View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.push('/login')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
        
        <Text style={styles.footerText}>Manage. Connect. Grow.</Text>
        
        <View style={styles.indicatorsContainer}>
          <View style={[styles.indicator, styles.activeIndicator]} />
          <View style={styles.indicator} />
          <View style={styles.indicator} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFCFA',
  },
  topSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 20 : 50,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  leafIcon: {
    marginRight: 8,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A211D',
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  },
  illustrationContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20, // Pull up slightly under text
    overflow: 'hidden',
  },
  illustration: {
    width: '100%',
    height: '110%',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 40,
    paddingTop: 20,
    alignItems: 'center',
    backgroundColor: '#FAFCFA',
  },
  button: {
    backgroundColor: '#0B8F3C',
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B8F3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 24,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  activeIndicator: {
    backgroundColor: '#0B8F3C',
  },
});

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useSidebar } from '../../providers/SidebarProvider';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../providers/AuthProvider';
import { signOut } from '../../lib/api';
import { useLocalization } from '../../hooks/useLocalization';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;
const SIDEBAR_WIDTH = 280;

const NAV_ITEMS = [
  { nameKey: 'navigation.dashboard', fallback: 'Dashboard', route: '/dashboard', icon: 'grid-outline' },
  { nameKey: 'navigation.orders', fallback: 'Orders', route: '/orders', icon: 'cart-outline' },
  { nameKey: 'navigation.marketplaceOrders', fallback: 'Marketplace Orders', route: '/marketplace', icon: 'storefront-outline' },
  { nameKey: 'navigation.farmers', fallback: 'Farmers', route: '/farmers', icon: 'leaf-outline' },
  { nameKey: 'navigation.buyers', fallback: 'Buyers', route: '/buyers', icon: 'business-outline' },
  { nameKey: 'navigation.employees', fallback: 'Employees', route: '/employees', icon: 'people-outline' },
  { nameKey: 'navigation.deliveryPartners', fallback: 'Delivery Partners', route: '/delivery-partners', icon: 'bicycle' },
  { nameKey: 'navigation.vehicles', fallback: 'Vehicles & Transport', route: '/fleet', icon: 'car-outline' },
  { nameKey: 'navigation.liveTracking', fallback: 'Live Tracking', route: '/logistics/map', icon: 'map-outline' },
  { nameKey: 'navigation.products', fallback: 'Products', route: '/products', icon: 'cube-outline' },
  { nameKey: 'navigation.payments', fallback: 'Payments', route: '/payments', icon: 'card-outline' },
  { nameKey: 'navigation.earnings', fallback: 'Earnings', route: '/earnings', icon: 'cash-outline' },
  { nameKey: 'navigation.reports', fallback: 'Reports', route: '/reports', icon: 'bar-chart-outline' },
  { nameKey: 'navigation.notifications', fallback: 'Notifications', route: '/notifications', icon: 'notifications-outline' },
  { nameKey: 'navigation.disputes', fallback: 'Disputes', route: '/disputes', icon: 'warning-outline' },
  { nameKey: 'navigation.settings', fallback: 'Settings', route: '/settings', icon: 'settings-outline' },
];

export const Sidebar = () => {
  const { isOpen, closeSidebar } = useSidebar();
  const slideAnim = useRef(new Animated.Value(IS_MOBILE ? -SIDEBAR_WIDTH : 0)).current;
  const router = useRouter();
  const segments = useSegments();
  const { user } = useAuth();
  const { t } = useLocalization();

  useEffect(() => {
    if (IS_MOBILE) {
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen, IS_MOBILE]);

  const handleNavPress = (route: string) => {
    if (IS_MOBILE) closeSidebar();
    router.push(route as any);
  };

  const handleLogout = async () => {
    if (IS_MOBILE) closeSidebar();
    await signOut();
  };

  const currentRoute = '/' + segments.join('/');
  const isActive = (route: string) => {
    if (route === '/dashboard' && (currentRoute === '/dashboard' || currentRoute === '/')) return true;
    if (route !== '/dashboard' && currentRoute.startsWith(route)) return true;
    return false;
  };

  const renderSidebarContent = () => (
    <View style={styles.sidebarContainer}>
      <View style={styles.logoContainer}>
        <Ionicons name="leaf" size={28} color={Colors.surface} />
        <Text style={styles.logoText}>AgriAgent</Text>
      </View>

      <ScrollView style={styles.navContainer} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.route);
          return (
            <TouchableOpacity
              key={item.fallback}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => handleNavPress(item.route)}
            >
              <Ionicons
                name={item.icon as any}
                size={22}
                color={active ? Colors.surface : 'rgba(255, 255, 255, 0.7)'}
              />
              <Text style={[styles.navText, active && styles.navTextActive]}>
                {t(item.nameKey) || item.fallback}
              </Text>
              {item.fallback === 'Notifications' && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>3</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.profileSection}>
        <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={'#FF8A8A'} />
          <Text style={[styles.navText, { color: '#FF8A8A' }]}>{t('navigation.logout') || 'Logout'}</Text>
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <Ionicons name="person-circle" size={40} color={Colors.surface} />
          <View style={styles.profileTexts}>
            <Text style={styles.profileName}>{user?.name || user?.email?.split('@')[0] || 'Agent User'}</Text>
            <Text style={styles.profileRole}>Field Agent</Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (!IS_MOBILE) {
    return <View style={styles.desktopContainer}>{renderSidebarContent()}</View>;
  }

  return (
    <>
      {isOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeSidebar}
        />
      )}
      <Animated.View
        style={[
          styles.mobileContainer,
          { transform: [{ translateX: slideAnim }] }
        ]}
      >
        {renderSidebarContent()}
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  desktopContainer: {
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.primaryDark,
    borderRightWidth: 1,
    borderRightColor: Colors.primaryDark,
    height: '100%',
  },
  mobileContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.primaryDark,
    zIndex: 100,
    elevation: 100,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.overlay,
    zIndex: 99,
    elevation: 99,
  },
  sidebarContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.surface,
    marginLeft: 10,
  },
  navContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  navText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 14,
    fontWeight: '500',
    flex: 1,
  },
  navTextActive: {
    color: Colors.surface,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: 'bold',
  },
  profileSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  profileTexts: {
    marginLeft: 10,
  },
  profileName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.surface,
  },
  profileRole: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Platform, 
  ScrollView, 
  Modal, 
  Pressable, 
  useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useSidebar } from '../../providers/SidebarProvider';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../../providers/AuthProvider';
import { signOut } from '../../lib/api';
import { useLocalization } from '../../hooks/useLocalization';

const SIDEBAR_WIDTH = 280;

const AGENT_NAV_ITEMS = [
  { nameKey: 'navigation.dashboard', fallback: 'Operations & Orders', route: '/dashboard', icon: 'grid-outline' },
  { nameKey: 'navigation.orders', fallback: 'Orders', route: '/orders', icon: 'cart-outline' },
  { nameKey: 'navigation.deliveryPartners', fallback: 'Delivery Partners', route: '/delivery-partners', icon: 'bicycle' },
  { nameKey: 'navigation.liveTracking', fallback: 'Live Tracking', route: '/logistics/map', icon: 'map-outline' },
  { nameKey: 'navigation.reports', fallback: 'Reports', route: '/reports', icon: 'bar-chart-outline' },
  { nameKey: 'navigation.notifications', fallback: 'Notifications', route: '/notifications', icon: 'notifications-outline' },
  { nameKey: 'navigation.settings', fallback: 'Settings', route: '/settings', icon: 'settings-outline' },
];

const DRIVER_NAV_ITEMS = [
  { nameKey: 'driver.dashboard', fallback: 'Driver Dashboard', route: '/(driver)/dashboard', icon: 'home-outline' },
  { nameKey: 'driver.incoming', fallback: 'Incoming Requests', route: '/(driver)/incoming', icon: 'cube-outline' },
  { nameKey: 'driver.awaiting', fallback: 'Awaiting Pickup', route: '/(driver)/awaiting', icon: 'time-outline' },
  { nameKey: 'driver.myDeliveries', fallback: 'Active Deliveries', route: '/(driver)/deliveries', icon: 'bicycle-outline' },
  { nameKey: 'driver.deliveredToday', fallback: 'Delivered Today', route: '/(driver)/delivered-today', icon: 'checkmark-circle-outline' },
];

export const Sidebar = () => {
  const { isOpen, closeSidebar } = useSidebar();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const slideAnim = useRef(new Animated.Value(isMobile ? -SIDEBAR_WIDTH : 0)).current;
  const router = useRouter();
  const segments = useSegments();
  const { user, role } = useAuth();
  const { t } = useLocalization();
  const isDriver = role === 'driver';
  const navItems = isDriver ? DRIVER_NAV_ITEMS : AGENT_NAV_ITEMS;

  useEffect(() => {
    if (isMobile) {
      if (isOpen) {
        slideAnim.setValue(-SIDEBAR_WIDTH);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      } else {
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
    }
  }, [isOpen, isMobile]);

  const handleNavPress = (route: string) => {
    if (isMobile) closeSidebar();
    router.push(route as any);
  };

  const handleLogout = async () => {
    if (isMobile) closeSidebar();
    await signOut();
    router.replace('/login');
  };

  const normalizedSegments = segments.filter((s) => !s.startsWith('('));
  const currentRoute = '/' + normalizedSegments.join('/');
  const isActive = (route: string) => {
    const cleanRoute = route.replace(/^\/\((?:agent|driver)\)/, '');
    if (cleanRoute === '/dashboard' && (currentRoute === '/dashboard' || currentRoute === '/' || currentRoute === '')) return true;
    if (cleanRoute !== '/dashboard' && currentRoute.startsWith(cleanRoute)) return true;
    return false;
  };

  const renderSidebarContent = (showCloseButton = false) => (
    <View style={styles.sidebarContainer}>
      <View style={styles.logoContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name="leaf" size={28} color={Colors.surface} />
          <Text style={styles.logoText}>AgriAgent</Text>
        </View>
        {showCloseButton && (
          <TouchableOpacity onPress={closeSidebar} style={styles.drawerCloseBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={Colors.surface} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.navContainer} showsVerticalScrollIndicator={false}>
        {navItems.map((item) => {
          const active = isActive(item.route);
          const trans = t(item.nameKey, { defaultValue: item.fallback });
          const label = (!trans || (typeof trans === 'string' && (trans.startsWith('[missing') || trans.includes('missing "'))))
            ? item.fallback
            : trans;
          return (
            <TouchableOpacity
              key={item.fallback}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => handleNavPress(item.route)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon as any}
                size={22}
                color={active ? Colors.surface : 'rgba(255, 255, 255, 0.7)'}
              />
              <Text style={[styles.navText, active && styles.navTextActive]}>
                {label}
              </Text>
              {!isDriver && item.fallback === 'Notifications' && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>3</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.profileSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color={'#FFFFFF'} />
          <Text style={styles.logoutText}>
            {isDriver ? 'Logout (Switch to Agent)' : (t('navigation.logout') || 'Logout')}
          </Text>
        </TouchableOpacity>
        <View style={styles.profileInfo}>
          <Ionicons name={isDriver ? "bicycle" : "person-circle"} size={36} color={Colors.surface} />
          <View style={styles.profileTexts}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.name || (isDriver ? user?.phone : user?.email?.split('@')[0]) || (isDriver ? 'Driver' : 'Agent User')}
            </Text>
            <Text style={styles.profileRole}>
              {isDriver ? 'Delivery Partner' : 'Field Agent'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (!isMobile) {
    return <View style={styles.desktopContainer}>{renderSidebarContent(false)}</View>;
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={closeSidebar}
      statusBarTranslucent
    >
      <View style={styles.modalWrapper}>
        <Pressable style={styles.modalOverlay} onPress={closeSidebar} />
        <Animated.View
          style={[
            styles.mobileContainer,
            { transform: [{ translateX: slideAnim }] }
          ]}
        >
          {renderSidebarContent(true)}
        </Animated.View>
      </View>
    </Modal>
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
  modalWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mobileContainer: {
    width: SIDEBAR_WIDTH,
    maxWidth: '85%',
    backgroundColor: Colors.primaryDark,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 100,
  },
  sidebarContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.surface,
    marginLeft: 10,
  },
  drawerCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    marginBottom: 6,
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  navText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.75)',
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
    paddingTop: 12,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    marginBottom: 10,
  },
  logoutText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 10,
    fontWeight: '700',
    flex: 1,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  profileTexts: {
    marginLeft: 10,
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.surface,
  },
  profileRole: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});


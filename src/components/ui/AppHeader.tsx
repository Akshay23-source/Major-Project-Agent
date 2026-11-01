import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useSidebar } from '../../providers/SidebarProvider';
import { useRouter } from 'expo-router';
import { getSession, signOut } from '../../lib/api';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  unreadCount?: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  onNotificationPress,
  onProfilePress,
  unreadCount = 0
}) => {
  const { toggleSidebar } = useSidebar();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [showAccountModal, setShowAccountModal] = useState(false);

  const session = getSession();
  const isDriver = session?.role === 'driver';

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
      return;
    }
    setShowAccountModal(true);
  };

  const handleSettingsPress = () => {
    if (isDriver) {
      setShowAccountModal(true);
    } else {
      router.push('/settings' as any);
    }
  };

  const handleLogout = async () => {
    setShowAccountModal(false);
    await signOut();
    router.replace('/login');
  };

  return (
    <>
      <View style={styles.header}>
        {isMobile && (
          <TouchableOpacity 
            style={styles.menuButton} 
            onPress={toggleSidebar}
            activeOpacity={0.7}
            accessibilityLabel="Open menu"
          >
            <Ionicons name="menu" size={28} color={Colors.primaryDark} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleProfilePress} style={[styles.titleContainer, !isMobile && { marginLeft: 0 }]}>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.iconButton} onPress={onNotificationPress} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={24} color={Colors.primaryDark} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { marginLeft: 10 }]} onPress={handleSettingsPress} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={24} color={Colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { marginLeft: 10 }]} onPress={handleProfilePress} activeOpacity={0.7}>
            <Ionicons name="person-circle-outline" size={28} color={Colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.logoutQuickButton, { marginLeft: 10 }]} 
            onPress={handleLogout}
            activeOpacity={0.7}
            accessibilityLabel="Logout"
          >
            <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Account / Switch Role Modal */}
      <Modal
        visible={showAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAccountModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAccountModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalAvatar}>
                <Ionicons name={isDriver ? "bicycle" : "person"} size={26} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalUserName}>
                  {session?.user?.name || (isDriver ? session?.user?.phone : session?.user?.email?.split('@')[0]) || 'User'}
                </Text>
                <View style={[styles.roleBadge, isDriver ? styles.driverRoleBadge : styles.agentRoleBadge]}>
                  <Text style={styles.roleBadgeText}>
                    {isDriver ? 'Delivery Partner (Driver)' : 'Field Agent (Agent)'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowAccountModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {session?.user?.phone ? (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.infoText}>{session.user.phone}</Text>
                </View>
              ) : null}
              {session?.user?.email ? (
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.infoText}>{session.user.email}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.switchButton} onPress={handleLogout} activeOpacity={0.8}>
                <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
                <Text style={styles.switchButtonText}>
                  {isDriver ? 'Switch to Agent Mode (Logout)' : 'Switch to Driver Mode (Logout)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAccountModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  menuButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    position: 'relative',
  },
  logoutQuickButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.error,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.surface,
    fontSize: 9,
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  roleBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  driverRoleBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  agentRoleBadge: {
    backgroundColor: 'rgba(11, 143, 60, 0.15)',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    marginBottom: 20,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modalActions: {
    gap: 10,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  switchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});


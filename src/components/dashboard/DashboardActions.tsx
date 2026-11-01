import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '../../theme/colors';
import { Role } from '../../lib/api';
import { useRouter } from 'expo-router';
import { acceptDelivery } from '../../services/driver/deliveries';
import { api } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

interface DashboardActionsProps {
  role: Role;
  orderId: string;
  status: string;
  onRefresh?: () => void;
}

export default function DashboardActions({ role, orderId, status, onRefresh }: DashboardActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);

  const handleAccept = async () => {
    setBusy(true);
    try {
      await acceptDelivery(orderId);
      Alert.alert(
        '✅ Order Accepted',
        'You have successfully accepted this delivery.',
        [
          {
            text: 'View Delivery',
            onPress: () => router.push(`/(driver)/deliveries/${orderId}` as any),
          },
          { text: 'OK', onPress: onRefresh },
        ]
      );
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not accept this order. It may have been taken.');
      onRefresh?.();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Order',
      'Reject this order? It will be available for other drivers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              await api.post(`/driver/deliveries/${orderId}/reject`, { reason: 'Declined by driver' });
              Alert.alert('Rejected', 'Order has been returned to the queue.');
              onRefresh?.();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not reject this order.');
            } finally {
              setRejecting(false);
            }
          },
        },
      ]
    );
  };

  if (role === 'agent') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.btn, { borderColor: Colors.primary }]}
          onPress={() => router.push(`/(agent)/deliveries/${orderId}` as any)}
        >
          <Ionicons name="eye-outline" size={13} color={Colors.primary} />
          <Text style={[styles.btnText, { color: Colors.primary }]}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Driver role
  const isAvailable = ['ASSIGNED', 'PENDING'].includes(status);
  const isActive = ['ACCEPTED', 'DRIVER_EN_ROUTE', 'ARRIVED_AT_FARM', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'OUT_FOR_DELIVERY'].includes(status);

  return (
    <View style={styles.container}>
      {isAvailable && (
        <>
          <TouchableOpacity
            style={[styles.btn, { borderColor: Colors.error }, (busy || rejecting) && { opacity: 0.5 }]}
            onPress={handleReject}
            disabled={busy || rejecting}
          >
            {rejecting ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <>
                <Ionicons name="close-outline" size={13} color={Colors.error} />
                <Text style={[styles.btnText, { color: Colors.error }]}>Reject</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptBtn, (busy || rejecting) && { opacity: 0.5 }]}
            onPress={handleAccept}
            disabled={busy || rejecting}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={13} color="#fff" />
                <Text style={styles.acceptBtnText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      {(isActive || status === 'DELIVERED') && (
        <TouchableOpacity
          style={[styles.btn, { borderColor: Colors.primary, flex: 1 }]}
          onPress={() => router.push(`/(driver)/deliveries/${orderId}` as any)}
        >
          <Ionicons name="arrow-forward-outline" size={13} color={Colors.primary} />
          <Text style={[styles.btnText, { color: Colors.primary }]}>
            {status === 'DELIVERED' ? 'View Details' : 'Open Delivery'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});

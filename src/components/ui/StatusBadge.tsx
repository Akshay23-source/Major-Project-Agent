import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

export type StatusType = 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Success' | 'Warning' | 'Error';

interface StatusBadgeProps {
  status: StatusType | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusColor = (statusName: string) => {
    switch (statusName.toLowerCase()) {
      case 'delivered':
      case 'success':
        return Colors.success;
      case 'processing':
      case 'shipped':
      case 'info':
        return Colors.info;
      case 'pending':
      case 'warning':
        return Colors.warning;
      case 'cancelled':
      case 'error':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const color = getStatusColor(status);

  return (
    <View style={[styles.badge, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  }
});

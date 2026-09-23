import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OrdersData {
  total: number;
  Pending: number;
  Processing: number;
  Shipped: number;
  Delivered: number;
  Cancelled: number;
}

interface OrdersOverviewChartProps {
  data: OrdersData;
}

import { useLocalization } from '../../hooks/useLocalization';

const STATUS_COLORS = {
  Pending: Colors.warning,
  Processing: Colors.info,
  Shipped: Colors.primaryLight,
  Delivered: Colors.success,
  Cancelled: Colors.error,
};

export const OrdersOverviewChart: React.FC<OrdersOverviewChartProps> = ({ data }) => {
  const size = 160;
  const strokeWidth = 24;
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  
  const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
  
  const { t } = useLocalization();

  let currentOffset = 0;
  
  const chartData = statuses.map((status) => {
    const count = data[status];
    const percentage = data.total > 0 ? count / data.total : 0;
    const strokeDasharray = `${circumference * percentage} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    
    currentOffset += circumference * percentage;
    
    return {
      status,
      label: t(`dashboard.${status.toLowerCase()}`) || status,
      count,
      percentage,
      color: STATUS_COLORS[status],
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.chartContainer}>
        {data.total > 0 ? (
          <Svg width={size} height={size}>
            <G rotation="-90" origin={`${center}, ${center}`}>
              {chartData.map((item, index) => {
                if (item.count === 0) return null;
                return (
                  <Circle
                    key={index}
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={item.strokeDasharray}
                    strokeDashoffset={item.strokeDashoffset}
                    fill="transparent"
                  />
                );
              })}
            </G>
          </Svg>
        ) : (
          <View style={[styles.emptyChart, { width: size, height: size, borderRadius: center, borderWidth: strokeWidth }]}>
          </View>
        )}
        <View style={styles.centerTextContainer}>
          <Text style={styles.centerNumber}>{data.total}</Text>
          <Text style={styles.centerLabel}>{t('dashboard.totalOrders') ? t('dashboard.totalOrders').split(' ')[0] : 'Total'}</Text>
          <Text style={styles.centerLabel}>{t('dashboard.totalOrders') ? t('dashboard.totalOrders').split(' ')[1] : 'Orders'}</Text>
        </View>
      </View>

      <View style={styles.legendContainer}>
        {chartData.map((item) => (
          <View key={item.status} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text style={styles.legendStatus}>{item.label}</Text>
            </View>
            <View style={styles.legendRight}>
              <Text style={styles.legendCount}>{item.count}</Text>
              <Text style={styles.legendPercentage}>
                {data.total > 0 ? Math.round(item.percentage * 100) : 0}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: SCREEN_WIDTH > 400 ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  chartContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SCREEN_WIDTH > 400 ? 0 : 20,
  },
  emptyChart: {
    borderColor: Colors.border,
  },
  centerTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    lineHeight: 38,
  },
  centerLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  legendContainer: {
    flex: 1,
    marginLeft: SCREEN_WIDTH > 400 ? 20 : 0,
    width: '100%',
    maxWidth: 240,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '50',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendStatus: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendCount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    width: 30,
    textAlign: 'right',
  },
  legendPercentage: {
    fontSize: 13,
    color: Colors.textLight,
    width: 40,
    textAlign: 'right',
  },
});

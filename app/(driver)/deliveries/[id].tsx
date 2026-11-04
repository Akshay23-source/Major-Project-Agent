import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "../../../src/theme/colors";
import { getDeliveryDetails, transitionDriverStatus, acceptDelivery, rejectDelivery, DriverDeliveryStatus } from "../../../src/services/driver/deliveries";
import { startLocationTracking, stopLocationTracking } from "../../../src/services/driver/locationTracking";
import { useLocalization } from "../../../src/hooks/useLocalization";
import * as Linking from "expo-linking";

const TRACKING_STAGES = [
  { key: 'placed', label: 'Placed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'reached', label: 'Reached' },
  { key: 'delivered', label: 'Delivered' },
];

function getStageIndex(status?: string): number {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'DELIVERED': return 5;
    case 'ARRIVED_AT_DESTINATION':
    case 'NEAR_DESTINATION': return 4;
    case 'OUT_FOR_DELIVERY':
    case 'IN_TRANSIT': return 3;
    case 'PICKED_UP':
    case 'ARRIVED_AT_FARM': return 2;
    case 'ACCEPTED':
    case 'DRIVER_EN_ROUTE':
    case 'PICKUP_ASSIGNED': return 1;
    default: return 0;
  }
}

export default function DeliveryDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLocalization();
  
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Proof of Delivery State
  const [podVisible, setPodVisible] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  // Start GPS tracking automatically if this delivery is already in an active state
  useEffect(() => {
    if (!delivery) return;
    const activeStatuses = ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'OUT_FOR_DELIVERY'];
    if (activeStatuses.includes(delivery.logistics_tracking_status)) {
      startLocationTracking(id);
    }
    // Stop tracking when this screen unmounts (delivery completed or navigated away)
    return () => {
      stopLocationTracking();
    };
  }, [delivery?.logistics_tracking_status]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDeliveryDetails(id);
      setDelivery(data);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not load delivery details");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDelivery = async () => {
    setProcessing(true);
    try {
      await acceptDelivery(id);
      Alert.alert("✅ Order Accepted", "You have accepted this delivery. Proceed to pickup.");
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not accept delivery");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectDelivery = async () => {
    Alert.alert(
      'Decline Order',
      'Are you sure you want to decline this order? It will return to the queue for other delivery partners.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await rejectDelivery(id, 'Declined by driver');
              Alert.alert('Declined', 'Order returned to queue.');
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not decline order');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const getNextStateButton = () => {
    if (!delivery) return null;
    const status = delivery.logistics_tracking_status;
    let nextStatus: DriverDeliveryStatus | null = null;
    let label = "";

    // If unassigned or pending pickup assignment, allow driver to Accept or Reject
    if (status === 'PENDING' || status === 'AWAITING_PICKUP' || status === 'ASSIGNED' || !delivery.delivery_partner_id) {
      return (
        <View style={{ gap: 10 }}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleAcceptDelivery}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.actionButtonText}>Accept Delivery</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#DC2626' }]} 
            onPress={handleRejectDelivery}
            disabled={processing}
          >
            <Text style={styles.actionButtonText}>Decline / Reject</Text>
          </TouchableOpacity>
        </View>
      );
    }

    switch (status) {
      case 'ACCEPTED': nextStatus = 'DRIVER_EN_ROUTE'; label = t('driver.enRoute') || 'En Route to Farm'; break;
      case 'DRIVER_EN_ROUTE': nextStatus = 'ARRIVED_AT_FARM'; label = t('driver.arrivedAtFarm') || 'Arrived at Farm'; break;
      case 'ARRIVED_AT_FARM': nextStatus = 'PICKED_UP'; label = t('driver.pickedUp') || 'Picked Up'; break;
      case 'PICKED_UP': nextStatus = 'IN_TRANSIT'; label = t('driver.inTransit') || 'In Transit'; break;
      case 'IN_TRANSIT': nextStatus = 'ARRIVED_AT_DESTINATION'; label = t('driver.arrivedAtDestination') || 'Arrived at Destination'; break;
      case 'ARRIVED_AT_DESTINATION': nextStatus = 'OUT_FOR_DELIVERY'; label = "Out for Delivery"; break;
      case 'OUT_FOR_DELIVERY': 
        return (
          <TouchableOpacity style={styles.actionButton} onPress={() => setPodVisible(true)}>
            <Text style={styles.actionButtonText}>{t('driver.delivered') || 'Confirm Delivery'}</Text>
          </TouchableOpacity>
        );
      case 'DELIVERED':
        return (
          <View style={[styles.actionButton, styles.disabledButton]}>
            <Text style={styles.actionButtonText}>Completed</Text>
          </View>
        );
    }

    if (nextStatus) {
      return (
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => handleTransition(nextStatus)}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.actionButtonText}>Mark as: {label}</Text>
          )}
        </TouchableOpacity>
      );
    }
    return null;
  };

  const handleTransition = async (newStatus: DriverDeliveryStatus, notes?: string) => {
    setProcessing(true);
    try {
      await transitionDriverStatus(id, delivery.logistics_tracking_status, newStatus, notes);
      await loadData();
      if (newStatus === 'ACCEPTED') {
        Alert.alert("Order Accepted", "You have accepted this delivery assignment.");
      } else if (newStatus === 'PICKED_UP') {
        // Start real GPS tracking after pickup confirmation
        startLocationTracking(id);
        Alert.alert("Pickup Confirmed", "Goods picked up successfully. Live GPS tracking has started.");
      } else if (newStatus === 'DELIVERED') {
        // Stop GPS tracking on delivery
        stopLocationTracking();
        Alert.alert("Delivery Successful", "Order delivered successfully. Customer verification is now pending.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setProcessing(false);
      setPodVisible(false);
    }
  };

  const openMap = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  };

  const openPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  if (loading || !delivery) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const order = delivery.orders;
  const farmer = order?.farmers;
  const buyer = order?.buyers;

  const farmerName = farmer?.name || order?.pickup_contact_name || 'Farmer / Supplier';
  const farmerPhone = farmer?.phone || order?.pickup_contact_phone;
  const farmerAddress = [farmer?.address, farmer?.village].filter(Boolean).join(', ') || order?.pickup_address || 'Farm location';

  const buyerName = buyer?.name || order?.customer_name || 'Customer / Buyer';
  const buyerPhone = buyer?.phone || order?.customer_phone;
  const buyerAddress = [buyer?.address, buyer?.pincode].filter(Boolean).join(', ') || order?.delivery_location || 'Customer destination';

  const trackingId = delivery.tracking_id || order?.tracking_id;
  const currentStageIdx = getStageIndex(delivery.logistics_tracking_status);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Order #{order?.order_number || delivery.delivery_number}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Tracking Banner & Status */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{delivery.logistics_tracking_status}</Text>
          {trackingId ? (
            <Text style={{ fontSize: 12, color: Colors.primaryDark, marginTop: 4, fontWeight: '600' }}>
              Tracking ID: {trackingId}
            </Text>
          ) : null}
        </View>

        {/* Tracking Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Delivery Progress</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineScroll}>
            {TRACKING_STAGES.map((stage, idx) => {
              const isCompleted = idx <= currentStageIdx;
              const isCurrent = idx === currentStageIdx;
              return (
                <View key={stage.key} style={styles.timelineStepWrap}>
                  <View style={styles.stepTopRow}>
                    <View style={[
                      styles.stepCircle,
                      isCompleted && styles.stepCircleCompleted,
                      isCurrent && styles.stepCircleCurrent
                    ]}>
                      {isCompleted && !isCurrent ? (
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      ) : (
                        <View style={[styles.innerDot, isCurrent && styles.innerDotActive]} />
                      )}
                    </View>
                    {idx < TRACKING_STAGES.length - 1 && (
                      <View style={[
                        styles.stepConnector,
                        idx < currentStageIdx && styles.stepConnectorCompleted
                      ]} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    isCurrent && styles.stepLabelCurrent,
                    isCompleted && styles.stepLabelCompleted
                  ]}>
                    {stage.label}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {getNextStateButton()}
        </View>

        {/* Delivery Instructions / Notes */}
        {(order?.notes || delivery.notes) ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Instructions</Text>
            <Text style={styles.notesText}>{order?.notes || delivery.notes}</Text>
          </View>
        ) : null}

        {/* Order Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Product:</Text>
            <Text style={styles.value}>{order?.product || 'Produce'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Quantity:</Text>
            <Text style={styles.value}>{order?.quantity} {order?.unit}</Text>
          </View>
          {order?.total_amount ? (
            <View style={styles.row}>
              <Text style={styles.label}>Amount:</Text>
              <Text style={[styles.value, { fontWeight: 'bold' }]}>₹{order.total_amount} ({order.payment_status || 'PAID'})</Text>
            </View>
          ) : null}
          {order?.is_perishable && <Text style={styles.tagError}>Perishable</Text>}
          {order?.is_fragile && <Text style={styles.tagWarning}>Fragile</Text>}
        </View>

        {/* Pickup Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup (Farmer / Supplier)</Text>
          <Text style={styles.contactName}>{farmerName}</Text>
          <Text style={styles.address}>{farmerAddress}</Text>
          
          <View style={styles.actionRow}>
            {farmerPhone ? (
              <TouchableOpacity style={styles.iconButton} onPress={() => openPhone(farmerPhone)}>
                <Ionicons name="call" size={20} color={Colors.primary} />
                <Text style={styles.iconButtonText}>Call</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.iconButton} onPress={() => openMap(farmerAddress)}>
              <Ionicons name="navigate" size={20} color={Colors.primary} />
              <Text style={styles.iconButtonText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dropoff Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Drop-off (Customer)</Text>
          <Text style={styles.contactName}>{buyerName}</Text>
          <Text style={styles.address}>{buyerAddress}</Text>
          
          <View style={styles.actionRow}>
            {buyerPhone ? (
              <TouchableOpacity style={styles.iconButton} onPress={() => openPhone(buyerPhone)}>
                <Ionicons name="call" size={20} color={Colors.primary} />
                <Text style={styles.iconButtonText}>Call</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.iconButton} onPress={() => openMap(buyerAddress)}>
              <Ionicons name="navigate" size={20} color={Colors.primary} />
              <Text style={styles.iconButtonText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Proof of Delivery Modal */}
      <Modal visible={podVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('driver.proofOfDelivery')}</Text>
            
            <Text style={styles.label}>{t('driver.recipientName')}</Text>
            <TextInput 
              style={styles.input} 
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="e.g. John Doe"
            />

            <Text style={styles.label}>{t('driver.deliveryNotes')}</Text>
            <TextInput 
              style={[styles.input, { height: 80 }]} 
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              placeholder="Any issues or comments?"
              multiline
            />

            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={() => handleTransition('DELIVERED', `Recipient: ${recipientName}\nNotes: ${deliveryNotes}`)}
              disabled={processing || !recipientName}
            >
              {processing ? (
                <ActivityIndicator color={Colors.surface} />
              ) : (
                <Text style={styles.confirmButtonText}>{t('driver.confirmDelivery')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setPodVisible(false)}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 4 },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.primaryDark },
  
  content: { padding: 16, paddingBottom: 40 },
  
  statusBadge: { alignSelf: 'center', backgroundColor: '#E6F4EA', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 24 },
  statusText: { color: Colors.success, fontWeight: 'bold', fontSize: 16 },

  actionContainer: { marginBottom: 24 },
  actionButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  actionButtonText: { color: Colors.surface, fontSize: 18, fontWeight: 'bold' },
  disabledButton: { backgroundColor: Colors.textLight, shadowOpacity: 0 },

  card: { backgroundColor: Colors.surface, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.textSecondary, marginBottom: 12 },
  
  row: { flexDirection: 'row', marginBottom: 8 },
  label: { width: 100, fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  value: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '500' },

  tagError: { backgroundColor: '#FEE2E2', color: Colors.error, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  tagWarning: { backgroundColor: '#FEF3C7', color: Colors.warning, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: 'bold', marginTop: 4 },

  contactName: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  address: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  
  actionRow: { flexDirection: 'row', gap: 12 },
  iconButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', paddingVertical: 10, borderRadius: 8, gap: 8 },
  iconButtonText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.primaryDark, marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20, backgroundColor: Colors.background },
  confirmButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  confirmButtonText: { color: Colors.surface, fontSize: 18, fontWeight: 'bold' },
  cancelButton: { paddingVertical: 16, alignItems: 'center' },
  cancelButtonText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },

  timelineCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  timelineTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.text, marginBottom: 12 },
  timelineScroll: { paddingVertical: 4, alignItems: 'center' },
  timelineStepWrap: { alignItems: 'center', width: 90 },
  stepTopRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  stepCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  stepCircleCompleted: { backgroundColor: Colors.primary },
  stepCircleCurrent: { backgroundColor: Colors.primary, borderWidth: 2, borderColor: '#FFFFFF' },
  innerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9CA3AF' },
  innerDotActive: { backgroundColor: '#FFFFFF' },
  stepConnector: { position: 'absolute', right: -45, left: 45, height: 2, backgroundColor: '#E5E7EB', zIndex: 1 },
  stepConnectorCompleted: { backgroundColor: Colors.primary },
  stepLabel: { fontSize: 11, color: Colors.textLight, marginTop: 6, textAlign: 'center', fontWeight: '500' },
  stepLabelCurrent: { color: Colors.primaryDark, fontWeight: 'bold' },
  stepLabelCompleted: { color: Colors.text },
  notesText: { fontSize: 14, color: Colors.text, lineHeight: 20 }
});

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
import { getDeliveryDetails, transitionDriverStatus, DriverDeliveryStatus } from "../../../src/services/driver/deliveries";
import { useLocalization } from "../../../src/hooks/useLocalization";
import * as Linking from "expo-linking";

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

  const getNextStateButton = () => {
    if (!delivery) return null;
    const status = delivery.logistics_tracking_status;
    let nextStatus: DriverDeliveryStatus | null = null;
    let label = "";

    switch (status) {
      case 'ASSIGNED': nextStatus = 'ACCEPTED'; label = t('driver.accepted'); break;
      case 'ACCEPTED': nextStatus = 'DRIVER_EN_ROUTE'; label = t('driver.enRoute'); break;
      case 'DRIVER_EN_ROUTE': nextStatus = 'ARRIVED_AT_FARM'; label = t('driver.arrivedAtFarm'); break;
      case 'ARRIVED_AT_FARM': nextStatus = 'PICKED_UP'; label = t('driver.pickedUp'); break;
      case 'PICKED_UP': nextStatus = 'IN_TRANSIT'; label = t('driver.inTransit'); break;
      case 'IN_TRANSIT': nextStatus = 'ARRIVED_AT_DESTINATION'; label = t('driver.arrivedAtDestination'); break;
      case 'ARRIVED_AT_DESTINATION': nextStatus = 'OUT_FOR_DELIVERY'; label = "Out for Delivery"; break;
      case 'OUT_FOR_DELIVERY': 
        return (
          <TouchableOpacity style={styles.actionButton} onPress={() => setPodVisible(true)}>
            <Text style={styles.actionButtonText}>{t('driver.delivered')}</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Order #{order?.order_number}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Status Badge */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{delivery.logistics_tracking_status}</Text>
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {getNextStateButton()}
        </View>

        {/* Order Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Product:</Text>
            <Text style={styles.value}>{order?.product}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Quantity:</Text>
            <Text style={styles.value}>{order?.quantity} {order?.unit}</Text>
          </View>
          {order?.is_perishable && <Text style={styles.tagError}>Perishable</Text>}
          {order?.is_fragile && <Text style={styles.tagWarning}>Fragile</Text>}
        </View>

        {/* Pickup Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup (Farmer)</Text>
          <Text style={styles.contactName}>{farmer?.name}</Text>
          <Text style={styles.address}>{farmer?.address}, {farmer?.village}</Text>
          
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.iconButton} onPress={() => openPhone(farmer?.phone)}>
              <Ionicons name="call" size={20} color={Colors.primary} />
              <Text style={styles.iconButtonText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => openMap(`${farmer?.address} ${farmer?.village}`)}>
              <Ionicons name="navigate" size={20} color={Colors.primary} />
              <Text style={styles.iconButtonText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dropoff Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Drop-off (Customer)</Text>
          <Text style={styles.contactName}>{buyer?.name}</Text>
          <Text style={styles.address}>{buyer?.address}, {buyer?.pincode}</Text>
          
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.iconButton} onPress={() => openPhone(buyer?.phone)}>
              <Ionicons name="call" size={20} color={Colors.primary} />
              <Text style={styles.iconButtonText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => openMap(`${buyer?.address} ${buyer?.pincode}`)}>
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
  cancelButtonText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' }
});

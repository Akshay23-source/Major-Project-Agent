import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getDeliveryById, updateDelivery } from '../../../src/services/deliveries';
import { Colors } from '../../../src/theme/colors';

export default function EditDeliveryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [delivery, setDelivery] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [eta, setEta] = useState('');
  const [notes, setNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDeliveryById(id as string);
      setDelivery(data);
      if (data) {
        setEta(data.eta || '');
        setNotes(data.notes || '');
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load delivery details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateDelivery(id as string, {
        eta: eta || undefined,
        notes: notes || undefined
      });
      
      if (result) {
        Alert.alert("Success", "Delivery updated successfully.", [
          { text: "OK", onPress: () => router.back() }
        ]);
      } else {
        Alert.alert("Error", "Failed to update delivery.");
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!delivery) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>Delivery not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Delivery Info</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery {delivery.delivery_number}</Text>
          <Text style={styles.subtext}>Product: {delivery.orders?.product}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Estimated Time of Arrival (ETA)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Today 5 PM, Tomorrow Morning"
              value={eta}
              onChangeText={setEta}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Delivery Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Special instructions for the delivery executive..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  errorText: { fontSize: 18, color: Colors.text, marginTop: 16 },
  backBtn: { marginTop: 24, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 },
  backBtnText: { color: Colors.surface, fontWeight: 'bold' },
  
  content: { padding: 16, paddingBottom: 40 },
  
  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 4 },
  subtext: { fontSize: 14, color: Colors.textSecondary },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: Colors.text },
  textArea: { minHeight: 100 },

  saveBtn: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 }
});

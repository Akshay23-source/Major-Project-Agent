import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { getFarmerById, updateFarmer, Farmer } from '../../../src/services/farmers';
import { Colors } from '../../../src/theme/colors';

export default function EditFarmerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    village: '',
    district: '',
    state: '',
    pincode: '',
    farm_name: '',
    land_size: '',
    farm_size_unit: 'Acres',
    verification_status: 'Pending' as 'Verified' | 'Pending' | 'Rejected',
    main_crops: '',
    notes: ''
  });

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const fData = await getFarmerById(id as string);
      if (fData) {
        setForm({
          name: fData.name || '',
          phone: fData.phone || '',
          email: fData.email || '',
          address: fData.address || '',
          village: fData.village || '',
          district: fData.district || '',
          state: fData.state || '',
          pincode: fData.pincode || '',
          farm_name: fData.farm_name || '',
          land_size: fData.land_size || '',
          farm_size_unit: fData.farm_size_unit || 'Acres',
          verification_status: fData.verification_status || 'Pending',
          main_crops: fData.main_crops || '',
          notes: fData.notes || ''
        });
      } else {
        Alert.alert("Error", "Farmer not found.");
        router.back();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.village || !form.district) {
      Alert.alert("Validation Error", "Name, Phone, Village, and District are required.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateFarmer(id as string, form);
      if (result) {
        Alert.alert("Success", "Farmer updated successfully.");
        router.back();
      } else {
        Alert.alert("Error", "Failed to update farmer.");
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} disabled={saving}>
          <Ionicons name="close" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Farmer</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.formContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(t) => updateForm('name', t)} />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={(t) => updateForm('phone', t)} keyboardType="phone-pad" />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(t) => updateForm('email', t)} keyboardType="email-address" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={(t) => updateForm('address', t)} />
          </View>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Village *</Text>
              <TextInput style={styles.input} value={form.village} onChangeText={(t) => updateForm('village', t)} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>District *</Text>
              <TextInput style={styles.input} value={form.district} onChangeText={(t) => updateForm('district', t)} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>State</Text>
              <TextInput style={styles.input} value={form.state} onChangeText={(t) => updateForm('state', t)} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Pincode</Text>
              <TextInput style={styles.input} value={form.pincode} onChangeText={(t) => updateForm('pincode', t)} keyboardType="phone-pad" maxLength={6} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farming Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Farm Name</Text>
            <TextInput style={styles.input} value={form.farm_name} onChangeText={(t) => updateForm('farm_name', t)} placeholder="e.g. Green Valley Farm" />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Farm Size</Text>
              <TextInput style={styles.input} value={form.land_size} onChangeText={(t) => updateForm('land_size', t)} keyboardType="numeric" />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Size Unit</Text>
              <TextInput style={styles.input} value={form.farm_size_unit} onChangeText={(t) => updateForm('farm_size_unit', t)} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Main Crops</Text>
            <TextInput style={styles.input} value={form.main_crops} onChangeText={(t) => updateForm('main_crops', t)} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              value={form.notes} 
              onChangeText={(t) => updateForm('notes', t)} 
              multiline 
              numberOfLines={4} 
            />
          </View>
        </View>

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Status</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {(["Verified", "Pending", "Rejected"] as const).map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#DCE5DD', backgroundColor: '#FAFCFA' },
                  form.verification_status === status && { backgroundColor: '#15803D', borderColor: '#15803D' }
                ]}
                onPress={() => updateForm('verification_status', status)}
              >
                <Text style={[{ color: '#374151', fontWeight: '600' }, form.verification_status === status && { color: '#FFF' }]}>{status}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 4 },
  title: { fontSize: 18, fontWeight: "bold", color: Colors.text },
  saveButton: { padding: 4, minWidth: 50, alignItems: 'flex-end' },
  saveText: { fontSize: 16, fontWeight: "bold", color: Colors.primary },
  formContainer: { padding: 16 },
  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: Colors.text, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  row: { flexDirection: 'row' },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: Colors.text, backgroundColor: Colors.background },
  textArea: { height: 100, textAlignVertical: 'top' },
});

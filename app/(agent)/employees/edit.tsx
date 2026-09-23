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
import { getEmployeeById, updateEmployee, Employee } from '../../../src/services/employees';
import { Colors } from '../../../src/theme/colors';

export default function EditEmployeeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    assigned_area: '',
    emergency_contact: '',
    notes: '',
    status: 'Active' as Employee['status']
  });

  const roles = ['Delivery Executive', 'Field Agent', 'Warehouse Staff', 'Support Staff', 'Other'];
  const statuses = ['Active', 'On Leave', 'Inactive'] as Employee['status'][];

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const empData = await getEmployeeById(id as string);
      if (empData) {
        setForm({
          name: empData.name || '',
          phone: empData.phone || '',
          email: empData.email || '',
          role: empData.role || 'Delivery Executive',
          address: empData.address || '',
          city: empData.city || '',
          state: empData.state || '',
          pincode: empData.pincode || '',
          assigned_area: empData.assigned_area || '',
          emergency_contact: empData.emergency_contact || '',
          notes: empData.notes || '',
          status: empData.status || 'Active'
        });
      } else {
        Alert.alert("Error", "Employee not found.");
        router.back();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.role || !form.assigned_area) {
      Alert.alert("Validation Error", "Name, Phone, Role, and Assigned Area are required.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateEmployee(id as string, form);
      if (result) {
        Alert.alert("Success", "Employee updated successfully.");
        router.back();
      } else {
        Alert.alert("Error", "Failed to update employee.");
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
        <Text style={styles.title}>Edit Employee</Text>
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
          <Text style={styles.sectionTitle}>Job Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Role *</Text>
            <View style={styles.chipContainer}>
              {roles.map(r => (
                <TouchableOpacity 
                  key={r} 
                  style={[styles.chip, form.role === r && styles.chipSelected]}
                  onPress={() => updateForm('role', r)}
                >
                  <Text style={[styles.chipText, form.role === r && styles.chipTextSelected]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Assigned Area *</Text>
            <TextInput style={styles.input} value={form.assigned_area} onChangeText={(t) => updateForm('assigned_area', t)} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.chipContainer}>
              {statuses.map(s => (
                <TouchableOpacity 
                  key={s} 
                  style={[styles.chip, form.status === s && styles.chipSelected]}
                  onPress={() => updateForm('status', s)}
                >
                  <Text style={[styles.chipText, form.status === s && styles.chipTextSelected]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact & Notes</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={(t) => updateForm('address', t)} />
          </View>
          
          <View style={{ flexDirection: 'row' }}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput style={styles.input} value={form.city} onChangeText={(t) => updateForm('city', t)} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>State</Text>
              <TextInput style={styles.input} value={form.state} onChangeText={(t) => updateForm('state', t)} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pincode</Text>
            <TextInput style={styles.input} value={form.pincode} onChangeText={(t) => updateForm('pincode', t)} keyboardType="numeric" maxLength={6} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Emergency Contact</Text>
            <TextInput style={styles.input} value={form.emergency_contact} onChangeText={(t) => updateForm('emergency_contact', t)} />
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
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: Colors.text, backgroundColor: Colors.background },
  textArea: { height: 100, textAlignVertical: 'top' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontWeight: "500" },
  chipTextSelected: { color: Colors.surface, fontWeight: "600" }
});

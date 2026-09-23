import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { createEmployee } from '../../../src/services/employees';
import { Colors } from '../../../src/theme/colors';

export default function AddEmployeeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'Delivery Executive',
    address: '',
    city: '',
    state: '',
    pincode: '',
    assigned_area: '',
    joining_date: new Date().toISOString().split('T')[0],
    emergency_contact: '',
    notes: '',
    status: 'Active' as const
  });

  const roles = ['Delivery Executive', 'Field Agent', 'Warehouse Staff', 'Support Staff', 'Other'];
  const statuses = ['Active', 'On Leave', 'Inactive'];

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.role || !form.assigned_area) {
      Alert.alert("Validation Error", "Name, Phone, Role, and Assigned Area are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await createEmployee(form);
      if (result) {
        Alert.alert("Success", "Employee added successfully.");
        router.back();
      } else {
        Alert.alert("Error", "Failed to add employee to database.");
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} disabled={loading}>
          <Ionicons name="close" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Add New Employee</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={loading}>
          {loading ? (
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
            <TextInput style={styles.input} value={form.name} onChangeText={(t) => updateForm('name', t)} placeholder="e.g. Rahul Kumar" />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={(t) => updateForm('phone', t)} placeholder="+91" keyboardType="phone-pad" />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(t) => updateForm('email', t)} placeholder="email@example.com" keyboardType="email-address" />
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
            <TextInput style={styles.input} value={form.assigned_area} onChangeText={(t) => updateForm('assigned_area', t)} placeholder="e.g. Yelahanka" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Joining Date</Text>
            <TextInput style={styles.input} value={form.joining_date} onChangeText={(t) => updateForm('joining_date', t)} placeholder="YYYY-MM-DD" />
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
            <TextInput style={styles.input} value={form.address} onChangeText={(t) => updateForm('address', t)} placeholder="Full address" />
          </View>
          
          <View style={{ flexDirection: 'row' }}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput style={styles.input} value={form.city} onChangeText={(t) => updateForm('city', t)} placeholder="City" />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>State</Text>
              <TextInput style={styles.input} value={form.state} onChangeText={(t) => updateForm('state', t)} placeholder="State" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pincode</Text>
            <TextInput style={styles.input} value={form.pincode} onChangeText={(t) => updateForm('pincode', t)} placeholder="Pincode" keyboardType="numeric" maxLength={6} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Emergency Contact</Text>
            <TextInput style={styles.input} value={form.emergency_contact} onChangeText={(t) => updateForm('emergency_contact', t)} placeholder="Name - Phone" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              value={form.notes} 
              onChangeText={(t) => updateForm('notes', t)} 
              placeholder="Any additional information..."
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

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
import { createBuyer } from '../../../src/services/buyers';
import { Colors } from '../../../src/theme/colors';

export default function AddBuyerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    company_name: '',
    buyer_type: 'individual',
    status: 'Active',
    notes: ''
  });

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.city) {
      Alert.alert("Validation Error", "Name, Phone, and City are required.");
      return;
    }

    setLoading(true);
    try {
      const location = `${form.address ? form.address + ', ' : ''}${form.city}, ${form.state}${form.pincode ? ' - ' + form.pincode : ''}`;
      const buyerData = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        company_name: form.company_name,
        buyer_type: form.buyer_type,
        status: form.status,
        type: form.buyer_type, // For backwards compatibility
        location: location, // For backwards compatibility
        notes: form.notes
      };

      const result = await createBuyer(buyerData);
      if (result) {
        Alert.alert("Success", "Buyer added successfully.");
        router.back();
      } else {
        Alert.alert("Error", "Failed to save buyer to database.");
      }
    } catch (err) {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} disabled={loading}>
          <Ionicons name="close" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Add New Buyer</Text>
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
            <TextInput style={styles.input} value={form.name} onChangeText={(t) => updateForm('name', t)} placeholder="e.g. Ramesh" />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Company/Organization Name</Text>
            <TextInput style={styles.input} value={form.company_name} onChangeText={(t) => updateForm('company_name', t)} placeholder="e.g. Ramesh Traders" />
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
          <Text style={styles.sectionTitle}>Location</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={(t) => updateForm('address', t)} placeholder="Street name, building" />
          </View>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>City *</Text>
              <TextInput style={styles.input} value={form.city} onChangeText={(t) => updateForm('city', t)} placeholder="City" />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>State</Text>
              <TextInput style={styles.input} value={form.state} onChangeText={(t) => updateForm('state', t)} placeholder="State" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pincode</Text>
            <TextInput style={styles.input} value={form.pincode} onChangeText={(t) => updateForm('pincode', t)} placeholder="Pincode" keyboardType="phone-pad" maxLength={6} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buyer Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Buyer Type</Text>
            <View style={styles.typeSelector}>
              {['individual', 'retail', 'wholesale', 'restaurant', 'business'].map(type => (
                <TouchableOpacity 
                  key={type} 
                  style={[styles.typeOption, form.buyer_type === type && styles.typeOptionSelected]}
                  onPress={() => updateForm('buyer_type', type)}
                >
                  <Text style={[styles.typeText, form.buyer_type === type && styles.typeTextSelected]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.typeSelector}>
              {['Active', 'Inactive'].map(status => (
                <TouchableOpacity 
                  key={status} 
                  style={[styles.typeOption, form.status === status && styles.typeOptionSelected]}
                  onPress={() => updateForm('status', status)}
                >
                  <Text style={[styles.typeText, form.status === status && styles.typeTextSelected]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  typeOptionSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { color: Colors.textSecondary, fontWeight: "500" },
  typeTextSelected: { color: Colors.surface, fontWeight: "600" }
});

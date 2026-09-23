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
import { createFarmer } from '../../src/services/farmers';
import { Colors } from '../../src/theme/colors';

export default function AddFarmerScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    village: '',
    district: '',
    state: '',
    land_size: '',
    main_crops: '',
    notes: ''
  });

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.village || !form.district) {
      Alert.alert("Validation Error", "Name, Phone, Village, and District are required.");
      return;
    }

    setLoading(true);
    try {
      const farmerData = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        village: form.village,
        district: form.district,
        state: form.state,
        land_size: form.land_size,
        main_crops: form.main_crops,
        notes: form.notes
      };

      const result = await createFarmer(farmerData);
      if (result) {
        Alert.alert("Success", "Farmer added successfully.");
        router.back();
      } else {
        Alert.alert("Error", "Failed to save farmer to database.");
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
        <Text style={styles.title}>Add New Farmer</Text>
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
            <TextInput style={styles.input} value={form.name} onChangeText={(t) => updateForm('name', t)} placeholder="e.g. Suresh Patil" />
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
            <TextInput style={styles.input} value={form.address} onChangeText={(t) => updateForm('address', t)} placeholder="Street name, landmark" />
          </View>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Village *</Text>
              <TextInput style={styles.input} value={form.village} onChangeText={(t) => updateForm('village', t)} placeholder="Village" />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>District *</Text>
              <TextInput style={styles.input} value={form.district} onChangeText={(t) => updateForm('district', t)} placeholder="District" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>State</Text>
            <TextInput style={styles.input} value={form.state} onChangeText={(t) => updateForm('state', t)} placeholder="State" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farming Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Farm Size (Acres)</Text>
            <TextInput style={styles.input} value={form.land_size} onChangeText={(t) => updateForm('land_size', t)} placeholder="e.g. 5" keyboardType="numeric" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Main Crops</Text>
            <TextInput style={styles.input} value={form.main_crops} onChangeText={(t) => updateForm('main_crops', t)} placeholder="e.g. Tomato, Potato" />
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
  row: { flexDirection: 'row' },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: Colors.text, backgroundColor: Colors.background },
  textArea: { height: 100, textAlignVertical: 'top' },
});

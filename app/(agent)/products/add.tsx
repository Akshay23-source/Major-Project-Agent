import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
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
import { createProduct } from '../../../src/services/products';
import { getFarmers, Farmer } from '../../../src/services/farmers';
import { Colors } from '../../../src/theme/colors';
import { PRODUCT_CATEGORIES } from './index';

export const PRODUCT_UNITS = ['kg', 'quintal', 'ton', 'piece', 'dozen', 'litre', 'box', 'bag', 'Other'];

export default function AddProductScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [farmers, setFarmers] = useState<Farmer[]>([]);

  const [form, setForm] = useState({
    name: '',
    category: 'Vegetables',
    farmer_id: '',
    description: '',
    quantity: '',
    unit: 'kg',
    price: '',
    min_order_quantity: '',
    harvest_date: '',
    best_before_date: '',
    status: 'Active' as const,
    notes: ''
  });

  const statuses = ['Active', 'Inactive', 'Seasonal', 'Out of Stock'];

  useEffect(() => {
    const loadFarmers = async () => {
      try {
        const data = await getFarmers();
        setFarmers(data);
      } catch (err) {
        Alert.alert("Error", "Failed to load farmers.");
      } finally {
        setDataLoading(false);
      }
    };
    loadFarmers();
  }, []);

  const handleSave = async () => {
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.price);
    const minQty = parseFloat(form.min_order_quantity) || 0;

    if (!form.name || !form.category || !form.farmer_id || isNaN(qty) || isNaN(price)) {
      Alert.alert("Validation Error", "Name, Category, Farmer, Quantity, and Price are required.");
      return;
    }

    if (qty < 0 || price <= 0) {
      Alert.alert("Validation Error", "Quantity must be >= 0 and Price must be > 0.");
      return;
    }

    if (minQty > qty && qty > 0) {
      Alert.alert("Validation Error", "Minimum Order Quantity cannot exceed available quantity.");
      return;
    }

    setLoading(true);
    try {
      const result = await createProduct({
        ...form,
        quantity: qty,
        price: price,
        min_order_quantity: minQty
      });
      if (result) {
        Alert.alert("Success", "Product added successfully.");
        router.back();
      } else {
        Alert.alert("Error", "Failed to insert product into database.");
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

  if (dataLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} disabled={loading}>
          <Ionicons name="close" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Product</Text>
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
            <Text style={styles.label}>Product Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(t) => updateForm('name', t)} placeholder="e.g. Tomato" />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
              {PRODUCT_CATEGORIES.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.chip, form.category === cat && styles.chipSelected]}
                  onPress={() => updateForm('category', cat)}
                >
                  <Text style={[styles.chipText, form.category === cat && styles.chipTextSelected]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Farmer *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
              {farmers.map(f => (
                <TouchableOpacity 
                  key={f.id} 
                  style={[styles.chip, form.farmer_id === f.id && styles.chipSelected]}
                  onPress={() => updateForm('farmer_id', f.id)}
                >
                  <Text style={[styles.chipText, form.farmer_id === f.id && styles.chipTextSelected]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
              {farmers.length === 0 && <Text style={styles.noDataText}>No farmers available. Add a farmer first.</Text>}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              value={form.description} 
              onChangeText={(t) => updateForm('description', t)} 
              placeholder="Product description..."
              multiline 
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory & Pricing</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput style={styles.input} value={form.quantity} onChangeText={(t) => updateForm('quantity', t)} keyboardType="numeric" placeholder="0" />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput style={styles.input} value={form.price} onChangeText={(t) => updateForm('price', t)} keyboardType="numeric" placeholder="0.00" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unit *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
              {PRODUCT_UNITS.map(u => (
                <TouchableOpacity 
                  key={u} 
                  style={[styles.chip, form.unit === u && styles.chipSelected]}
                  onPress={() => updateForm('unit', u)}
                >
                  <Text style={[styles.chipText, form.unit === u && styles.chipTextSelected]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Minimum Order Quantity</Text>
            <TextInput style={styles.input} value={form.min_order_quantity} onChangeText={(t) => updateForm('min_order_quantity', t)} keyboardType="numeric" placeholder="Optional" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Product Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
              {statuses.map(s => (
                <TouchableOpacity 
                  key={s} 
                  style={[styles.chip, form.status === s && styles.chipSelected]}
                  onPress={() => updateForm('status', s)}
                >
                  <Text style={[styles.chipText, form.status === s && styles.chipTextSelected]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dates & Notes</Text>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Harvest Date</Text>
              <TextInput style={styles.input} value={form.harvest_date} onChangeText={(t) => updateForm('harvest_date', t)} placeholder="YYYY-MM-DD" />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Best Before</Text>
              <TextInput style={styles.input} value={form.best_before_date} onChangeText={(t) => updateForm('best_before_date', t)} placeholder="YYYY-MM-DD" />
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
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
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
  textArea: { height: 80, textAlignVertical: 'top' },
  horizontalSelect: { flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, marginRight: 8, height: 36, justifyContent: 'center' },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontWeight: "500" },
  chipTextSelected: { color: Colors.surface, fontWeight: "600" },
  noDataText: { color: Colors.textLight, fontStyle: 'italic', paddingVertical: 8 }
});

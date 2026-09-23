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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getProductById, updateProduct } from '../../../src/services/products';
import { Colors } from '../../../src/theme/colors';
import { PRODUCT_CATEGORIES } from './index';

export default function EditProductScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    min_order_quantity: '',
    harvest_date: '',
    best_before_date: '',
    status: 'Active' as any,
    notes: ''
  });

  const statuses = ['Active', 'Inactive', 'Seasonal', 'Out of Stock'];

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const data = await getProductById(id as string);
        if (data) {
          setForm({
            name: data.name || '',
            category: data.category || '',
            description: data.description || '',
            price: data.price?.toString() || '',
            min_order_quantity: data.min_order_quantity?.toString() || '',
            harvest_date: data.harvest_date || '',
            best_before_date: data.best_before_date || '',
            status: data.status || 'Active',
            notes: data.notes || ''
          });
        } else {
          Alert.alert("Error", "Product not found.");
          router.back();
        }
      } catch (err) {
        Alert.alert("Error", "Failed to load product details.");
        router.back();
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [id]);

  const handleSave = async () => {
    const price = parseFloat(form.price);
    const minQty = parseFloat(form.min_order_quantity) || 0;

    if (!form.name || !form.category || isNaN(price)) {
      Alert.alert("Validation Error", "Name, Category, and valid Price are required.");
      return;
    }

    if (price <= 0) {
      Alert.alert("Validation Error", "Price must be > 0.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateProduct(id as string, {
        name: form.name,
        category: form.category,
        description: form.description,
        price: price,
        min_order_quantity: minQty,
        harvest_date: form.harvest_date,
        best_before_date: form.best_before_date,
        status: form.status,
        notes: form.notes
      });
      if (result) {
        Alert.alert("Success", "Product updated successfully.");
        router.back();
      } else {
        Alert.alert("Error", "Failed to update product.");
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
      <SafeAreaView style={[styles.container, styles.center]}>
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
        <Text style={styles.title}>Edit Product</Text>
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
            <Text style={styles.label}>Product Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(t) => updateForm('name', t)} />
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
            <Text style={styles.label}>Description</Text>
            <TextInput 
              style={[styles.input, styles.textArea]} 
              value={form.description} 
              onChangeText={(t) => updateForm('description', t)} 
              multiline 
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing & Status</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput style={styles.input} value={form.price} onChangeText={(t) => updateForm('price', t)} keyboardType="numeric" />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Min Order Qty</Text>
              <TextInput style={styles.input} value={form.min_order_quantity} onChangeText={(t) => updateForm('min_order_quantity', t)} keyboardType="numeric" />
            </View>
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
  chipTextSelected: { color: Colors.surface, fontWeight: "600" }
});

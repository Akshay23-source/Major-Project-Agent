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
import { createOrder } from '../../../src/services/orders';
import { getFarmers, Farmer } from '../../../src/services/farmers';
import { getBuyers, Buyer } from '../../../src/services/buyers';
import { getProducts, Product } from '../../../src/services/products';
import { Colors } from '../../../src/theme/colors';

export default function CreateOrderScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [form, setForm] = useState({
    productId: '',
    farmerId: '',
    buyerId: '',
    product: '', // Display name
    quantity: '',
    unit: 'kg',
    price: '',
    deliveryCharge: '',
    notes: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [fData, bData, pData] = await Promise.all([getFarmers(), getBuyers(), getProducts()]);
        setFarmers(fData);
        setBuyers(bData);
        // Only show products that are available for order
        const availableProducts = pData.filter(p => p.status === 'Active' || p.status === 'Low Stock' || p.status === 'In Stock');
        setProducts(availableProducts);
      } catch (e) {
        Alert.alert("Error", "Failed to load required data.");
      } finally {
        setDataLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSelectProduct = (p: Product) => {
    setForm(prev => ({
      ...prev,
      productId: p.id,
      product: p.name,
      farmerId: p.farmer_id, // Auto select farmer based on product
      price: p.price.toString(),
      unit: p.unit
    }));
  };

  const quantity = parseFloat(form.quantity) || 0;
  const price = parseFloat(form.price) || 0;
  const deliveryCharge = parseFloat(form.deliveryCharge) || 0;

  const subtotal = quantity * price;
  const commission = subtotal * 0.05; // Example 5% commission
  const grandTotal = subtotal + commission + deliveryCharge;

  const handleSave = async () => {
    if (!form.productId || !form.farmerId || !form.buyerId || !form.product || quantity <= 0 || price <= 0) {
      Alert.alert("Validation Error", "Please select a product, farmer, and buyer, and enter valid quantity and price.");
      return;
    }

    const selectedProduct = products.find(p => p.id === form.productId);
    if (selectedProduct && quantity > selectedProduct.quantity) {
      Alert.alert("Insufficient Stock", `Only ${selectedProduct.quantity} ${selectedProduct.unit} available.`);
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        product_id: form.productId,
        farmer_id: form.farmerId,
        buyer_id: form.buyerId,
        product: form.product,
        quantity,
        unit: form.unit,
        price,
        subtotal,
        commission,
        delivery_charge: deliveryCharge,
        total_amount: grandTotal,
        delivery_location: '', 
        notes: form.notes,
        status: "Pending" as const
      };

      const result = await createOrder(orderData);
      if (result) {
        Alert.alert("Success", "Order created successfully.");
        router.back();
      } else {
        Alert.alert("Error", "Failed to create order.");
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
        <Text style={styles.title}>New Order</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.saveText}>Create</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.formContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Product</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
            {products.map(p => (
              <TouchableOpacity 
                key={p.id} 
                style={[styles.productChip, form.productId === p.id && styles.selectChipActive, p.quantity === 0 && styles.chipDisabled]}
                onPress={() => p.quantity > 0 && handleSelectProduct(p)}
                disabled={p.quantity === 0}
              >
                <Text style={[styles.selectChipText, form.productId === p.id && styles.selectChipTextActive, p.quantity === 0 && {color: Colors.textLight}]}>
                  {p.name}
                </Text>
                <Text style={[styles.productChipSub, form.productId === p.id && styles.selectChipTextActive, p.quantity === 0 && {color: Colors.textLight}]}>
                  {p.quantity} {p.unit} @ ₹{p.price}
                </Text>
              </TouchableOpacity>
            ))}
            {products.length === 0 && <Text style={styles.noDataText}>No products available.</Text>}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parties</Text>
          
          <Text style={styles.label}>Select Farmer * (Auto-selected by product)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
            {farmers.map(f => (
              <TouchableOpacity 
                key={f.id} 
                style={[styles.selectChip, form.farmerId === f.id && styles.selectChipActive]}
                onPress={() => updateForm('farmerId', f.id)}
              >
                <Text style={[styles.selectChipText, form.farmerId === f.id && styles.selectChipTextActive]}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Select Buyer *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalSelect}>
            {buyers.map(b => (
              <TouchableOpacity 
                key={b.id} 
                style={[styles.selectChip, form.buyerId === b.id && styles.selectChipActive]}
                onPress={() => updateForm('buyerId', b.id)}
              >
                <Text style={[styles.selectChipText, form.buyerId === b.id && styles.selectChipTextActive]}>{b.name}</Text>
              </TouchableOpacity>
            ))}
            {buyers.length === 0 && <Text style={styles.noDataText}>No buyers available</Text>}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput style={styles.input} value={form.quantity} onChangeText={(t) => updateForm('quantity', t)} placeholder="0" keyboardType="numeric" />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Unit</Text>
              <TextInput style={styles.input} value={form.unit} onChangeText={(t) => updateForm('unit', t)} placeholder="kg, ton, box" editable={false} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Unit Price (₹) *</Text>
              <TextInput style={styles.input} value={form.price} onChangeText={(t) => updateForm('price', t)} placeholder="0.00" keyboardType="numeric" editable={false} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Delivery Charge</Text>
              <TextInput style={styles.input} value={form.deliveryCharge} onChangeText={(t) => updateForm('deliveryCharge', t)} placeholder="0.00" keyboardType="numeric" />
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={form.notes} onChangeText={(t) => updateForm('notes', t)} placeholder="Optional details..." multiline />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Agent Commission (5%)</Text>
            <Text style={styles.summaryValue}>₹{commission.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Charge</Text>
            <Text style={styles.summaryValue}>₹{deliveryCharge.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Grand Total</Text>
            <Text style={styles.summaryTotalValue}>₹{grandTotal.toFixed(2)}</Text>
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
  saveButton: { padding: 4, minWidth: 60, alignItems: 'flex-end' },
  saveText: { fontSize: 16, fontWeight: "bold", color: Colors.primary },
  formContainer: { padding: 16 },
  section: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: Colors.primaryDark, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  row: { flexDirection: 'row' },
  label: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, fontWeight: "500" },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: Colors.text, backgroundColor: Colors.background },
  
  horizontalSelect: { flexDirection: 'row', marginBottom: 16 },
  selectChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, marginRight: 8, height: 36, justifyContent: 'center' },
  selectChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  selectChipText: { color: Colors.textSecondary, fontWeight: '500' },
  selectChipTextActive: { color: Colors.surface, fontWeight: 'bold' },
  noDataText: { color: Colors.textLight, fontStyle: 'italic', paddingVertical: 8 },

  productChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, marginRight: 8, minWidth: 120 },
  productChipSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  chipDisabled: { backgroundColor: Colors.background, opacity: 0.5 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: Colors.textSecondary, fontSize: 14 },
  summaryValue: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  summaryTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 4 },
  summaryTotalLabel: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
  summaryTotalValue: { color: Colors.primaryDark, fontSize: 18, fontWeight: 'bold' },
});

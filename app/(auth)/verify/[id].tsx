import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../../src/theme/colors';
import { api, errorMessage } from '../../../src/lib/api';
import { Ionicons } from '@expo/vector-icons';

interface VerificationState {
  delivered: boolean;
  quality: boolean;
  security: boolean;
  rating: number;
  comments: string;
}

export default function OrderVerificationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [verified, setVerified] = useState(false);

  const [form, setForm] = useState<VerificationState>({
    delivered: false,
    quality: false,
    security: false,
    rating: 5,
    comments: '',
  });

  useEffect(() => {
    if (id) loadVerificationStatus();
  }, [id]);

  const loadVerificationStatus = async () => {
    try {
      const data = await api.get<any>(`/orders/${id}/verification`);
      setOrderData(data);
      if (data.verification_status === 'VERIFIED' || data.verification_status === 'ISSUE_REPORTED') {
        setVerified(true);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not load order verification details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.delivered || !form.quality || !form.security) {
      Alert.alert('Missing Info', 'Please confirm delivery, quality, and security.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/orders/${id}/verify`, {
        ...form,
        customerId: 'CUSTOMER', // In a real app, this would come from a customer session
      });
      setVerified(true);
      Alert.alert('Success', 'Thank you for verifying your delivery!');
    } catch (error) {
      Alert.alert('Submission Failed', errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!orderData) {
    return (
      <View style={styles.center}>
        <Text>Order not found.</Text>
      </View>
    );
  }

  if (!orderData.delivered) {
    return (
      <View style={styles.center}>
        <Ionicons name="time-outline" size={64} color={Colors.textLight} />
        <Text style={styles.infoText}>This order hasn't been marked as delivered yet.</Text>
        <Text style={styles.subText}>You will be able to verify it once the driver completes the delivery.</Text>
      </View>
    );
  }

  if (verified) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
          <Text style={styles.title}>Delivery Verified!</Text>
          <Text style={styles.infoText}>Thank you for your feedback. Your delivery has been marked as {orderData.verification_status}.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Verify Delivery</Text>
          <Text style={styles.subTitle}>Order #{orderData.order_number}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Checklist</Text>

          <TouchableOpacity
            style={[styles.checkboxRow, form.delivered && styles.checkboxRowActive]}
            onPress={() => setForm({ ...form, delivered: !form.delivered })}
          >
            <Ionicons
              name={form.delivered ? "checkbox" : "square-outline"}
              size={24}
              color={form.delivered ? Colors.success : Colors.textSecondary}
            />
            <Text style={[styles.checkboxLabel, form.delivered && styles.checkboxLabelActive]}>
              The goods have arrived
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.checkboxRow, form.quality && styles.checkboxRowActive]}
            onPress={() => setForm({ ...form, quality: !form.quality })}
          >
            <Ionicons
              name={form.quality ? "checkbox" : "square-outline"}
              size={24}
              color={form.quality ? Colors.success : Colors.textSecondary}
            />
            <Text style={[styles.checkboxLabel, form.quality && styles.checkboxLabelActive]}>
              I am satisfied with the quality
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.checkboxRow, form.security && styles.checkboxRowActive]}
            onPress={() => setForm({ ...form, security: !form.security })}
          >
            <Ionicons
              name={form.security ? "checkbox" : "square-outline"}
              size={24}
              color={form.security ? Colors.success : Colors.textSecondary}
            />
            <Text style={[styles.checkboxLabel, form.security && styles.checkboxLabelActive]}>
              Goods arrived safely (no damage)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rating & Feedback</Text>

          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setForm({ ...form, rating: star })}
                style={styles.starButton}
              >
                <Ionicons
                  name="star"
                  size={32}
                  color={star <= form.rating ? '#FBBF24' : '#E5E7EB'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingText}>Rating: {form.rating} / 5</Text>

          <TextInput
            style={styles.input}
            placeholder="Any additional comments? (Optional)"
            value={form.comments}
            onChangeText={(text) => setForm({ ...form, comments: text })}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Submit Verification</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 24 },
  header: { marginBottom: 24, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.primaryDark, textAlign: 'center' },
  subTitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 16 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  checkboxRowActive: { backgroundColor: '#F0FDF4' },
  checkboxLabel: { fontSize: 16, color: Colors.textSecondary },
  checkboxLabelActive: { color: Colors.text, fontWeight: '500' },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12
  },
  starButton: { padding: 4 },
  ratingText: { textAlign: 'center', fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: 'top'
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  disabledButton: { backgroundColor: Colors.textLight, shadowOpacity: 0 },
  infoText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 12 },
  subText: { fontSize: 14, color: Colors.textLight, textAlign: 'center', marginTop: 4 },
});

import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getFarmers, Farmer } from '../../../src/services/farmers';
import { Colors } from '../../../src/theme/colors';

export default function FarmersScreen() {
  const router = useRouter();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = ["All", "Verified", "Pending", "Rejected"];

  useFocusEffect(
    useCallback(() => {
      loadFarmers();
    }, [])
  );

  const loadFarmers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getFarmers();
      setFarmers(data);
    } catch (err) {
      setError("Failed to load farmers.");
    } finally {
      setLoading(false);
    }
  };

  const filteredFarmers = useMemo(() => {
    return farmers.filter(farmer => {
      const searchLower = searchQuery.toLowerCase();
      const loc = `${farmer.village || ''} ${farmer.district || ''}`.toLowerCase();
      
      const matchesSearch = !searchQuery || 
        farmer.name?.toLowerCase().includes(searchLower) ||
        farmer.phone?.toLowerCase().includes(searchLower) ||
        loc.includes(searchLower);
      
      let matchesFilter = true;
      if (filterType !== "All") {
        matchesFilter = farmer.verification_status === filterType || (filterType === 'Pending' && !farmer.verification_status);
      }
      
      return matchesSearch && matchesFilter;
    });
  }, [farmers, searchQuery, filterType]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Farmers</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/add-farmer")} style={styles.addButton}>
          <Ionicons name="add" size={24} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textLight}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, filterType === filter && styles.filterChipSelected]}
              onPress={() => setFilterType(filter)}
            >
              <Text style={[styles.filterChipText, filterType === filter && styles.filterChipTextSelected]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadFarmers}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredFarmers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No farmers found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.push("/add-farmer")}>
            <Text style={styles.retryButtonText}>Add Farmer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredFarmers.map((farmer) => (
            <TouchableOpacity 
              key={farmer.id} 
              style={styles.card}
              onPress={() => router.push(`/farmers/${farmer.id}`)}
            >
              <View style={styles.cardContent}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{farmer.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{farmer.name}</Text>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.detailText}>{farmer.village}{farmer.district ? `, ${farmer.district}` : ''}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.detailText}>{farmer.phone}</Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: farmer.verification_status === 'Verified' ? `${Colors.success}20` : farmer.verification_status === 'Rejected' ? `${Colors.error}20` : `${Colors.warning}20` }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: farmer.verification_status === 'Verified' ? Colors.success : farmer.verification_status === 'Rejected' ? Colors.error : Colors.warning }
                    ]}>{farmer.verification_status || 'Pending'}</Text>
                  </View>
                  <View style={styles.ratingRow}>
                    <Text style={styles.ratingText}>4.8</Text>
                    <Ionicons name="star" size={12} color={Colors.gold} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { padding: 4 },
  headerTitleContainer: { flex: 1, marginLeft: 16 },
  title: { fontSize: 20, fontWeight: "bold", color: Colors.text },
  addButton: { backgroundColor: Colors.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  controlsContainer: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, height: 44, marginTop: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: "100%", color: Colors.text },
  filtersScroll: { marginTop: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  filterChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary, fontWeight: "500" },
  filterChipTextSelected: { color: Colors.surface, fontWeight: "600" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyText: { fontSize: 18, color: Colors.textSecondary, marginTop: 16, marginBottom: 24, fontWeight: "500" },
  retryButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: Colors.surface, fontWeight: "bold", fontSize: 16 },
  listContainer: { padding: 16 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  cardContent: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: Colors.surface },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: Colors.primaryDark, marginBottom: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  detailText: { fontSize: 12, color: Colors.textSecondary, marginLeft: 4 },
  cardRight: { alignItems: 'flex-end', justifyContent: 'space-between', height: 48 },
  statusBadge: { backgroundColor: `${Colors.success}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: Colors.success, fontSize: 10, fontWeight: 'bold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  ratingText: { fontSize: 10, fontWeight: 'bold', color: Colors.textSecondary, marginRight: 2 }
});

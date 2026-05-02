import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography } from '../lib/theme';

const DEVICE_ID_KEY = 'giga3_earn_device_id';

export default function CreatorDashboardScreen() {
  const nav = useNavigation<any>();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_ID_KEY).then((id) => setDeviceId(id));
  }, []);

  const products = useQuery(api.marketplace.getCreatorProducts, deviceId ? { authorId: deviceId } : 'skip');
  const stats = useQuery(api.marketplace.getCreatorStats, deviceId ? { authorId: deviceId } : 'skip');
  const deleteProduct = useMutation(api.marketplace.deleteProduct);

  const handleDelete = (productId: any, title: string) => {
    Alert.alert('Delete Product', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteProduct({ productId }); }
          catch (_e) { Alert.alert('Error', 'Failed to delete product.'); }
        },
      },
    ]);
  };

  const STAT_CARDS = [
    { label: 'Products', value: stats?.totalProducts ?? 0, icon: 'cube', color: '#3B82F6' },
    { label: 'Downloads', value: stats?.totalDownloads ?? 0, icon: 'download', color: '#22C55E' },
    { label: 'Sales', value: stats?.totalSales ?? 0, icon: 'cart', color: '#A855F7' },
    { label: 'Earnings', value: `GHS ${(stats?.totalEarnings ?? 0).toFixed(0)}`, icon: 'cash', color: '#F97316' },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Creator Dashboard</Text>
        <TouchableOpacity onPress={() => nav.navigate('UploadProduct')} style={s.headerAction}>
          <Ionicons name="add-circle" size={24} color={colors.gold} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Stats Grid */}
        <View style={s.statsGrid}>
          {STAT_CARDS.map((stat) => (
            <View key={stat.label} style={s.statCard}>
              <View style={[s.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <Ionicons name={stat.icon as any} size={18} color={stat.color} />
              </View>
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Earnings Notice */}
        <View style={s.earningsNotice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
          <Text style={s.earningsNoticeText}>
            Configure Paystack keys in your Convex environment to enable payments. Set PAYSTACK_PUBLIC_KEY and PAYSTACK_SECRET_KEY.
          </Text>
        </View>

        {/* My Products */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>My Products</Text>
          <TouchableOpacity onPress={() => nav.navigate('UploadProduct')}>
            <Text style={s.addLink}>+ Add New</Text>
          </TouchableOpacity>
        </View>

        {!products ? (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>Loading your products...</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="cube-outline" size={40} color={colors.textTertiary} />
            <Text style={s.emptyTitle}>No products yet</Text>
            <Text style={s.emptyText}>Upload your first ebook, notes, or template to start selling.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => nav.navigate('UploadProduct')}>
              <Ionicons name="add" size={18} color={colors.textInverse} />
              <Text style={s.emptyBtnText}>Upload Product</Text>
            </TouchableOpacity>
          </View>
        ) : (
          products.map((product) => (
            <View key={product._id} style={s.productRow}>
              <View style={s.productThumb}>
                {product.coverUrl ? (
                  <Image source={{ uri: product.coverUrl }} style={{ width: '100%', height: '100%', borderRadius: 6 }} resizeMode="cover" />
                ) : (
                  <Ionicons name={product.fileType === 'PDF' ? 'document-text' : 'cube'} size={22} color={colors.gold} />
                )}
              </View>
              <View style={s.productInfo}>
                <Text style={s.productTitle} numberOfLines={1}>{product.title}</Text>
                <Text style={s.productMeta}>
                  {product.price === 0 ? 'Free' : `GHS ${product.price.toFixed(2)}`} · {product.salesCount ?? 0} sales · {product.downloads} downloads
                </Text>
              </View>
              <TouchableOpacity
                style={s.editBtn}
                onPress={() => nav.navigate('UploadProduct', { editProductId: product._id })}
              >
                <Ionicons name="pencil" size={16} color={colors.gold} />
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(product._id, product.title)}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs, marginRight: spacing.md },
  headerTitle: { ...typography.h2, color: colors.textPrimary, flex: 1 },
  headerAction: { padding: spacing.xs },
  content: { padding: spacing.lg },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { ...typography.h3, color: colors.textPrimary, marginBottom: 2 },
  statLabel: { ...typography.caption, color: colors.textTertiary },
  earningsNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.xl },
  earningsNoticeText: { ...typography.caption, color: colors.warning, flex: 1, lineHeight: 18 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  addLink: { ...typography.captionMedium, color: colors.gold },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { ...typography.h3, color: colors.textPrimary },
  emptyText: { ...typography.body, color: colors.textTertiary, textAlign: 'center', maxWidth: 240 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.gold, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.full, marginTop: spacing.sm },
  emptyBtnText: { ...typography.bodyMedium, color: colors.textInverse },
  productRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, gap: spacing.md },
  productThumb: { width: 44, height: 44, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1 },
  productTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  productMeta: { ...typography.caption, color: colors.textTertiary },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center', justifyContent: 'center' },
});
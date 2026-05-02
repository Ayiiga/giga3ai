import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { colors, spacing, borderRadius, typography } from '../lib/theme';

const CATEGORIES = [
  { key: 'study-materials', label: 'Study Materials', icon: 'book', color: '#3B82F6' },
  { key: 'exam-prep', label: 'Exam Prep Notes', icon: 'school', color: '#22C55E' },
  { key: 'ebooks', label: 'Ebooks', icon: 'reader', color: '#A855F7' },
  { key: 'ai-prompts', label: 'AI Prompt Packs', icon: 'sparkles', color: '#F97316' },
  { key: 'templates', label: 'Business Templates', icon: 'briefcase', color: '#EAB308' },
  { key: 'videos', label: 'Videos', icon: 'videocam', color: '#EC4899' },
];

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'price_low', label: 'Price: Low' },
  { key: 'price_high', label: 'Price: High' },
  { key: 'downloads', label: 'Popular' },
];

type SortKey = 'newest' | 'price_low' | 'price_high' | 'downloads';

export default function MarketplaceScreen() {
  const nav = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('newest');

  const products = useQuery(api.marketplace.listProducts, {
    category: activeCategory ?? undefined,
    sortBy,
  });

  const searchResults = useQuery(
    api.marketplace.searchProducts,
    search.trim().length >= 2 ? { searchTerm: search.trim() } : 'skip'
  );

  const displayProducts = search.trim().length >= 2 ? searchResults : products;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Marketplace</Text>
        <TouchableOpacity onPress={() => nav.navigate('CreatorDashboard')} style={s.headerRight}>
          <Ionicons name="stats-chart-outline" size={20} color={colors.gold} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => nav.navigate('MyLibrary')} style={s.headerRight}>
          <Ionicons name="library-outline" size={22} color={colors.gold} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder="Search ebooks, notes, templates, prompts..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          <TouchableOpacity
            style={[s.catChip, !activeCategory && s.catChipActive]}
            onPress={() => setActiveCategory(null)}
          >
            <Text style={[s.catChipText, !activeCategory && s.catChipTextActive]}>All</Text>
          </TouchableOpacity>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[s.catChip, activeCategory === cat.key && { backgroundColor: `${cat.color}20`, borderColor: cat.color }]}
              onPress={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
            >
              <Ionicons name={cat.icon as any} size={14} color={activeCategory === cat.key ? cat.color : colors.textTertiary} />
              <Text style={[s.catChipText, activeCategory === cat.key && { color: cat.color }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sort */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[s.sortChip, sortBy === opt.key && s.sortChipActive]}
              onPress={() => setSortBy(opt.key as SortKey)}
            >
              <Text style={[s.sortChipText, sortBy === opt.key && s.sortChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products */}
        {!displayProducts ? (
          <View style={s.emptyState}>
            <Ionicons name="hourglass-outline" size={32} color={colors.textTertiary} />
            <Text style={s.emptyText}>Loading products...</Text>
          </View>
        ) : displayProducts.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="storefront-outline" size={40} color={colors.textTertiary} />
            <Text style={s.emptyTitle}>No products yet</Text>
            <Text style={s.emptyText}>Be the first to publish! Tap the + button below.</Text>
          </View>
        ) : (
          <View style={s.productGrid}>
            {displayProducts.map((product) => (
              <TouchableOpacity
                key={product._id}
                style={s.productCard}
                activeOpacity={0.7}
                onPress={() => nav.navigate('ProductDetail', { productId: product._id })}
              >
                <View style={s.productThumb}>
                  {product.coverUrl ? (
                    <Image source={{ uri: product.coverUrl }} style={{ width: '100%', height: '100%', borderRadius: borderRadius.md }} resizeMode="cover" />
                  ) : (
                    <Ionicons
                      name={product.fileType === 'PDF' ? 'document-text' : 'cube'}
                      size={28}
                      color={colors.gold}
                    />
                  )}
                </View>
                <View style={s.productCatBadge}>
                  <Text style={s.productCatText}>{product.category}</Text>
                </View>
                <Text style={s.productTitle} numberOfLines={2}>{product.title}</Text>
                <Text style={s.productAuthor} numberOfLines={1}>by {product.authorName}</Text>
                <View style={s.productFooter}>
                  <Text style={s.productPrice}>
                    {product.price === 0 ? 'Free' : `GHS ${product.price.toFixed(2)}`}
                  </Text>
                  <View style={s.downloadCount}>
                    <Ionicons name="download-outline" size={12} color={colors.textTertiary} />
                    <Text style={s.downloadCountText}>{product.downloads}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Upload CTA */}
        <TouchableOpacity style={s.uploadCta} activeOpacity={0.8} onPress={() => nav.navigate('UploadProduct')}>
          <View style={s.uploadCtaIcon}>
            <Ionicons name="cloud-upload" size={24} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.uploadCtaTitle}>Start Selling</Text>
            <Text style={s.uploadCtaDesc}>Upload your ebooks, notes, templates, or prompt packs</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} activeOpacity={0.8} onPress={() => nav.navigate('UploadProduct')}>
        <Ionicons name="add" size={28} color={colors.textInverse} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs, marginRight: spacing.md },
  headerTitle: { ...typography.h2, color: colors.textPrimary, flex: 1 },
  headerRight: { padding: spacing.xs },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: 12, marginLeft: spacing.sm },
  scrollContent: { paddingBottom: 100 },
  catRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.md },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  catChipActive: { backgroundColor: colors.goldMuted, borderColor: colors.gold },
  catChipText: { ...typography.captionMedium, color: colors.textTertiary },
  catChipTextActive: { color: colors.gold },
  sortRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg },
  sortChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sortChipActive: { backgroundColor: colors.goldMuted, borderColor: colors.gold },
  sortChipText: { ...typography.small, color: colors.textTertiary },
  sortChipTextActive: { color: colors.gold, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl * 2, gap: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.textPrimary },
  emptyText: { ...typography.body, color: colors.textTertiary, textAlign: 'center', maxWidth: 260 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.md },
  productCard: { width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  productThumb: { width: '100%', height: 80, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  productCatBadge: { alignSelf: 'flex-start', backgroundColor: colors.goldMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, marginBottom: spacing.xs },
  productCatText: { ...typography.small, color: colors.gold },
  productTitle: { ...typography.captionMedium, color: colors.textPrimary, marginBottom: 2, lineHeight: 18 },
  productAuthor: { ...typography.small, color: colors.textTertiary, marginBottom: spacing.sm },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { ...typography.captionMedium, color: colors.gold, fontWeight: '700' },
  downloadCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  downloadCountText: { ...typography.small, color: colors.textTertiary },
  uploadCta: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xxl, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  uploadCtaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center' },
  uploadCtaTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  uploadCtaDesc: { ...typography.caption, color: colors.textSecondary },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8 },
});
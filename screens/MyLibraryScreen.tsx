import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Image, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography } from '../lib/theme';

const DEVICE_ID_KEY = 'giga3_earn_device_id';

const CAT_COLORS: Record<string, string> = {
  'study-materials': '#3B82F6',
  'exam-prep': '#22C55E',
  'ebooks': '#A855F7',
  'ai-prompts': '#F97316',
  'templates': '#EAB308',
  'videos': '#EC4899',
};

export default function MyLibraryScreen() {
  const nav = useNavigation<any>();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_ID_KEY).then((id: string | null) => setDeviceId(id));
  }, []);

  const library = useQuery(
    api.marketplace.getUserLibrary,
    deviceId ? { userId: deviceId } : 'skip'
  );
  const incrementDownloads = useMutation(api.marketplace.incrementDownloads);

  const filtered = library?.filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      item.product?.title.toLowerCase().includes(term) ||
      item.product?.category.toLowerCase().includes(term) ||
      item.product?.authorName.toLowerCase().includes(term)
    );
  });

  const handleDownload = async (productId: any, fileUrl: string | null | undefined) => {
    if (!fileUrl) {
      Alert.alert('No File', 'The product file is not available for download.');
      return;
    }
    setDownloadingId(productId);
    try {
      await Linking.openURL(fileUrl);
      await incrementDownloads({ productId });
    } catch (e) {
      Alert.alert('Error', 'Unable to open file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const renderItem = ({ item }: any) => {
    const product = item.product;
    if (!product) return null;
    const catColor = CAT_COLORS[product.category] || colors.gold;
    const isDownloading = downloadingId === product._id;

    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={0.7}
        onPress={() => nav.navigate('ProductDetail', { productId: product._id })}
      >
        {/* Cover */}
        <View style={s.cardCover}>
          {product.coverUrl ? (
            <Image source={{ uri: product.coverUrl }} style={s.cardImage} />
          ) : (
            <View style={[s.cardPlaceholder, { backgroundColor: `${catColor}15` }]}>
              <Ionicons
                name={product.fileType === 'PDF' ? 'document-text' : 'cube'}
                size={28}
                color={catColor}
              />
            </View>
          )}
          <View style={[s.catDot, { backgroundColor: catColor }]} />
        </View>

        {/* Info */}
        <View style={s.cardInfo}>
          <Text style={s.cardTitle} numberOfLines={2}>{product.title}</Text>
          <Text style={s.cardAuthor} numberOfLines={1}>by {product.authorName}</Text>
          <View style={s.cardMeta}>
            <View style={s.typeBadge}>
              <Text style={s.typeBadgeText}>{product.fileType}</Text>
            </View>
            <Text style={s.cardDate}>
              {new Date(item.purchasedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Download Button */}
        <TouchableOpacity
          style={s.dlBtn}
          onPress={() => handleDownload(product._id, item.fileUrl)}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : (
            <Ionicons name="download-outline" size={20} color={colors.gold} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Library</Text>
        <TouchableOpacity onPress={() => nav.navigate('Marketplace')} style={s.backBtn}>
          <Ionicons name="storefront-outline" size={22} color={colors.gold} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      {(library && library.length > 0) && (
        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={s.searchInput}
            placeholder="Search your library..."
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
      )}

      {!library ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={s.centerText}>Loading your library...</Text>
        </View>
      ) : library.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="library-outline" size={56} color={colors.textTertiary} />
          <Text style={s.emptyTitle}>Your Library is Empty</Text>
          <Text style={s.emptyText}>Products you purchase from the marketplace will appear here.</Text>
          <TouchableOpacity style={s.browseBtn} onPress={() => nav.navigate('Marketplace')}>
            <Ionicons name="storefront" size={18} color={colors.textInverse} />
            <Text style={s.browseBtnText}>Browse Marketplace</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.purchaseId}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  headerTitle: { ...typography.h2, color: colors.textPrimary, flex: 1, marginLeft: spacing.md },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: 10, marginLeft: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerText: { ...typography.body, color: colors.textTertiary },
  emptyTitle: { ...typography.h3, color: colors.textPrimary },
  emptyText: { ...typography.body, color: colors.textTertiary, textAlign: 'center', maxWidth: 260 },
  browseBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.gold, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.full, marginTop: spacing.sm },
  browseBtnText: { ...typography.bodyMedium, color: colors.textInverse },
  list: { padding: spacing.lg, paddingBottom: 40 },

  // Card
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, gap: spacing.md },
  cardCover: { width: 64, height: 64, borderRadius: borderRadius.md, overflow: 'hidden', position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  catDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4 },
  cardInfo: { flex: 1 },
  cardTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  cardAuthor: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.xs },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typeBadge: { backgroundColor: colors.goldMuted, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: borderRadius.sm },
  typeBadgeText: { ...typography.small, color: colors.gold },
  cardDate: { ...typography.small, color: colors.textTertiary },
  dlBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center' },
});
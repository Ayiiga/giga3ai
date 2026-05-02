import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Image, ActivityIndicator, Share, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { a0 } from 'a0-sdk';
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

export default function ProductDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { productId } = route.params;

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const product = useQuery(api.marketplace.getProduct, { productId });
  const isPurchased = useQuery(
    api.marketplace.checkPurchased,
    deviceId ? { userId: deviceId, productId } : 'skip'
  );
  const fileUrl = useQuery(
    api.marketplace.getProductFileUrl,
    deviceId ? { productId, userId: deviceId } : 'skip'
  );

  const paystackPublicKey = useQuery(api.settings.getPaystackPublicKey);
  const recordFreePurchase = useMutation(api.marketplace.recordFreePurchase);
  const createPendingPurchase = useMutation(api.marketplace.createPendingPurchase);

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_ID_KEY).then((id: string | null) => setDeviceId(id));
  }, []);

  if (!product) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Product Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={s.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isFree = product.price === 0;
  const isOwner = deviceId === product.authorId;
  const catColor = CAT_COLORS[product.category] || colors.gold;

  const handleBuy = async () => {
    if (!deviceId) return Alert.alert('Error', 'Please sign in to purchase.');

    if (isFree) {
      try {
        await recordFreePurchase({ userId: deviceId, productId });
        Alert.alert('Added to Library', 'This free resource is now in your library.');
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to add to library.');
      }
      return;
    }

    if (!paystackPublicKey) {
      Alert.alert('Payment Unavailable', 'Payment system is not configured yet.');
      return;
    }

    setPurchasing(true);
    try {
      const user = a0?.auth?.getUser?.();
      const email = user?.email || `user_${deviceId}@giga3.app`;
      const reference = `giga3_${productId.slice(-6)}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const amount = product.price * 100; // Convert to pesewas

      // Create pending purchase record
      await createPendingPurchase({
        userId: deviceId,
        productId,
        price: product.price,
        currency: product.currency,
        paystackReference: reference,
      });

      // Navigate to Paystack checkout
      nav.push('PaystackCheckout', {
        publicKey: paystackPublicKey,
        email,
        amount,
        reference,
        currency: product.currency || 'GHS',
        productTitle: product.title,
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleDownload = async () => {
    if (!fileUrl) {
      Alert.alert('No File', 'The product file is not yet available.');
      return;
    }
    setDownloading(true);
    try {
      await Linking.openURL(fileUrl);
    } catch (e) {
      Alert.alert('Error', 'Unable to open file.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out "${product.title}" on Giga3 Marketplace! ${product.description.slice(0, 100)}...`,
      });
    } catch (_) {}
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{product.title}</Text>
        <TouchableOpacity onPress={handleShare} style={s.backBtn}>
          <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View style={s.hero}>
          {product.coverUrl ? (
            <Image source={{ uri: product.coverUrl }} style={s.coverImage} />
          ) : (
            <View style={s.coverPlaceholder}>
              <Ionicons
                name={product.fileType === 'PDF' ? 'document-text' : product.fileType === 'Video' ? 'videocam' : 'cube'}
                size={56}
                color={catColor}
              />
            </View>
          )}
        </View>

        {/* Badges */}
        <View style={s.badgeRow}>
          <View style={[s.badge, { backgroundColor: `${catColor}20` }]}>
            <Text style={[s.badgeText, { color: catColor }]}>{product.category}</Text>
          </View>
          <View style={s.badge}>
            <Ionicons name="document" size={12} color={colors.textTertiary} />
            <Text style={s.badgeText}>{product.fileType}</Text>
          </View>
          {product.fileName && (
            <View style={s.badge}>
              <Ionicons name="attach" size={12} color={colors.textTertiary} />
              <Text style={s.badgeText} numberOfLines={1}>{product.fileName}</Text>
            </View>
          )}
        </View>

        {/* Title & Author */}
        <Text style={s.title}>{product.title}</Text>
        <TouchableOpacity style={s.authorRow} activeOpacity={0.7}>
          <View style={[s.authorAvatar, { backgroundColor: `${catColor}20` }]}>
            <Text style={[s.authorInitial, { color: catColor }]}>
              {product.authorName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={s.authorName}>by {product.authorName}</Text>
        </TouchableOpacity>

        {/* Price & Stats Card */}
        <View style={s.statsCard}>
          <View style={s.statItem}>
            <Text style={s.statLabel}>Price</Text>
            <Text style={s.priceValue}>
              {isFree ? 'Free' : `GHS ${product.price.toFixed(2)}`}
            </Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statLabel}>Downloads</Text>
            <Text style={s.statValue}>{product.downloads}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statLabel}>Sales</Text>
            <Text style={s.statValue}>{product.salesCount ?? 0}</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={s.sectionLabel}>Description</Text>
        <Text style={s.description}>{product.description}</Text>

        {/* Preview */}
        {product.previewText ? (
          <>
            <Text style={s.sectionLabel}>Preview</Text>
            <View style={s.previewCard}>
              <Ionicons name="eye-outline" size={16} color={colors.gold} />
              <Text style={s.previewText}>{product.previewText}</Text>
            </View>
          </>
        ) : null}

        {/* File Info */}
        {product.fileName && (
          <>
            <Text style={s.sectionLabel}>File Details</Text>
            <View style={s.fileInfoCard}>
              <Ionicons name="document-attach" size={20} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={s.fileInfoName} numberOfLines={1}>{product.fileName}</Text>
                {product.fileSize ? (
                  <Text style={s.fileInfoSize}>
                    {(product.fileSize / 1024 / 1024).toFixed(2)} MB
                  </Text>
                ) : null}
              </View>
            </View>
          </>
        )}

        {(product.verificationId || product.barcodeNumber || product.productCode || product.ownershipRecordId) && (
          <>
            <Text style={s.sectionLabel}>Product Verification</Text>
            <View style={s.identityCard}>
              <View style={s.identityRow}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text style={s.identityLabel}>Verification ID</Text>
              </View>
              <Text style={s.identityValue}>{product.verificationId || 'Pending verification'}</Text>

              <View style={s.identityDivider} />

              <View style={s.identityRow}>
                <Ionicons name="barcode-outline" size={18} color={colors.gold} />
                <Text style={s.identityLabel}>Barcode Number</Text>
              </View>
              <Text style={s.identityValue}>{product.barcodeNumber || 'N/A'}</Text>

              <View style={s.identityDivider} />

              <View style={s.identityRow}>
                <Ionicons name="pricetag-outline" size={18} color={colors.textPrimary} />
                <Text style={s.identityLabel}>Product Code</Text>
              </View>
              <Text style={s.identityValue}>{product.productCode || 'N/A'}</Text>

              <View style={s.identityDivider} />

              <View style={s.identityRow}>
                <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
                <Text style={s.identityLabel}>Ownership Record</Text>
              </View>
              <Text style={s.identityValue}>{product.ownershipRecordId || 'N/A'}</Text>

              <View style={s.identityDivider} />

              <View style={s.identityRow}>
                <Ionicons name="leaf-outline" size={18} color={colors.textPrimary} />
                <Text style={s.identityLabel}>Copyright</Text>
              </View>
              <Text style={s.identityValue}>
                {product.copyrightOwner || product.authorName}
                {product.copyrightYear ? ` • ${product.copyrightYear}` : ''}
              </Text>
            </View>
          </>
        )}

        {/* Action Buttons */}
        <View style={s.actions}>
          {isOwner ? (
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => nav.navigate('UploadProduct', { editProductId: productId })}
            >
              <Ionicons name="pencil" size={18} color={colors.gold} />
              <Text style={s.editBtnText}>Edit Product</Text>
            </TouchableOpacity>
          ) : isPurchased ? (
            <>
              <View style={s.purchasedBanner}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={s.purchasedText}>Purchased</Text>
              </View>
              <TouchableOpacity
                style={s.downloadBtn}
                onPress={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <>
                    <Ionicons name="download" size={18} color={colors.textInverse} />
                    <Text style={s.downloadBtnText}>Download / Open</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[s.buyBtn, purchasing && { opacity: 0.6 }]}
              onPress={handleBuy}
              disabled={purchasing}
              activeOpacity={0.8}
            >
              {purchasing ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <>
                  <Ionicons name={isFree ? 'download' : 'cart'} size={18} color={colors.textInverse} />
                  <Text style={s.buyBtnText}>
                    {isFree ? 'Get Free' : `Buy Now  GHS ${product.price.toFixed(2)}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  headerTitle: { ...typography.h3, color: colors.textPrimary, flex: 1, marginHorizontal: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.textTertiary },
  content: { paddingBottom: 40 },

  // Hero
  hero: { width: '100%', height: 200 },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },

  // Badges
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.lg, paddingBottom: 0 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full, maxWidth: 160 },
  badgeText: { ...typography.small, color: colors.textTertiary },

  // Title & Author
  title: { ...typography.h2, color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg },
  authorAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  authorInitial: { ...typography.captionMedium },
  authorName: { ...typography.body, color: colors.textSecondary },

  // Stats
  statsCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { ...typography.small, color: colors.textTertiary, marginBottom: 4 },
  priceValue: { ...typography.h2, color: colors.gold },
  statValue: { ...typography.bodyMedium, color: colors.textPrimary },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },

  // Sections
  sectionLabel: { ...typography.captionMedium, color: colors.textTertiary, letterSpacing: 0.5, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.textSecondary, lineHeight: 24, paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  previewCard: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  previewText: { ...typography.body, color: colors.textSecondary, flex: 1, lineHeight: 22 },

  // File info
  fileInfoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  fileInfoName: { ...typography.bodyMedium, color: colors.textPrimary },
  fileInfoSize: { ...typography.caption, color: colors.textTertiary },

  identityCard: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  identityLabel: { ...typography.captionMedium, color: colors.textSecondary },
  identityValue: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: spacing.sm },
  identityDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },

  // Actions
  actions: { paddingHorizontal: spacing.lg, gap: spacing.md },
  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.gold, paddingVertical: 16, borderRadius: borderRadius.full },
  buyBtnText: { ...typography.h3, color: colors.textInverse },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.success, paddingVertical: 16, borderRadius: borderRadius.full },
  downloadBtnText: { ...typography.h3, color: '#FFFFFF' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, paddingVertical: 14, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gold },
  editBtnText: { ...typography.bodyMedium, color: colors.gold },
  purchasedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingVertical: spacing.md, borderRadius: borderRadius.lg },
  purchasedText: { ...typography.bodyMedium, color: colors.success },
});
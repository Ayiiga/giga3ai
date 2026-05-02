import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
  Share,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { getSavedResults, deleteResult, SavedResult } from '../lib/savedStorage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export default function SavedScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<SavedResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [savingGalleryId, setSavingGalleryId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const results = await getSavedResults();
    setItems(results);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const handleCopy = async (item: SavedResult) => {
    await Clipboard.setStringAsync(item.result);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveToGallery = async (item: SavedResult) => {
    if (savingGalleryId === item.id || galleryId === item.id) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to save images.');
        return;
      }
      setSavingGalleryId(item.id);
      const fileUri = FileSystem.cacheDirectory + `giga3_${Date.now()}.png`;
      const download = await FileSystem.downloadAsync(item.result, fileUri);
      await MediaLibrary.saveToLibraryAsync(download.uri);
      setGalleryId(item.id);
      Alert.alert('Saved', 'Image saved to your photo library.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save image. Please try again.');
    } finally {
      setSavingGalleryId(null);
    }
  };

  const handleShare = async (item: SavedResult) => {
    try {
      if (item.resultType === 'image') {
        await Share.share({
          url: item.result,
          message: Platform.OS === 'android' ? item.result : undefined,
        });
      } else {
        await Share.share({ message: item.result });
      }
    } catch (e) {
      // user cancelled
    }
  };

  const handleDelete = (item: SavedResult) => {
    Alert.alert('Delete', `Remove this ${item.toolName} result?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteResult(item.id);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        },
      },
    ]);
  };

  const handleReopen = (item: SavedResult) => {
    if (item.toolId === 'chat-ai') {
      navigation.navigate('ChatAI');
      return;
    }
    navigation.push('Tool', {
      toolId: item.toolId,
      preloadedPrompt: item.prompt,
      preloadedResult: item.result,
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const renderItem = ({ item }: { item: SavedResult }) => {
    const isExpanded = expandedId === item.id;
    const isCopied = copiedId === item.id;
    const isImage = item.resultType === 'image';

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <TouchableOpacity
          style={styles.cardHeader}
          activeOpacity={0.7}
          onPress={() => toggleExpand(item.id)}
        >
          <View style={[styles.toolBadge, { backgroundColor: `${item.toolColor}18` }]}>
            <Ionicons name={item.toolIcon as any} size={14} color={item.toolColor} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardToolName}>{item.toolName}</Text>
            <Text style={styles.cardDate}>{formatDate(item.timestamp)}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {/* Prompt Preview */}
        <Text style={styles.promptLabel}>Prompt</Text>
        <Text style={styles.promptText} numberOfLines={isExpanded ? undefined : 1}>
          {item.prompt}
        </Text>

        {/* Result Preview */}
        <View style={styles.resultPreview}>
          {isImage ? (
            <Image
              source={{ uri: item.result }}
              style={[styles.previewImage, isExpanded && styles.previewImageExpanded]}
              resizeMode="cover"
            />
          ) : (
            <Text
              style={styles.resultText}
              numberOfLines={isExpanded ? undefined : 3}
              selectable={isExpanded}
            >
              {item.result}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => handleCopy(item)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isCopied ? 'checkmark-circle' : 'copy-outline'}
              size={16}
              color={isCopied ? colors.success : colors.textSecondary}
            />
            <Text
              style={[
                styles.cardActionText,
                isCopied && { color: colors.success },
              ]}
            >
              {isCopied ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>

          {isImage && (
            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={() => handleSaveToGallery(item)}
              disabled={savingGalleryId === item.id || galleryId === item.id}
              activeOpacity={0.7}
            >
              {savingGalleryId === item.id ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Ionicons
                  name={galleryId === item.id ? 'checkmark-circle' : 'download-outline'}
                  size={16}
                  color={galleryId === item.id ? colors.success : colors.textSecondary}
                />
              )}
              <Text
                style={[
                  styles.cardActionText,
                  galleryId === item.id && { color: colors.success },
                ]}
              >
                {galleryId === item.id ? 'Saved to Gallery' : 'Save to Gallery'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => handleShare(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.cardActionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => handleReopen(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="open-outline" size={16} color={colors.gold} />
            <Text style={[styles.cardActionText, { color: colors.gold }]}>Reopen</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={[styles.cardActionText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: spacing.sm, marginRight: spacing.sm }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { flex: 1 }]}>Saved</Text>
          <Text style={styles.headerCount}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bookmark-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptySubtitle}>
              Generate content with any AI tool, then tap Save to keep it here
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.gold}
                colors={[colors.gold]}
              />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  headerCount: {
    ...typography.captionMedium,
    color: colors.textTertiary,
  },
  listContent: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  toolBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardToolName: {
    ...typography.captionMedium,
    color: colors.textPrimary,
  },
  cardDate: {
    ...typography.small,
    color: colors.textTertiary,
  },
  promptLabel: {
    ...typography.small,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  promptText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  resultPreview: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.sm,
  },
  previewImageExpanded: {
    height: 250,
  },
  resultText: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    minWidth: '18%',
    flexGrow: 1,
  },
  cardActionText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
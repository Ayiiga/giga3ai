import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { a0 } from 'a0-sdk';
import { colors, spacing, borderRadius, typography } from '../lib/theme';

const CATEGORIES = [
  { key: 'study-materials', label: 'Study Materials', icon: 'book' },
  { key: 'exam-prep', label: 'Exam Prep', icon: 'school' },
  { key: 'ebooks', label: 'Ebooks', icon: 'reader' },
  { key: 'ai-prompts', label: 'AI Prompts', icon: 'sparkles' },
  { key: 'templates', label: 'Templates', icon: 'briefcase' },
  { key: 'videos', label: 'Videos', icon: 'videocam' },
];

const FILE_TYPES = ['PDF', 'ZIP', 'Image', 'Video', 'Template', 'Document', 'Prompt Pack'];
const DEVICE_ID_KEY = 'giga3_earn_device_id';

export default function UploadProductScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const editProductId = route.params?.editProductId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ebooks');
  const [price, setPrice] = useState('');
  const [fileType, setFileType] = useState('PDF');
  const [previewText, setPreviewText] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // File states
  const [coverImage, setCoverImage] = useState<{ uri: string; name: string } | null>(null);
  const [productFile, setProductFile] = useState<{ uri: string; name: string; size?: number } | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [coverStorageId, setCoverStorageId] = useState<string | null>(null);
  const [fileStorageId, setFileStorageId] = useState<string | null>(null);

  const createProduct = useMutation(api.marketplace.createProduct);
  const updateProduct = useMutation(api.marketplace.updateProduct);
  const generateUploadUrl = useMutation(api.marketplace.generateUploadUrl);

  const editProduct = useQuery(
    api.marketplace.getProduct,
    editProductId ? { productId: editProductId } : 'skip'
  );

  useEffect(() => {
    AsyncStorage.getItem(DEVICE_ID_KEY).then((id: string | null) => setDeviceId(id));
  }, []);

  useEffect(() => {
    if (editProduct) {
      setTitle(editProduct.title);
      setDescription(editProduct.description);
      setCategory(editProduct.category);
      setPrice(editProduct.price.toString());
      setFileType(editProduct.fileType);
      setPreviewText(editProduct.previewText || '');
      if (editProduct.coverImageId) setCoverStorageId(editProduct.coverImageId as string);
      if (editProduct.productFileId) setFileStorageId(editProduct.productFileId as string);
    }
  }, [editProduct]);

  const user = a0?.auth?.getUser?.();
  const authorName = user?.name || user?.email || 'Anonymous Creator';

  // ─── File Picking ───────────────────────────────────

  const pickCoverImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCoverImage({ uri: asset.uri, name: asset.fileName || 'cover.jpg' });
      // Upload immediately
      await uploadFile(asset.uri, 'image/jpeg', 'cover');
    }
  };

  const pickProductFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setProductFile({
        uri: asset.uri,
        name: asset.name,
        size: asset.size,
      });
      // Upload immediately
      await uploadFile(asset.uri, asset.mimeType || 'application/octet-stream', 'file');
    }
  };

  const uploadFile = async (uri: string, mimeType: string, type: 'cover' | 'file') => {
    const setter = type === 'cover' ? setUploadingCover : setUploadingFile;
    setter(true);
    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Fetch the file as a blob
      const fetchFn = globalThis.fetch.bind(globalThis);
      const response = await fetchFn(uri);
      const blob = await response.blob();

      // Upload to Convex storage
      const uploadResponse = await fetchFn(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });

      const { storageId } = await uploadResponse.json();

      if (type === 'cover') {
        setCoverStorageId(storageId);
      } else {
        setFileStorageId(storageId);
      }
    } catch (err) {
      Alert.alert('Upload Error', 'Failed to upload file. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setter(false);
    }
  };

  // ─── Submit ─────────────────────────────────────────

  const handleSubmit = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Enter a product title.');
    if (!description.trim()) return Alert.alert('Required', 'Enter a description.');
    if (!deviceId) return Alert.alert('Error', 'Unable to identify user.');

    setSubmitting(true);
    try {
      const priceNum = parseFloat(price) || 0;

      if (editProductId) {
        const updates: any = {
          productId: editProductId,
          title: title.trim(),
          description: description.trim(),
          category,
          price: priceNum,
          previewText: previewText.trim() || undefined,
        };
        if (coverStorageId && coverStorageId !== editProduct?.coverImageId) {
          updates.coverImageId = coverStorageId;
        }
        if (fileStorageId && fileStorageId !== editProduct?.productFileId) {
          updates.productFileId = fileStorageId;
          updates.fileName = productFile?.name;
          updates.fileSize = productFile?.size;
        }
        await updateProduct(updates);
        Alert.alert('Updated', 'Your product has been updated.', [
          { text: 'OK', onPress: () => nav.goBack() },
        ]);
      } else {
        await createProduct({
          authorId: deviceId,
          authorName,
          title: title.trim(),
          description: description.trim(),
          category,
          price: priceNum,
          currency: 'GHS',
          fileType,
          previewText: previewText.trim() || undefined,
          coverImageId: coverStorageId ? (coverStorageId as any) : undefined,
          productFileId: fileStorageId ? (fileStorageId as any) : undefined,
          fileName: productFile?.name,
          fileSize: productFile?.size,
        });
        Alert.alert('Published!', 'Your product is now live on the marketplace.', [
          { text: 'OK', onPress: () => nav.goBack() },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{editProductId ? 'Edit Product' : 'Upload Product'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <Text style={s.label}>Cover Image</Text>
        <TouchableOpacity
          style={s.coverPicker}
          onPress={pickCoverImage}
          disabled={uploadingCover}
        >
          {uploadingCover ? (
            <ActivityIndicator color={colors.gold} />
          ) : coverImage ? (
            <Image source={{ uri: coverImage.uri }} style={s.coverPreview} />
          ) : coverStorageId ? (
            <View style={s.coverDone}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
              <Text style={s.coverDoneText}>Cover uploaded</Text>
            </View>
          ) : (
            <>
              <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
              <Text style={s.coverPickerText}>Tap to select cover image</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Title */}
        <Text style={s.label}>Product Title *</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. WASSCE Math Study Guide"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* Description */}
        <Text style={s.label}>Description *</Text>
        <TextInput
          style={[s.input, s.textArea]}
          placeholder="Describe what buyers will get..."
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={1000}
        />

        {/* Category */}
        <Text style={s.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[s.chip, category === cat.key && s.chipActive]}
              onPress={() => setCategory(cat.key)}
            >
              <Ionicons name={cat.icon as any} size={14} color={category === cat.key ? colors.gold : colors.textTertiary} />
              <Text style={[s.chipText, category === cat.key && s.chipTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* File Type */}
        <Text style={s.label}>File Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {FILE_TYPES.map((ft) => (
            <TouchableOpacity
              key={ft}
              style={[s.chip, fileType === ft && s.chipActive]}
              onPress={() => setFileType(ft)}
            >
              <Text style={[s.chipText, fileType === ft && s.chipTextActive]}>{ft}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Price */}
        <Text style={s.label}>Price (GHS) — Enter 0 for free</Text>
        <TextInput
          style={s.input}
          placeholder="0.00"
          placeholderTextColor={colors.textTertiary}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          maxLength={10}
        />

        {/* Product File Upload */}
        <Text style={s.label}>Product File *</Text>
        <TouchableOpacity
          style={s.filePicker}
          onPress={pickProductFile}
          disabled={uploadingFile}
        >
          {uploadingFile ? (
            <View style={s.filePickerInner}>
              <ActivityIndicator color={colors.gold} />
              <Text style={s.filePickerText}>Uploading...</Text>
            </View>
          ) : productFile ? (
            <View style={s.filePickerInner}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={s.fileName} numberOfLines={1}>{productFile.name}</Text>
                {productFile.size ? (
                  <Text style={s.fileSize}>{(productFile.size / 1024 / 1024).toFixed(2)} MB</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={pickProductFile}>
                <Text style={s.changeFile}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : fileStorageId ? (
            <View style={s.filePickerInner}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={s.filePickerText}>File uploaded</Text>
              <TouchableOpacity onPress={pickProductFile}>
                <Text style={s.changeFile}>Replace</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.filePickerInner}>
              <Ionicons name="cloud-upload-outline" size={28} color={colors.textTertiary} />
              <View style={{ flex: 1 }}>
                <Text style={s.filePickerTitle}>Upload Product File</Text>
                <Text style={s.filePickerHint}>PDF, ZIP, images, videos, documents</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Preview Text */}
        <Text style={s.label}>Preview Text (optional)</Text>
        <TextInput
          style={[s.input, s.textArea]}
          placeholder="A short sample or excerpt..."
          placeholderTextColor={colors.textTertiary}
          value={previewText}
          onChangeText={setPreviewText}
          multiline
          maxLength={500}
        />

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, submitting && { opacity: 0.5 }]}
          activeOpacity={0.8}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name={editProductId ? 'checkmark-circle' : 'rocket'} size={20} color={colors.textInverse} />
              <Text style={s.submitBtnText}>
                {editProductId ? 'Update Product' : 'Publish Product'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs, marginRight: spacing.md },
  headerTitle: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  content: { padding: spacing.lg },
  label: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.lg },
  input: { ...typography.body, color: colors.textPrimary, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  chipRow: { gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.goldMuted, borderColor: colors.gold },
  chipText: { ...typography.captionMedium, color: colors.textTertiary },
  chipTextActive: { color: colors.gold },
  coverPicker: { width: '100%', height: 160, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverDone: { alignItems: 'center', gap: spacing.sm },
  coverDoneText: { ...typography.caption, color: colors.success },
  coverPickerText: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.sm },
  filePicker: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  filePickerInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  filePickerTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  filePickerHint: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  filePickerText: { ...typography.body, color: colors.textSecondary },
  fileName: { ...typography.bodyMedium, color: colors.textPrimary },
  fileSize: { ...typography.caption, color: colors.textTertiary },
  changeFile: { ...typography.captionMedium, color: colors.gold },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.gold, paddingVertical: 16, borderRadius: borderRadius.full, marginTop: spacing.xxl },
  submitBtnText: { ...typography.h3, color: colors.textInverse },
});
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Share,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { getToolById, ToolDef, ToolTemplate, getToolLimits, isFreeGenerator, getToolCreditCost } from '../lib/tools';
import { generateText, generateTextWithImage, getImageUrl, validatePrompt, isGenerating } from '../lib/aiEngine';
import { saveResult } from '../lib/savedStorage';
import { canGenerate, incrementUsage, getUsageInfo, FREE_DAILY_LIMIT } from '../lib/usageTracker';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import { getCurrentUserEmail, getCurrentUserId } from '../lib/platformAuth';
import {
  Project,
  getProjects,
  createProject,
  addItemToProject,
} from '../lib/projectStorage';
import { addRecentTool } from './HomeScreen';
import { useA0Purchases } from 'a0-purchases';
import PaywallScreen from './PaywallScreen';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Hook that reveals text progressively for a typewriter feel */
function useTypewriter(fullText: string, speed: number = 8) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!fullText) {
      setDisplayed('');
      setDone(false);
      indexRef.current = 0;
      return;
    }

    setDone(false);
    indexRef.current = 0;
    setDisplayed('');

    const charsPerTick = Math.max(1, Math.ceil(fullText.length / 200)); // Scale speed with length
    timerRef.current = setInterval(() => {
      indexRef.current += charsPerTick;
      if (indexRef.current >= fullText.length) {
        setDisplayed(fullText);
        setDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setDisplayed(fullText.slice(0, indexRef.current));
      }
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fullText, speed]);

  const skip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDisplayed(fullText);
    setDone(true);
  };

  return { displayed, done, skip };
}

/** Animated text result that reveals progressively */
function TypewriterResult({ text, style }: { text: string; style: any }) {
  const { displayed, done, skip } = useTypewriter(text);
  return (
    <TouchableOpacity activeOpacity={1} onPress={done ? undefined : skip} disabled={done}>
      <Text style={style} selectable={done}>
        {displayed}
        {!done && <Text style={{ color: colors.gold }}>|</Text>}
      </Text>
      {!done && (
        <Text style={{ fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: 4, marginBottom: 4 }}>
          Tap to show all
        </Text>
      )}
    </TouchableOpacity>
  );
}

type Props = {
  route: {
    params: {
      toolId: string;
      preloadedPrompt?: string;
      preloadedResult?: string;
    };
  };
  navigation: any;
};

export default function ToolScreen({ route, navigation }: Props) {
  const { toolId, preloadedPrompt, preloadedResult } = route.params;
  const tool = getToolById(toolId);
  const { isPremium } = useA0Purchases();
  const userEmail = getCurrentUserEmail();
  const userId = getCurrentUserId();
  const creditWallet = useQuery(api.credits.getCreditBalance, userId ? { userId } : 'skip');
  const accessStatus = useQuery(api.credits.getAccessStatus, userId ? { userId } : 'skip');
  const consumeCredits = useMutation(api.credits.consumeCredits);
  const logGeneration = useMutation(api.credits.logGeneration);
  const logEducationalUse = useMutation(api.credits.logEducationalUse);
  const chargeGeneration = useMutation(api.credits.chargeGeneration);
  const generateOpenAI = useAction(api.openai.generateText);

  const [prompt, setPrompt] = useState(preloadedPrompt || '');
  const [result, setResult] = useState(preloadedResult || '');
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [saved, setSaved] = useState(!!preloadedResult);
  const [copied, setCopied] = useState(false);
  const [savedToGallery, setSavedToGallery] = useState(false);
  const [savingToGallery, setSavingToGallery] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ToolTemplate | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [isRegenerate, setIsRegenerate] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [savedToProject, setSavedToProject] = useState(false);
  const scrollRef = useRef<any>(null);

  // Sync state when route params change (e.g. reopening from Saved tab)
  useEffect(() => {
    setPrompt(preloadedPrompt || '');
    setResult(preloadedResult || '');
    setSaved(!!preloadedResult);
    setCopied(false);
    setSavedToGallery(false);
    setSavingToGallery(false);
    setImageLoading(false);
    setLoading(false);
    setSelectedTemplate(null);
    setImageUri(null);
    setImageBase64(null);
    // Track recent tool usage
    addRecentTool(toolId);
  }, [toolId, preloadedPrompt, preloadedResult]);

  useEffect(() => {
    getUsageInfo().then((info) => {
      setUsageCount(info.count);
    });
  }, [toolId]);

  if (!tool) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tool Not Found</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl }}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.errorText, { marginTop: spacing.md }]}>This tool could not be loaded</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const remaining = isPremium ? Infinity : Math.max(0, FREE_DAILY_LIMIT - usageCount);
  const hasTemplates = tool.templates && tool.templates.length > 0;
  const currentPlaceholder = selectedTemplate?.placeholder || tool.placeholder;
  const creditBalance = creditWallet?.balance ?? 0;
  const canUseEducational = !!accessStatus?.canUseFreeEducational;
  const needsCredits = !isPremium && !isFreeGenerator(tool.id) && tool.id !== 'homework-helper';
  const creditCost = getToolCreditCost(tool.id);

  const handlePickImage = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Please allow photo library access to upload images.');
        return;
      }
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (!pickerResult.canceled && pickerResult.assets[0]) {
        const asset = pickerResult.assets[0];
        setImageUri(asset.uri);
        setImageBase64(asset.base64 || null);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Please allow camera access to take photos.');
        return;
      }
      const pickerResult = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (!pickerResult.canceled && pickerResult.assets[0]) {
        const asset = pickerResult.assets[0];
        setImageUri(asset.uri);
        setImageBase64(asset.base64 || null);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleImageInput = () => {
    Alert.alert('Add Image', 'Choose how to add an image for analysis', [
      { text: 'Photo Library', onPress: handlePickImage },
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemoveImage = () => {
    setImageUri(null);
    setImageBase64(null);
  };

  const handleSelectTemplate = (tmpl: ToolTemplate) => {
    setSelectedTemplate((prev: ToolTemplate | null) => prev?.id === tmpl.id ? null : tmpl);
  };

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed && !imageBase64) return;

    // Rate limit: prevent concurrent generation
    if (isGenerating()) {
      Alert.alert('Please Wait', 'A generation is already in progress.');
      return;
    }

    // Prompt validation for text input
    if (trimmed) {
      const validation = validatePrompt(trimmed);
      if (!validation.valid) {
        Alert.alert('Invalid Prompt', validation.error);
        return;
      }
    }

    if (tool.id === 'homework-helper') {
      const check = accessStatus ?? (await canGenerate());
      if (!check.allowed && !(accessStatus?.canUseFreeEducational ?? false)) {
        Alert.alert(
          'Daily Limit Reached',
          `You've used all ${FREE_DAILY_LIMIT} free educational queries for today. Upgrade to Pro for unlimited access.`,
          [
            { text: 'OK' },
            { text: 'Upgrade to Pro', onPress: () => setShowPaywall(true) },
          ]
        );
        return;
      }
    } else if (!isPremium) {
      if (!userEmail) {
        Alert.alert('Sign In Required', 'Please sign in to use premium generators.');
        return;
      }
      if ((accessStatus?.canGeneratePaid ?? false) === false && creditBalance < creditCost) {
        Alert.alert(
          'Not Enough Credits',
          `This tool costs ${creditCost} credits. Buy credits or upgrade to Pro to continue.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: () => setShowPaywall(true) },
          ]
        );
        return;
      }
    }

    setLoading(true);
    setResult('');
    setSaved(false);
    setSavedToProject(false);
    setCopied(false);
    setFromCache(false);

    // Get tool cost optimization config
    const limits = getToolLimits(tool!.id);
    let wasCached = false;

    try {
      if (tool!.resultType === 'image') {
        const url = getImageUrl(trimmed, Math.floor(Math.random() * 100000));
        setImageLoading(true);
        setResult(url);
      } else {
        // Build system prompt with template context
        let systemPrompt = tool!.systemPrompt;
        if (selectedTemplate) {
          systemPrompt += '\n\n' + selectedTemplate.systemAddendum;
        }

        let genResult: { text: string; cached: boolean };
        if (imageBase64) {
          const imageContext = trimmed
            ? trimmed
            : 'Analyze this image and provide writing assistance based on what you see.';
          genResult = await generateTextWithImage(systemPrompt, imageContext, imageBase64, {
            tier: limits.tier,
            maxOutput: limits.maxOutput,
          });
        } else {
          const text = await generateOpenAI({
            systemPrompt,
            userPrompt: trimmed,
            tier: limits.tier,
            maxOutput: limits.maxOutput,
          });
          genResult = { text, cached: false };
        }
        setResult(genResult.text);
        setFromCache(genResult.cached);
        wasCached = genResult.cached;

        if (tool.id !== 'homework-helper' && !isPremium && userId && !wasCached) {
          const charge = await chargeGeneration({
            userId: userId,
            kind: tool.id,
            source: 'generation',
            reference: tool.id,
            note: tool.name,
          });
          if (!charge.success) {
            Alert.alert('Not Enough Credits', `This generation costs ${charge.cost} credits. Please buy more credits or upgrade.`);
            setLoading(false);
            return;
          }
        }

        await logGeneration({
          userId: userId || 'anonymous',
          toolId: tool.id,
          title: tool.name + (selectedTemplate ? ` — ${selectedTemplate.name}` : ''),
          kind: tool.resultType,
          status: 'completed',
          creditsUsed: tool.id === 'homework-helper' || isPremium || wasCached ? 0 : creditCost,
          prompt: trimmed,
          resultPreview: tool.resultType === 'text' ? genResult.text.slice(0, 240) : 'Image generated',
        });
      }
      // Only count usage for non-cached results
      if (!wasCached && tool.id === 'homework-helper') {
        const freeCheck = await logEducationalUse({ userId: userId || 'anonymous' });
        if (!freeCheck.success) {
          Alert.alert('Daily Limit Reached', 'Free educational access for today has been used. Please upgrade to Premium for more usage.');
          setLoading(false);
          return;
        }
        const newCount = await incrementUsage();
        setUsageCount(newCount);
      }
    } catch (e: any) {
      const errorMsg = e?.message || '';
      if (errorMsg.includes('timed out')) {
        setResult('Request timed out. Please check your internet connection and try again.');
      } else if (errorMsg.includes('API returned')) {
        setResult('Service temporarily unavailable. Please try again in a moment.');
      } else if (errorMsg.includes('already in progress')) {
        setResult('');
        Alert.alert('Please Wait', 'A generation is already in progress.');
      } else {
        setResult('Something went wrong. Please try again.');
      }
    }

    setLoading(false);
    setIsRegenerate(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const handleCopy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToGallery = async () => {
    if (!result || savingToGallery) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to save images.');
        return;
      }
      setSavingToGallery(true);
      const fileUri = FileSystem.cacheDirectory + `giga3_${Date.now()}.png`;
      const download = await FileSystem.downloadAsync(result, fileUri);
      await MediaLibrary.saveToLibraryAsync(download.uri);
      setSavedToGallery(true);
      Alert.alert('Saved', 'Image saved to your photo library.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save image. Please try again.');
    } finally {
      setSavingToGallery(false);
    }
  };

  const handleShareImage = async () => {
    if (!result) return;
    try {
      await Share.share({
        url: result,
        message: Platform.OS === 'android' ? result : undefined,
      });
    } catch (e) {
      // user cancelled
    }
  };

  const handleExportText = async () => {
    if (!result) return;
    try {
      const fileName = `${tool!.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, result, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: `Export ${tool!.name}`,
          UTI: 'public.plain-text',
        });
      } else {
        await Share.share({ message: result });
      }
    } catch (e) {
      // Fallback to plain share
      try {
        await Share.share({ message: result });
      } catch (_e) {}
    }
  };

  const handleSave = async () => {
    if (!result || saved) return;
    await saveResult({
      toolId: tool.id,
      toolName: tool.name + (selectedTemplate ? ` — ${selectedTemplate.name}` : ''),
      toolIcon: tool.icon,
      toolColor: tool.color,
      prompt: prompt.trim(),
      result,
      resultType: tool.resultType,
    });
    setSaved(true);
    Alert.alert('Saved', 'Result saved to your collection.');
  };

  const handleRegenerate = () => {
    setIsRegenerate(true);
    handleGenerate();
  };

  const handleSaveToProject = async (projectId: string) => {
    if (!result || !tool) return;
    await addItemToProject(projectId, {
      toolId: tool.id,
      toolName: tool.name + (selectedTemplate ? ` — ${selectedTemplate.name}` : ''),
      toolIcon: tool.icon,
      toolColor: tool.color,
      prompt: prompt.trim(),
      result,
      resultType: tool.resultType,
    });
    setShowProjectModal(false);
    setSavedToProject(true);
    Alert.alert('Saved', 'Result saved to project.');
  };

  const canSubmit = prompt.trim() || imageBase64;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.headerIcon, { backgroundColor: `${tool.color}20` }]}>
            <Ionicons name={tool.icon as any} size={18} color={tool.color} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {tool.name}
            </Text>
            <Text style={styles.headerSubtitle}>Giga3 AI</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Tool Info */}
            <View style={[styles.toolBanner, { borderColor: `${tool.color}30` }]}>
              <View style={[styles.toolBannerIcon, { backgroundColor: `${tool.color}20` }]}>
                <Ionicons name={tool.icon as any} size={28} color={tool.color} />
              </View>
              <Text style={styles.toolBannerName}>{tool.name}</Text>
              <Text style={styles.toolBannerDesc}>{tool.description}</Text>
            </View>

            {/* Template Selector */}
            {hasTemplates && (
              <View style={styles.templateSection}>
                <Text style={styles.inputLabel}>Choose a Template</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.templateScroll}
                >
                  {tool.templates!.map((tmpl) => {
                    const isActive = selectedTemplate?.id === tmpl.id;
                    return (
                      <TouchableOpacity
                        key={tmpl.id}
                        style={[
                          styles.templateChip,
                          isActive && { backgroundColor: `${tool.color}25`, borderColor: tool.color },
                        ]}
                        onPress={() => handleSelectTemplate(tmpl)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={tmpl.icon as any}
                          size={14}
                          color={isActive ? tool.color : colors.textTertiary}
                        />
                        <Text
                          style={[
                            styles.templateChipText,
                            isActive && { color: tool.color },
                          ]}
                          numberOfLines={1}
                        >
                          {tmpl.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Image Preview */}
            {imageUri && (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                <TouchableOpacity style={styles.removeImageBtn} onPress={handleRemoveImage}>
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
                <View style={styles.imagePreviewLabel}>
                  <Ionicons name="image" size={12} color={colors.gold} />
                  <Text style={styles.imagePreviewLabelText}>Image attached for analysis</Text>
                </View>
              </View>
            )}

            {/* Prompt Input */}
            <Text style={styles.inputLabel}>Your Prompt</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textInput}
                placeholder={currentPlaceholder}
                placeholderTextColor={colors.textTertiary}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                maxLength={3000}
                textAlignVertical="top"
              />
              <View style={styles.inputFooter}>
                {tool.supportsImage && (
                  <TouchableOpacity
                    style={styles.imageInputBtn}
                    onPress={handleImageInput}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera-outline" size={18} color={colors.textTertiary} />
                    <Text style={styles.imageInputBtnText}>
                      {imageUri ? 'Change' : 'Image'}
                    </Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.charCount}>
                  {prompt.length}/3000
                </Text>
              </View>
            </View>

            {/* Usage Hint */}
            {!isPremium && tool.id === 'homework-helper' && (
              <View style={styles.usageHint}>
                <Ionicons name="flash-outline" size={14} color={remaining > 1 ? colors.textTertiary : colors.warning} />
                <Text style={[styles.usageHintText, remaining <= 1 && { color: colors.warning }]}>
                  {remaining} of {FREE_DAILY_LIMIT} free educational queries remaining
                </Text>
              </View>
            )}

            {needsCredits && !isPremium && (
              <View style={styles.usageHint}>
                <Ionicons name="wallet-outline" size={14} color={colors.textTertiary} />
                <Text style={styles.usageHintText}>
                  This tool uses {creditCost} credits. Balance: {creditBalance}
                </Text>
              </View>
            )}

            {/* Generate Button */}
            <TouchableOpacity
              style={[
                styles.generateBtn,
                { backgroundColor: canSubmit ? colors.gold : colors.surfaceLight },
              ]}
              onPress={handleGenerate}
              disabled={!canSubmit || loading}
              activeOpacity={0.8}
            >
              {loading && tool.resultType === 'text' ? (
                <>
                  <ActivityIndicator size="small" color={colors.textInverse} />
                  <Text style={styles.generateBtnText}>Generating...</Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="sparkles"
                    size={18}
                    color={canSubmit ? colors.textInverse : colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.generateBtnText,
                      !canSubmit && { color: colors.textTertiary },
                    ]}
                  >
                    Generate
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Result Area */}
            {(result || (loading && tool.resultType === 'image')) && (
              <View style={styles.resultSection}>
                <View style={styles.resultHeader}>
                  <Ionicons name="sparkles" size={16} color={colors.gold} />
                  <Text style={styles.resultLabel}>Result</Text>
                  {fromCache && (
                    <View style={styles.cachedBadge}>
                      <Ionicons name="flash" size={10} color={colors.success} />
                      <Text style={styles.cachedBadgeText}>Instant</Text>
                    </View>
                  )}
                  {selectedTemplate && (
                    <View style={styles.resultTemplateBadge}>
                      <Text style={styles.resultTemplateBadgeText}>{selectedTemplate.name}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.resultCard}>
                  {tool.resultType === 'image' ? (
                    <View style={styles.imageWrap}>
                      {imageLoading && (
                        <View style={styles.imageLoader}>
                          <ActivityIndicator size="large" color={colors.gold} />
                          <Text style={styles.imageLoaderText}>Creating your image...</Text>
                        </View>
                      )}
                      {result !== '' && (
                        <Image
                          source={{ uri: result }}
                          style={[
                            styles.resultImage,
                            imageLoading && { position: 'absolute', opacity: 0 },
                          ]}
                          resizeMode="cover"
                          onLoad={() => {
                            setImageLoading(false);
                          }}
                          onError={() => {
                            setImageLoading(false);
                            setLoading(false);
                            setResult('');
                            Alert.alert('Error', 'Failed to generate image. Please try again.');
                          }}
                        />
                      )}
                    </View>
                  ) : (
                    <TypewriterResult text={result} style={styles.resultText} />
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={handleCopy}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={copied ? 'checkmark-circle' : 'copy-outline'}
                      size={18}
                      color={copied ? colors.success : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        copied && { color: colors.success },
                      ]}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>

                  {tool.resultType === 'image' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, savedToGallery && styles.actionBtnDone]}
                      onPress={handleSaveToGallery}
                      disabled={savedToGallery || savingToGallery}
                      activeOpacity={0.7}
                    >
                      {savingToGallery ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                      ) : (
                        <Ionicons
                          name={savedToGallery ? 'checkmark-circle' : 'download-outline'}
                          size={18}
                          color={savedToGallery ? colors.success : colors.textSecondary}
                        />
                      )}
                      <Text
                        style={[
                          styles.actionBtnText,
                          savedToGallery && { color: colors.success },
                        ]}
                      >
                        {savedToGallery ? 'Saved to Gallery' : 'Save to Gallery'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {tool.resultType === 'image' && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={handleShareImage}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
                      <Text style={styles.actionBtnText}>Share</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, saved && styles.actionBtnDone]}
                    onPress={handleSave}
                    disabled={saved}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={saved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={saved ? colors.gold : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        saved && { color: colors.gold },
                      ]}
                    >
                      {saved ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={handleRegenerate}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh" size={18} color={colors.textSecondary} />
                    <Text style={styles.actionBtnText}>Redo</Text>
                  </TouchableOpacity>

                  {tool.resultType === 'text' && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={handleExportText}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
                      <Text style={styles.actionBtnText}>Export</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* AI Disclaimer */}
                <View style={styles.disclaimer}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.disclaimerText}>
                    AI-generated content may contain mistakes. Always verify important information before use.
                    {tool.categories.includes('student') || tool.categories.includes('tutor')
                      ? ' Use AI responsibly and review all content before submission.'
                      : ''}
                  </Text>
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        <SaveToProjectModal
          visible={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          onSave={handleSaveToProject}
        />
        <PaywallScreen visible={showPaywall} onClose={() => setShowPaywall(false)} />
      </SafeAreaView>
    </View>
  );
}

const IMAGE_SIZE = SCREEN_WIDTH - spacing.lg * 2 - spacing.lg * 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backBtn: {
    padding: spacing.sm,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.gold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  toolBanner: {
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.xxl,
  },
  toolBannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  toolBannerName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  toolBannerDesc: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Template styles
  templateSection: {
    marginBottom: spacing.lg,
  },
  templateScroll: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateChipText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  // Image input styles
  imagePreviewWrap: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imagePreview: {
    width: '100%',
    height: 160,
  },
  removeImageBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  imagePreviewLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  imagePreviewLabelText: {
    ...typography.caption,
    color: colors.gold,
  },
  inputLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  inputWrap: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  textInput: {
    ...typography.body,
    color: colors.textPrimary,
    padding: spacing.lg,
    minHeight: 120,
    maxHeight: 200,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  imageInputBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
  },
  imageInputBtnText: {
    ...typography.small,
    color: colors.textTertiary,
  },
  charCount: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'right',
  },
  usageHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  usageHintText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xxl,
  },
  generateBtnText: {
    ...typography.h3,
    color: colors.textInverse,
  },
  resultSection: {
    marginTop: spacing.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resultLabel: {
    ...typography.captionMedium,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  cachedBadgeText: {
    ...typography.small,
    color: colors.success,
    fontSize: 10,
  },
  resultTemplateBadge: {
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: 'auto',
  },
  resultTemplateBadgeText: {
    ...typography.small,
    color: colors.gold,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resultText: {
    ...typography.body,
    color: colors.textPrimary,
    padding: spacing.lg,
    lineHeight: 24,
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  imageLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },
  imageLoaderText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  resultImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: borderRadius.md,
    margin: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: '30%',
    flexGrow: 1,
  },
  actionBtnDone: {
    borderColor: colors.goldMuted,
    backgroundColor: colors.goldMuted,
  },
  actionBtnText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
    borderRadius: borderRadius.md,
  },
  disclaimerText: {
    ...typography.caption,
    color: colors.textTertiary,
    flex: 1,
    lineHeight: 18,
  },
});

/** Save to Project Modal */
function SaveToProjectModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (projectId: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (visible) {
      getProjects().then((p: Project[]) => setProjects(p));
      setCreating(false);
      setNewName('');
    }
  }, [visible]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const project = await createProject(newName.trim());
    onSave(project.id);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={pms.overlay}>
        <View style={pms.container}>
          <View style={pms.header}>
            <Text style={pms.title}>Save to Project</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {creating ? (
            <View>
              <Text style={pms.label}>Project Name</Text>
              <TextInput
                style={pms.input}
                placeholder="e.g. English Revision"
                placeholderTextColor={colors.textTertiary}
                value={newName}
                onChangeText={setNewName}
                maxLength={60}
                autoFocus
              />
              <View style={pms.btnRow}>
                <TouchableOpacity style={pms.cancelBtn} onPress={() => setCreating(false)}>
                  <Text style={pms.cancelText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={pms.createBtn} onPress={handleCreate}>
                  <Ionicons name="checkmark" size={16} color={colors.textInverse} />
                  <Text style={pms.createText}>Create & Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              {projects.length > 0 && (
                <ScrollView style={pms.list}>
                  {projects.map((p: Project) => (
                    <TouchableOpacity
                      key={p.id}
                      style={pms.option}
                      activeOpacity={0.7}
                      onPress={() => onSave(p.id)}
                    >
                      <Ionicons name="folder" size={18} color={colors.gold} />
                      <View style={{ flex: 1 }}>
                        <Text style={pms.optName}>{p.name}</Text>
                        <Text style={pms.optSub}>{p.itemCount} items</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity style={pms.newBtn} activeOpacity={0.7} onPress={() => setCreating(true)}>
                <Ionicons name="add" size={18} color={colors.gold} />
                <Text style={pms.newBtnText}>New Project</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const pms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.lg },
  container: { backgroundColor: colors.surfaceLight, borderRadius: borderRadius.lg, padding: spacing.xxl, maxHeight: '60%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.h3, color: colors.textPrimary },
  label: { ...typography.captionMedium, color: colors.textTertiary, textTransform: 'uppercase' as const, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  list: { maxHeight: 250 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  optName: { ...typography.bodyMedium, color: colors.textPrimary },
  optSub: { ...typography.caption, color: colors.textTertiary },
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gold, borderStyle: 'dashed' as any, marginTop: spacing.sm },
  newBtnText: { ...typography.bodyMedium, color: colors.gold },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surface },
  cancelText: { ...typography.bodyMedium, color: colors.textSecondary },
  createBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.gold },
  createText: { ...typography.bodyMedium, color: colors.textInverse },
});
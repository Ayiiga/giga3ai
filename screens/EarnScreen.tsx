import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Share,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useA0Purchases } from 'a0-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { generateText } from '../lib/aiEngine';
import { canGenerate, incrementUsage } from '../lib/usageTracker';
import PaywallScreen from './PaywallScreen';
import { useNavigation } from '@react-navigation/native';
import { getCurrentUserEmail, getCurrentUserId } from '../lib/platformAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────────────
type Screen = 'dashboard' | 'income' | 'content' | 'product' | 'earnings';

type ChatMessage = {
  id: string;
  role: 'user' | 'ai';
  text: string;
};

type ContentType = 'facebook' | 'tiktok' | 'youtube';
type ProductType = 'ebook' | 'course' | 'business';

// ─── Constants ───────────────────────────────────────────────────────
const CONTENT_TYPES: { key: ContentType; label: string; icon: string }[] = [
  { key: 'facebook', label: 'Facebook Post', icon: 'logo-facebook' },
  { key: 'tiktok', label: 'TikTok Script', icon: 'videocam' },
  { key: 'youtube', label: 'YouTube Title', icon: 'logo-youtube' },
];

const PRODUCT_TYPES: { key: ProductType; label: string; icon: string; desc: string }[] = [
  { key: 'ebook', label: 'eBook Outline', icon: 'book', desc: 'Generate a complete eBook outline' },
  { key: 'course', label: 'Mini Course', icon: 'school', desc: 'Create a course curriculum' },
  { key: 'business', label: 'Business Plan', icon: 'briefcase', desc: 'Generate a business plan' },
];

// Demo earnings data
const DEMO_EARNINGS = {
  total: 0.0,
  currency: 'GHS',
  daily: [0, 0, 0, 0, 0, 0, 0],
  weekly: [0, 0, 0, 0],
  referrals: 0,
  referralLink: '',
  daysLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

// ─── System Prompts ──────────────────────────────────────────────────
const INCOME_SYSTEM = `You are an expert income strategist. When the user asks about making money, provide detailed, actionable step-by-step income ideas. Focus on practical methods anyone can start quickly. Include estimated earnings, time investment, and required skills. Be specific, motivating, and realistic. Format your response with clear numbered steps and sections.`;

const CONTENT_PROMPTS: Record<ContentType, string> = {
  facebook: `You are a viral Facebook content creator. Generate an engaging Facebook post that will get maximum engagement (likes, comments, shares). Include hooks, emotional triggers, call-to-actions, and relevant hashtags. Make it scroll-stopping and shareable.`,
  tiktok: `You are a viral TikTok script writer. Generate a complete TikTok video script with: Hook (first 3 seconds), Main content with timestamps, Transition cues, Call-to-action, Caption with hashtags, and Trending sound suggestions. Make it engaging and trend-worthy.`,
  youtube: `You are a YouTube SEO expert and title creator. Generate 10 click-worthy YouTube video titles that are SEO-optimized. Include: The titles, a brief description for each, suggested thumbnail concepts, and relevant tags. Focus on high CTR and searchability.`,
};

const PRODUCT_PROMPTS: Record<ProductType, string> = {
  ebook: `You are a bestselling eBook author and publisher. Generate a complete eBook outline including: Title and subtitle, Target audience, Chapter-by-chapter breakdown with key points, Introduction outline, Conclusion outline, Marketing blurb, and Suggested pricing. Make it comprehensive and market-ready.`,
  course: `You are an online course creation expert. Generate a complete mini course curriculum including: Course title and description, Target student profile, Module breakdown with lessons, Learning objectives per module, Assignment ideas, Pricing strategy, and Platform recommendations. Make it ready to create.`,
  business: `You are a business strategist and consultant. Generate a complete business plan outline including: Executive summary, Business description, Market analysis, Target audience, Revenue model, Marketing strategy, Financial projections, and Action plan with timeline. Make it investor-ready.`,
};

// ─── Device ID & Helpers ─────────────────────────────────────────────
const DEVICE_ID_KEY = 'giga3_earn_device_id';

function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = 'g3_' + Math.random().toString(36).substr(2, 10) + Date.now().toString(36);
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      }
      setDeviceId(id);
    })();
  }, []);
  return deviceId;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Main Component ──────────────────────────────────────────────────
export default function EarnScreen() {
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { isPremium } = useA0Purchases();
  const navigation = useNavigation<any>();

  const navigateTo = useCallback((s: Screen, requirePro = false) => {
    if (requirePro && !isPremium) {
      setPaywallVisible(true);
      return;
    }
    if (s === 'content') {
      navigation.navigate('Marketplace');
      return;
    }
    if (s === 'product') {
      navigation.navigate('UploadProduct');
      return;
    }
    if (s === 'earnings') {
      navigation.navigate('CreatorDashboard');
      return;
    }
    navigation.navigate('Marketplace');
  }, [isPremium, navigation]);

  return (
    <View style={styles.container}>
      <DashboardView navigateTo={navigateTo} isPremium={isPremium} />
      <PaywallScreen visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </View>
  );
}

// ─── Header Component ────────────────────────────────────────────────
function ScreenHeader({ title, onBack, rightAction }: { title: string; onBack: () => void; rightAction?: any }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.headerRight}>{rightAction}</View>
    </View>
  );
}

// ─── Pro Badge ───────────────────────────────────────────────────────
function ProBadge() {
  return (
    <View style={styles.proBadge}>
      <Ionicons name="diamond" size={10} color={colors.gold} />
      <Text style={styles.proBadgeText}>PRO</Text>
    </View>
  );
}

// ─── Dashboard View ──────────────────────────────────────────────────
function DashboardView({ navigateTo, isPremium }: { navigateTo: (s: Screen, pro?: boolean) => void; isPremium: boolean }) {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.dashboardContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sellHero}>
          <View style={styles.sellHeroTopRow}>
            <View style={styles.sellBadge}>
              <Ionicons name="pricetag-outline" size={14} color={colors.gold} />
              <Text style={styles.sellBadgeText}>Sell</Text>
            </View>
            <View style={styles.sellMiniStat}>
              <Text style={styles.sellMiniStatLabel}>Live items</Text>
              <Text style={styles.sellMiniStatValue}>0</Text>
            </View>
          </View>

          <Text style={styles.sellHeroTitle}>Sell digital products from one place</Text>
          <Text style={styles.sellHeroText}>Upload ebooks, study files, templates, project files, and other downloads. Share your store, track sales, and manage your creator workflow.</Text>

          <View style={styles.sellHeroActions}>
            <TouchableOpacity style={styles.sellPrimaryBtn} onPress={() => navigation.navigate('UploadProduct')} activeOpacity={0.8}>
              <Ionicons name="cloud-upload-outline" size={18} color={colors.textInverse} />
              <Text style={styles.sellPrimaryBtnText}>Upload Product</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sellSecondaryBtn} onPress={() => navigation.navigate('Marketplace')} activeOpacity={0.8}>
              <Ionicons name="storefront-outline" size={18} color={colors.gold} />
              <Text style={styles.sellSecondaryBtnText}>Open Store</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sellQuickGrid}>
          <TouchableOpacity style={styles.sellQuickCard} onPress={() => navigation.navigate('CreatorDashboard')} activeOpacity={0.8}>
            <Ionicons name="analytics-outline" size={22} color={colors.gold} />
            <Text style={styles.sellQuickTitle}>Creator Dashboard</Text>
            <Text style={styles.sellQuickText}>Track earnings, orders, and performance.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sellQuickCard} onPress={() => navigation.navigate('Marketplace')} activeOpacity={0.8}>
            <Ionicons name="search-outline" size={22} color={colors.gold} />
            <Text style={styles.sellQuickTitle}>Browse Marketplace</Text>
            <Text style={styles.sellQuickText}>See what buyers discover in the store.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sellQuickCard} onPress={() => navigation.navigate('UploadProduct')} activeOpacity={0.8}>
            <Ionicons name="document-text-outline" size={22} color={colors.gold} />
            <Text style={styles.sellQuickTitle}>Upload Ebook / File</Text>
            <Text style={styles.sellQuickText}>Publish PDFs, ZIPs, videos, and templates.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sellQuickCard} onPress={() => navigateTo('earnings', true)} activeOpacity={0.8}>
            <Ionicons name="flash-outline" size={22} color={colors.gold} />
            <Text style={styles.sellQuickTitle}>Growth Tools</Text>
            <Text style={styles.sellQuickText}>Unlock premium selling and promotion tools.</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sellSectionCard}>
          <Text style={styles.sellSectionTitle}>Best for selling</Text>
          <View style={styles.sellListItem}><Text style={styles.sellListDot}>•</Text><Text style={styles.sellListText}>Ebooks and guides</Text></View>
          <View style={styles.sellListItem}><Text style={styles.sellListDot}>•</Text><Text style={styles.sellListText}>Project files and source packs</Text></View>
          <View style={styles.sellListItem}><Text style={styles.sellListDot}>•</Text><Text style={styles.sellListText}>Templates and prompt packs</Text></View>
          <View style={styles.sellListItem}><Text style={styles.sellListDot}>•</Text><Text style={styles.sellListText}>Study notes, PDFs, and resources</Text></View>
        </View>

        <View style={styles.sellSectionCard}>
          <Text style={styles.sellSectionTitle}>Recommended next step</Text>
          <TouchableOpacity style={styles.sellPromoRow} onPress={() => navigation.navigate('UploadProduct')} activeOpacity={0.8}>
            <View style={styles.sellPromoIcon}><Ionicons name="add" size={18} color={colors.textInverse} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellPromoTitle}>Publish your first product</Text>
              <Text style={styles.sellPromoText}>Add a title, price, cover image, and file to start selling.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Income Generator (Chat) ─────────────────────────────────────────
function IncomeGeneratorView({ goBack, isPremium, onUpgrade }: { goBack: () => void; isPremium: boolean; onUpgrade: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'ai', text: 'Welcome! Ask me anything about making money online or offline. I\'ll give you step-by-step income ideas tailored to your situation.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<any>(null);

  const suggestions = [
    'How to make $100/day online?',
    'Side hustle ideas for students',
    'Passive income with $0 investment',
    'Freelancing for beginners',
  ];

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const check = await canGenerate();
    if (!check.allowed && !isPremium) {
      onUpgrade();
      return;
    }

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: msg };
    setMessages((prev: ChatMessage[]) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      await incrementUsage();
      const { text: responseText } = await generateText(INCOME_SYSTEM, msg);
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: responseText };
      setMessages((prev: ChatMessage[]) => [...prev, aiMsg]);
    } catch (_e) {
      const errMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: 'Sorry, something went wrong. Please try again.' };
      setMessages((prev: ChatMessage[]) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.chatBubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
      {item.role === 'ai' && (
        <View style={styles.aiBubbleHeader}>
          <Ionicons name="sparkles" size={14} color={colors.gold} />
          <Text style={styles.aiBubbleLabel}>Giga3 AI</Text>
        </View>
      )}
      <Text style={[styles.chatText, item.role === 'user' && styles.userChatText]}>{item.text}</Text>
      {item.role === 'ai' && item.id !== '0' && (
        <View style={styles.chatActions}>
          <TouchableOpacity
            style={styles.chatActionBtn}
            onPress={() => { Clipboard.setStringAsync(item.text); Alert.alert('Copied!'); }}
          >
            <Ionicons name="copy-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.chatActionText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chatActionBtn}
            onPress={() => Share.share({ message: item.text })}
          >
            <Ionicons name="share-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.chatActionText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Income Generator" onBack={goBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item: ChatMessage) => item.id}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={loading ? (
            <View style={[styles.chatBubble, styles.aiBubble, { flexDirection: 'row', gap: spacing.sm }]}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={styles.chatText}>Generating ideas...</Text>
            </View>
          ) : null}
          ListHeaderComponent={messages.length <= 1 ? (
            <View style={styles.suggestionsWrap}>
              <Text style={styles.suggestionsTitle}>Try asking:</Text>
              {suggestions.map((s, i) => (
                <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(s)} activeOpacity={0.7}>
                  <Ionicons name="flash" size={14} color={colors.gold} />
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        />
        <View style={styles.chatInputWrap}>
          <TextInput
            style={styles.chatInput}
            placeholder="Ask about income ideas..."
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={18} color={!input.trim() || loading ? colors.textTertiary : colors.textInverse} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Content Generator ───────────────────────────────────────────────
function ContentGeneratorView({ goBack, isPremium, onUpgrade }: { goBack: () => void; isPremium: boolean; onUpgrade: () => void }) {
  const [selectedType, setSelectedType] = useState<ContentType>('facebook');
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!topic.trim() || loading) return;

    const check = await canGenerate();
    if (!check.allowed && !isPremium) {
      onUpgrade();
      return;
    }

    setLoading(true);
    setResult('');
    try {
      await incrementUsage();
      const prompt = CONTENT_PROMPTS[selectedType as ContentType];
      const { text } = await generateText(prompt, `Topic/Niche: ${topic.trim()}`);
      setResult(text);
    } catch (_e) {
      Alert.alert('Error', 'Failed to generate content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Viral Content Generator" onBack={goBack} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.subScreenContent} showsVerticalScrollIndicator={false}>
        {/* Type Selector */}
        <Text style={styles.fieldLabel}>Content Type</Text>
        <View style={styles.typeSelector}>
          {CONTENT_TYPES.map(ct => (
            <TouchableOpacity
              key={ct.key}
              style={[styles.typeChip, selectedType === ct.key && styles.typeChipActive]}
              onPress={() => setSelectedType(ct.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={ct.icon as any} size={16} color={selectedType === ct.key ? colors.textInverse : colors.textSecondary} />
              <Text style={[styles.typeChipText, selectedType === ct.key && styles.typeChipTextActive]}>{ct.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Topic Input */}
        <Text style={styles.fieldLabel}>Topic / Niche</Text>
        <TextInput
          style={styles.textAreaInput}
          placeholder="e.g. fitness tips, cooking recipes, tech reviews..."
          placeholderTextColor={colors.textTertiary}
          value={topic}
          onChangeText={setTopic}
          multiline
          maxLength={300}
        />

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, (loading || !topic.trim()) && styles.generateBtnDisabled]}
          onPress={generate}
          disabled={loading || !topic.trim()}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={colors.textInverse} />
              <Text style={styles.generateBtnText}>Generate Content</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Result */}
        {(result || loading) && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Generated Content</Text>
              {result && (
                <View style={styles.resultActions}>
                  <TouchableOpacity
                    style={styles.resultActionBtn}
                    onPress={() => { Clipboard.setStringAsync(result); Alert.alert('Copied!'); }}
                  >
                    <Ionicons name="copy-outline" size={16} color={colors.gold} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.resultActionBtn}
                    onPress={() => Share.share({ message: result })}
                  >
                    <Ionicons name="share-outline" size={16} color={colors.gold} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {loading ? (
              <View style={styles.loadingResult}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.loadingResultText}>Creating viral content...</Text>
              </View>
            ) : (
              <Text style={styles.resultText}>{result}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Product Generator ───────────────────────────────────────────────
function ProductGeneratorView({ goBack, isPremium, onUpgrade }: { goBack: () => void; isPremium: boolean; onUpgrade: () => void }) {
  const [selectedType, setSelectedType] = useState<ProductType>('ebook');
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const generate = async () => {
    if (!topic.trim() || loading) return;

    const check = await canGenerate();
    if (!check.allowed && !isPremium) {
      onUpgrade();
      return;
    }

    setLoading(true);
    setResult('');
    setPreviewing(false);
    try {
      await incrementUsage();
      const prompt = PRODUCT_PROMPTS[selectedType as ProductType];
      const { text } = await generateText(prompt, `Topic/Niche: ${topic.trim()}`);
      setResult(text);
      setPreviewing(true);
    } catch (_e) {
      Alert.alert('Error', 'Failed to generate. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Digital Product Generator" onBack={goBack} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.subScreenContent} showsVerticalScrollIndicator={false}>
        {/* Product Type Cards */}
        <Text style={styles.fieldLabel}>Product Type</Text>
        <View style={styles.productTypeGrid}>
          {PRODUCT_TYPES.map(pt => (
            <TouchableOpacity
              key={pt.key}
              style={[styles.productTypeCard, selectedType === pt.key && styles.productTypeCardActive]}
              onPress={() => setSelectedType(pt.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.productTypeIcon, selectedType === pt.key && styles.productTypeIconActive]}>
                <Ionicons name={pt.icon as any} size={22} color={selectedType === pt.key ? colors.textInverse : colors.gold} />
              </View>
              <Text style={[styles.productTypeLabel, selectedType === pt.key && styles.productTypeLabelActive]}>{pt.label}</Text>
              <Text style={styles.productTypeDesc}>{pt.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Topic */}
        <Text style={styles.fieldLabel}>Topic / Idea</Text>
        <TextInput
          style={styles.textAreaInput}
          placeholder="e.g. weight loss for busy moms, learn Python..."
          placeholderTextColor={colors.textTertiary}
          value={topic}
          onChangeText={setTopic}
          multiline
          maxLength={300}
        />

        {/* Generate */}
        <TouchableOpacity
          style={[styles.generateBtn, (loading || !topic.trim()) && styles.generateBtnDisabled]}
          onPress={generate}
          disabled={loading || !topic.trim()}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={colors.textInverse} />
              <Text style={styles.generateBtnText}>Generate Product</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Preview */}
        {(previewing || loading) && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="eye" size={16} color={colors.gold} />
                <Text style={styles.resultTitle}>Preview</Text>
              </View>
              {result && (
                <View style={styles.resultActions}>
                  <TouchableOpacity
                    style={styles.resultActionBtn}
                    onPress={() => { Clipboard.setStringAsync(result); Alert.alert('Copied!'); }}
                  >
                    <Ionicons name="copy-outline" size={16} color={colors.gold} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.resultActionBtn}
                    onPress={() => Share.share({ message: result })}
                  >
                    <Ionicons name="share-outline" size={16} color={colors.gold} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {loading ? (
              <View style={styles.loadingResult}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.loadingResultText}>Building your product...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultText}>{result}</Text>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={() => {
                    Clipboard.setStringAsync(result);
                    Alert.alert('Saved!', 'Product content copied. You can paste it into your favorite editor.');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="download-outline" size={18} color={colors.textInverse} />
                  <Text style={styles.saveBtnText}>Save & Copy</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Earnings Dashboard ──────────────────────────────────────────────
function EarningsDashboardView({ goBack }: { goBack: () => void }) {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const data = period === 'daily' ? DEMO_EARNINGS.daily : DEMO_EARNINGS.weekly;
  const labels = period === 'daily' ? DEMO_EARNINGS.daysLabels : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const maxVal = Math.max(...data, 1);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title="Earnings Dashboard" onBack={goBack} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.subScreenContent} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Earnings</Text>
            <Text style={styles.summaryValue}>GHS 0.00</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Referrals</Text>
            <Text style={styles.summaryValue}>0</Text>
          </View>
        </View>

        {/* Period Toggle */}
        <View style={styles.periodToggle}>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'daily' && styles.periodBtnActive]}
            onPress={() => setPeriod('daily')}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodBtnText, period === 'daily' && styles.periodBtnTextActive]}>Daily</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, period === 'weekly' && styles.periodBtnActive]}
            onPress={() => setPeriod('weekly')}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodBtnText, period === 'weekly' && styles.periodBtnTextActive]}>Weekly</Text>
          </TouchableOpacity>
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{period === 'daily' ? 'This Week' : 'This Month'}</Text>
          <View style={styles.chartArea}>
            {data.map((val, i) => (
              <View key={i} style={styles.chartBar}>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { height: `${Math.max((val / maxVal) * 100, 4)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{labels[i]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.chartLegend}>
            <Text style={styles.chartLegendText}>Earnings shown in GHS</Text>
          </View>
        </View>

        {/* Referral Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>Referral Stats</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Referrals</Text>
            <Text style={styles.statValue}>0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Active Referrals</Text>
            <Text style={styles.statValue}>0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Pending Earnings</Text>
            <Text style={styles.statValue}>GHS 0.00</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Total Earned</Text>
            <Text style={[styles.statValue, { color: colors.gold }]}>GHS 0.00</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={styles.infoText}>Earnings will update as you start referring users and generating income through the platform.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  dashboardContent: { padding: spacing.lg, paddingBottom: 80 },
  subScreenContent: { padding: spacing.lg, paddingBottom: 100 },
  sellHero: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  sellHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sellBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  sellBadgeText: { ...typography.captionMedium, color: colors.gold, fontWeight: '700' },
  sellMiniStat: { alignItems: 'flex-end' },
  sellMiniStatLabel: { ...typography.caption, color: colors.textTertiary },
  sellMiniStatValue: { ...typography.h2, color: colors.textPrimary },
  sellHeroTitle: { ...typography.h1, color: colors.textPrimary, lineHeight: 34 },
  sellHeroText: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  sellHeroActions: { gap: spacing.sm, marginTop: spacing.xs },
  sellPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  sellPrimaryBtnText: { ...typography.bodyMedium, color: colors.textInverse },
  sellSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sellSecondaryBtnText: { ...typography.bodyMedium, color: colors.gold },
  sellQuickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  sellQuickCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  sellQuickTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  sellQuickText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  sellSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sellSectionTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  sellListItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sellListDot: { ...typography.bodyMedium, color: colors.gold, lineHeight: 20 },
  sellListText: { ...typography.body, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  sellPromoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sellPromoIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  sellPromoTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  sellPromoText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { padding: spacing.xs, marginRight: spacing.md },
  headerTitle: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  headerRight: { width: 40, alignItems: 'flex-end' },

  // Dashboard
  earnQuickHub: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  earnHubTitle: { ...typography.h2, color: colors.textPrimary },
  earnHubText: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  earnHubPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  earnHubPrimaryText: { ...typography.bodyMedium, color: colors.textInverse },
  earnHubSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  earnHubSecondaryText: { ...typography.bodyMedium, color: colors.gold },
  earnSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  earnSectionTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: spacing.sm },
  earnSectionBody: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  // Notification
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notifText: { ...typography.body, color: colors.textPrimary, flex: 1 },

  // Premium Earnings Card
  premiumCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  earnTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  earnLbl: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  earnBig: { fontSize: 32, fontWeight: '700', color: colors.gold, letterSpacing: -0.5 },
  walletBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  breakItem: { flex: 1, alignItems: 'center' },
  breakLbl: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  breakVal: { ...typography.h3, color: colors.textPrimary },
  breakDivider: { width: 1, height: 30, backgroundColor: colors.border },
  progSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  progTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  progLbl: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  progPct: { ...typography.h3, color: colors.textPrimary, fontWeight: '700' },
  progBar: { height: 10, backgroundColor: colors.surfaceLight, borderRadius: 5 },
  progFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 5 },

  // Productivity Actions
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  qAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  qActIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldMuted, alignItems: "center" as const, justifyContent: "center" as const },
  qActDetails: { flex: 1 },
  qActLbl: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: spacing.sm },
  qActDesc: { ...typography.caption, color: colors.textSecondary },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  newBadgeText: { ...typography.small, color: colors.gold, fontWeight: '600' },

  // Referral
  refCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  refTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  refTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  refDesc: { ...typography.caption, color: colors.textSecondary },
  refStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rstat: { flex: 1, alignItems: 'center' },
  rstatVal: { ...typography.h3, color: colors.textPrimary, marginBottom: 2 },
  rstatLbl: { ...typography.caption, color: colors.textTertiary },
  rstatDiv: { width: 1, height: 30, backgroundColor: colors.border },
  refLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    paddingLeft: spacing.md,
    gap: spacing.sm,
  },
  refLinkText: { ...typography.caption, color: colors.textSecondary, flex: 1 },

  // Affiliate Products
  prodCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  prodTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  prodName: { ...typography.bodyMedium, color: colors.textPrimary },
  prodDesc: { ...typography.caption, color: colors.textSecondary },
  commBadge: { backgroundColor: colors.goldMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  commText: { ...typography.small, color: colors.gold, fontWeight: '700' },
  prodStatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ps: { flex: 1, alignItems: 'center' },
  psLbl: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  psVal: { ...typography.h3, color: colors.textPrimary },
  psDiv: { width: 1, height: 30, backgroundColor: colors.border },
  prodBtns: { flexDirection: 'row', gap: spacing.sm },
  pbtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceLight, padding: spacing.sm, borderRadius: borderRadius.full },
  pbtnAlt: { backgroundColor: colors.gold },
  pbtnText: { ...typography.body, color: colors.textPrimary },

  // Payout
  withdrawCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  withdrawTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  withdrawBalance: { ...typography.h3, color: colors.textPrimary },
  withdrawMinLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
  },
  withdrawBtnDisabled: { backgroundColor: colors.surfaceLight },
  withdrawBtnText: { ...typography.bodyMedium, color: colors.textInverse },
  withdrawProgSection: { gap: spacing.sm, marginBottom: spacing.md },
  withdrawProgBar: { height: 10, backgroundColor: colors.surfaceLight, borderRadius: 5, overflow: 'hidden' },
  withdrawProgFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 5 },
  withdrawProgLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  withdrawMethods: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  withdrawMethod: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  withdrawMethodText: { ...typography.caption, color: colors.textSecondary },

  // Coming Soon Banner
  withdrawNoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  comingSoonText: {
    ...typography.caption,
    color: colors.warning,
    flex: 1,
    lineHeight: 18,
  },
  withdrawHistory: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  withdrawHistoryTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  withdrawHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  withdrawHistoryAmount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  withdrawHistoryMeta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  withdrawStatusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  withdrawStatusPending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  withdrawStatusApproved: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  withdrawStatusText: {
    ...typography.caption,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },

  // Daily Task Rewards
  dailyTasksCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  dailyTasksHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  dailyTasksHeaderText: { ...typography.bodyMedium, color: colors.textPrimary },
  dailyTasksEarned: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  dailyTasksRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dailyTaskRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.md, marginBottom: spacing.xs },
  dailyTaskRowDone: { backgroundColor: 'rgba(212, 168, 83, 0.15)' },
  dailyTaskCheck: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dailyTaskCheckDone: { backgroundColor: colors.gold, borderColor: colors.gold, borderWidth: 2 },
  dailyTaskLabel: { ...typography.body, color: colors.textSecondary, flex: 1 },
  dailyTaskLabelDone: { ...typography.body, color: colors.textPrimary },
  dailyTaskReward: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.sm },
  dailyTaskRewardDone: { backgroundColor: colors.surfaceLight, borderRadius: 12, padding: spacing.sm },
  dailyTaskRewardText: { ...typography.body, color: colors.textSecondary },

  // Pro Badge
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  proBadgeText: { fontSize: 9, fontWeight: '700', color: colors.gold },

  // Earnings Card
  earningsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  earningsCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  earningsLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  earningsAmount: { fontSize: 32, fontWeight: '700', color: colors.gold, letterSpacing: -0.5 },
  earningsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  earningsHint: { ...typography.caption, color: colors.textTertiary },

  // Quick Actions
  quickActions: { gap: spacing.sm, marginBottom: spacing.xxl },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },

  // Affiliate
  affiliateCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  affiliateTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  affiliateIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affiliateTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  affiliateDesc: { ...typography.caption, color: colors.textSecondary },
  affiliateStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  affiliateStat: { flex: 1, alignItems: 'center' },
  affiliateStatValue: { ...typography.h3, color: colors.textPrimary, marginBottom: 2 },
  affiliateStatLabel: { ...typography.caption, color: colors.textTertiary },
  affiliateStatDivider: { width: 1, height: 30, backgroundColor: colors.border },
  referralLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    paddingLeft: spacing.md,
    gap: spacing.sm,
  },
  referralLink: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  copyLinkText: { ...typography.small, color: colors.textInverse, fontWeight: '600' },

  // Tips
  tipsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { ...typography.body, color: colors.textSecondary, flex: 1 },

  // Chat
  chatList: { padding: spacing.lg, paddingBottom: spacing.sm },
  chatBubble: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    maxWidth: '88%',
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.aiBubble,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  aiBubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  aiBubbleLabel: { ...typography.small, color: colors.gold },
  chatText: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
  userChatText: { color: colors.textPrimary },
  chatActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  chatActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chatActionText: { ...typography.small, color: colors.textTertiary },
  suggestionsWrap: { marginBottom: spacing.lg, gap: spacing.sm },
  suggestionsTitle: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: { ...typography.body, color: colors.textSecondary },

  // Chat input
  chatInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  chatInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.surfaceLight },

  // Field
  fieldLabel: { ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.sm },
  textAreaInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },

  // Type Selector
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  typeChipText: { ...typography.captionMedium, color: colors.textSecondary },
  typeChipTextActive: { color: colors.textInverse },

  // Product Types
  productTypeGrid: { gap: spacing.sm, marginBottom: spacing.xl },
  productTypeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  productTypeCardActive: { borderColor: colors.gold, backgroundColor: colors.surfaceLight },
  productTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  productTypeIconActive: { backgroundColor: colors.gold },
  productTypeLabel: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  productTypeLabelActive: { color: colors.gold },
  productTypeDesc: { ...typography.caption, color: colors.textTertiary },

  // Generate Btn
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xl,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { ...typography.h3, color: colors.textInverse },

  // Result
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  resultTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  resultActions: { flexDirection: 'row', gap: spacing.sm },
  resultActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  loadingResult: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  loadingResultText: { ...typography.body, color: colors.textTertiary },

  // Save Btn
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  saveBtnText: { ...typography.bodyMedium, color: colors.textInverse },

  // Earnings Dashboard
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  summaryLabel: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.xs },
  summaryValue: { ...typography.h2, color: colors.gold },

  // Period Toggle
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  periodBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.full, alignItems: 'center' },
  periodBtnActive: { backgroundColor: colors.gold },
  periodBtnText: { ...typography.captionMedium, color: colors.textTertiary },
  periodBtnTextActive: { color: colors.textInverse, fontWeight: '700' },

  // Chart
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  chartTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: spacing.lg },
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: spacing.sm },
  chartBar: { flex: 1, alignItems: 'center' },
  barContainer: { width: '100%', height: 130, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '60%', backgroundColor: colors.gold, borderRadius: 4, minHeight: 4 },
  barLabel: { ...typography.small, color: colors.textTertiary, marginTop: spacing.xs },
  chartLegend: { alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  chartLegendText: { ...typography.small, color: colors.textTertiary },

  // Stats Card
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  statsCardTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: spacing.lg },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  statLabel: { ...typography.body, color: colors.textSecondary },
  statValue: { ...typography.bodyMedium, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.border },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  infoText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 20 },

  // How It Works
  howItWorksCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  howStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepNumText: {
    ...typography.captionMedium,
    fontWeight: '700',
  },
  howStepText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  rulesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  rulesLinkText: {
    ...typography.captionMedium,
    color: colors.gold,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  disclaimerText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 20 },

  // Withdrawal Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  methodChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  methodChipText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  methodChipTextActive: {
    color: colors.textInverse,
  },
  modalInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  modalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  modalSummaryText: {
    ...typography.caption,
    color: colors.textTertiary,
    flex: 1,
  },
  modalPrimaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  modalPrimaryBtnDisabled: {
    opacity: 0.7,
  },
  modalPrimaryBtnText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
  },
});

// ─── Quick Action Card ───────────────────────────────────────────────
function QuickActionCard({ icon, label, color, onPress, pro }: { icon: string; label: string; color: string; onPress: () => void; pro?: boolean }) {
  return (
    <TouchableOpacity style={styles.quickActionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
      {pro && <ProBadge />}
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginTop: spacing.xs }} />
    </TouchableOpacity>
  );
}
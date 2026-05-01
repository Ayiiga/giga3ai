import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import a0 from 'a0-sdk';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { getToolById, ToolDef, isFreeGenerator } from '../lib/tools';
import { useCategory, CategoryKey } from '../lib/categoryContext';
import { getProjects } from '../lib/projectStorage';
import { syncSubscriptionFromDB, getUsageInfo } from '../lib/usageTracker';
import PaywallScreen from './PaywallScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HP = spacing.lg;
const GAP = spacing.md;
const QUICK_W = (SCREEN_WIDTH - HP * 2 - GAP) / 2;
const CARD_W = Math.min(240, SCREEN_WIDTH * 0.72);
const HERO_GRADIENT: [string, string] = ['rgba(212,168,83,0.24)', 'rgba(17,24,39,0.96)'];
const RECENT_KEY = 'giga3_recent_tools';

const QUICK_ACTIONS = [
  { toolId: 'homework-helper', label: 'Homework', icon: 'school', accent: colors.info },
  { toolId: 'quiz-generator', label: 'Quiz', icon: 'help-circle', accent: colors.warning },
  { toolId: 'study-planner', label: 'Study Plan', icon: 'calendar', accent: colors.success },
  { toolId: 'book-writer', label: 'Book Writer', icon: 'book', accent: colors.gold },
];

const FEATURED_IDS = ['thesis-writer', 'research-paper', 'business-plan-builder', 'script-generator'];
const EDUCATION_IDS = ['homework-helper', 'study-planner', 'flashcards-generator', 'past-questions', 'study-notes-generator', 'quiz-generator'];
const TRENDING_TOOL_IDS = ['homework-helper', 'thesis-writer', 'book-writer', 'script-generator', 'marketing-copy', 'business-plan-builder'];

const SECTION_DEALS = [
  { id: 'credits-50', title: 'Credits from GHS 50', desc: 'Start small and unlock paid generations.', badge: 'ENTRY', cta: 'Buy Credits' },
  { id: 'credits-200', title: 'Best Value Credits', desc: 'More room for videos, PDFs, and books.', badge: 'POPULAR', cta: 'Get More' },
  { id: 'monthly-40', title: 'Monthly from GHS 40', desc: 'Stay flexible with a low-entry premium plan.', badge: 'MONTHLY', cta: 'Upgrade' },
  { id: 'yearly-420', title: 'Yearly savings', desc: 'Lower annual total than monthly accumulation.', badge: 'SAVE MORE', cta: 'See Deals' },
];

const CHAT_PROMPTS = [
  'Solve my homework step by step',
  'Write an essay for me',
  'Explain this topic simply',
  'Give me exam revision help',
];

type AccessState = {
  count: number;
  limit: number;
  remaining: number;
  isPro: boolean;
  planTier: string;
  percentage: number;
};

async function getRecentTools(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addRecentTool(toolId: string): Promise<void> {
  try {
    const existing = await getRecentTools();
    const updated = [toolId, ...existing.filter((id: string) => id !== toolId)].slice(0, 8);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const ROLES: { key: CategoryKey; label: string; icon: string; gradient: [string, string] }[] = [
  { key: 'student', label: 'Student', icon: 'school', gradient: ['#3B82F6', '#2563EB'] },
  { key: 'tutor', label: 'Tutor', icon: 'people', gradient: ['#22C55E', '#16A34A'] },
  { key: 'creator', label: 'Creator', icon: 'color-palette', gradient: ['#A855F7', '#9333EA'] },
  { key: 'entrepreneur', label: 'Business', icon: 'briefcase', gradient: ['#F59E0B', '#D97706'] },
];

const SUGGESTION_IDS: Record<string, string[]> = {
  student: ['study-planner', 'homework-helper', 'flashcards-generator', 'past-questions', 'quiz-generator', 'explain-like-10'],
  tutor: ['course-outline', 'quiz-generator', 'essay-writer', 'study-planner', 'copywriting-assistant', 'thesis-writer'],
  creator: ['caption-generator', 'script-generator', 'hook-generator', 'ai-image-generator', 'book-writer', 'marketing-copy'],
  entrepreneur: ['business-plan-builder', 'pitch-deck-generator', 'business-name-generator', 'sales-copy-generator', 'marketing-copy', 'email-writer'],
};

function PulseOrb() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 0, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return <Animated.View style={[styles.glowOrb, { transform: [{ scale }], opacity }]} />;
}

function FlashTag({ label }: { label: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View style={[styles.flashTag, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }]}>
      <Text style={styles.flashTagText}>{label}</Text>
    </Animated.View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

function ToolRail({
  title,
  badge,
  items,
  onPress,
  accent,
  compact = false,
}: {
  title: string;
  badge: string;
  items: ToolDef[];
  onPress: (toolId: string) => void;
  accent: string;
  compact?: boolean;
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <FlashTag label={badge} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolRail}>
        {items.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[compact ? styles.compactCard : styles.toolCard, { width: compact ? 180 : CARD_W }]}
            onPress={() => onPress(tool.id)}
            activeOpacity={0.8}
          >
            <View style={styles.cardTop}>
              <View style={[styles.cardIcon, { backgroundColor: `${tool.color}18` }]}>
                <Ionicons name={tool.icon as any} size={20} color={tool.color} />
              </View>
              <View style={[styles.cardBadge, { backgroundColor: `${accent}18` }]}>
                <Text style={[styles.cardBadgeText, { color: accent }]}>
                  {isFreeGenerator(tool.id) ? 'FREE' : 'PRO'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>{tool.name}</Text>
            <Text style={styles.cardDesc} numberOfLines={3}>{tool.description}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {tool.templates?.length ? `${tool.templates.length} templates` : isFreeGenerator(tool.id) ? 'Daily free access' : 'Premium ready'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function ProductRail({
  title,
  badge,
  products,
  onPress,
}: {
  title: string;
  badge: string;
  products: any[];
  onPress: (productId: string) => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <FlashTag label={badge} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRail}>
        {products.map((product) => (
          <TouchableOpacity key={product._id} style={styles.productCard} activeOpacity={0.8} onPress={() => onPress(product._id)}>
            <View style={styles.productThumb}>
              <Ionicons name={product.fileType === 'PDF' ? 'document-text' : 'cube'} size={22} color={colors.gold} />
            </View>
            <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
            <Text style={styles.productMeta}>{product.category}</Text>
            <Text style={styles.productPrice}>GHS {product.price?.toFixed?.(2) ?? product.price}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function PromoCard({
  title,
  desc,
  cta,
  icon,
  onPress,
  highlight,
}: {
  title: string;
  desc: string;
  cta: string;
  icon: string;
  onPress: () => void;
  highlight?: string;
}) {
  return (
    <TouchableOpacity style={styles.promoCard} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.promoIconWrap}>
        <Ionicons name={icon as any} size={22} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.promoTitle}>{title}</Text>
        <Text style={styles.promoDesc}>{desc}</Text>
      </View>
      <View style={styles.promoCtaWrap}>
        {highlight ? <Text style={styles.promoHighlight}>{highlight}</Text> : null}
        <Text style={styles.promoCta}>{cta}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { category, setCategory } = useCategory();
  const insets = useSafeAreaInsets();
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [homePrompt, setHomePrompt] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [usageInfo, setUsageInfo] = useState<AccessState | null>(null);

  const user = a0?.auth?.getUser?.();
  const userId = user?.id || user?.email || '';
  const subscription = useQuery(api.subscriptions.getActive, userId ? { userId } : 'skip');
  const accessStatus = useQuery(api.credits.getAccessStatus, userId ? { userId } : 'skip');
  const creditWallet = useQuery(api.credits.getCreditBalance, userId ? { userId } : 'skip');
  const referralSummary = useQuery(api.referrals.getReferralSummary, userId ? { userId } : 'skip');
  const marketplaceProducts = useQuery(api.marketplace.listProducts, { sortBy: 'downloads' });

  useFocusEffect(
    useCallback(() => {
      getRecentTools().then(setRecentIds);
      getProjects().then((p) => setProjectCount(p.length));
      getUsageInfo().then((info) => setUsageInfo(info as AccessState));
    }, [])
  );

  useEffect(() => {
    if (subscription !== undefined) syncSubscriptionFromDB(subscription);
  }, [subscription]);

  const go = useCallback((toolId: string) => {
    addRecentTool(toolId);
    navigation.navigate('Tool', { toolId });
  }, [navigation]);

  const goWorkspace = () => navigation.navigate('Workspace');

  const goChat = useCallback((prompt?: string) => {
    const initialPrompt = (prompt ?? homePrompt).trim();
    const freeLeft = accessStatus?.educationalRemaining ?? usageInfo?.remaining ?? 0;
    if (freeLeft <= 0 && !accessStatus?.isPremium) {
      setShowPaywall(true);
      return;
    }
    navigation.navigate('ChatAI', initialPrompt ? { initialPrompt } : undefined);
  }, [accessStatus?.educationalRemaining, accessStatus?.isPremium, homePrompt, navigation, usageInfo?.remaining]);

  const recentTools = recentIds.map(getToolById).filter(Boolean) as ToolDef[];
  const featuredTools = FEATURED_IDS.map(getToolById).filter(Boolean) as ToolDef[];
  const educationTools = EDUCATION_IDS.map(getToolById).filter(Boolean) as ToolDef[];
  const trendingTools = TRENDING_TOOL_IDS.map(getToolById).filter(Boolean) as ToolDef[];
  const topProducts = (marketplaceProducts ?? []).slice(0, 6);

  const freeUsed = accessStatus?.educationalUsed ?? usageInfo?.count ?? 0;
  const freeLeft = accessStatus?.educationalRemaining ?? usageInfo?.remaining ?? 0;
  const freeLimit = accessStatus?.educationalRemaining !== undefined ? freeUsed + freeLeft : usageInfo?.limit ?? 0;
  const credits = creditWallet?.balance ?? 0;
  const hasPremium = !!subscription || !!accessStatus?.isPremium;
  const activeSubLabel = subscription ? `${subscription.plan?.replace(/-/g, ' ')} • ${(subscription.billingPeriod ?? 'monthly')}` : 'No active premium plan';
  const referralLink = referralSummary?.link || 'Share your link to start earning';
  const isLimitReached = freeLimit > 0 && freeLeft <= 0 && !hasPremium;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <View style={styles.brandRow}>
                <Text style={styles.brand}>Giga3 AI</Text>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={10} color={colors.gold} />
                  <Text style={styles.aiBadgeText}>LIVE</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.topAction} onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
              <Ionicons name="person" size={18} color={colors.gold} />
            </TouchableOpacity>
          </View>

          <LinearGradient colors={HERO_GRADIENT} style={styles.hero}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroOrbWrap}>
                <PulseOrb />
                <Ionicons name="sparkles" size={28} color={colors.gold} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroKicker}>Premium AI. Free chat first.</Text>
                <Text style={styles.heroTitle}>Ask Giga3 AI Anything</Text>
                <Text style={styles.heroSub}>Homework, writing, research, voice and text chat — built for students and growth.</Text>
              </View>
            </View>

            <View style={styles.heroStatsRow}>
              <HeroStat label="Free chats today" value={freeLimit ? `${freeLeft}/${freeLimit}` : 'Unlimited'} />
              <HeroStat label="Credit balance" value={`GHS ${credits.toFixed(2)}`} />
              <HeroStat label="Subscription" value={hasPremium ? 'Active' : 'Free'} />
            </View>

            <View style={styles.heroInputCard}>
              <View style={styles.heroInputHead}>
                <Text style={styles.heroInputLabel}>Ask Giga3 AI Anything</Text>
                <FlashTag label={isLimitReached ? 'Upgrade to continue' : 'Free today'} />
              </View>
              <TextInput
                value={homePrompt}
                onChangeText={setHomePrompt}
                placeholder="Type a homework question, essay topic, or idea..."
                placeholderTextColor={colors.textTertiary}
                style={styles.heroInput}
                multiline
                returnKeyType="send"
                onSubmitEditing={() => goChat()}
              />
              <View style={styles.heroActionRow}>
                <TouchableOpacity style={[styles.heroActionBtn, styles.heroActionPrimary]} onPress={() => goChat()} activeOpacity={0.8}>
                  <Ionicons name="chatbubble-ellipses" size={16} color={colors.textInverse} />
                  <Text style={styles.heroActionPrimaryText}>Text Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.heroActionBtn} onPress={() => goChat(homePrompt.trim() || CHAT_PROMPTS[0])} activeOpacity={0.8}>
                  <Ionicons name="mic" size={16} color={colors.gold} />
                  <Text style={styles.heroActionText}>Voice</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity key={action.toolId} style={styles.quickCard} activeOpacity={0.8} onPress={() => go(action.toolId)}>
                <View style={[styles.quickIcon, { backgroundColor: `${action.accent}18` }]}>
                  <Ionicons name={action.icon as any} size={22} color={action.accent} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.counterRow}>
            <View style={styles.counterCard}>
              <Text style={styles.counterLabel}>Daily free chat</Text>
              <Text style={styles.counterValue}>{freeLeft} left</Text>
              <Text style={styles.counterSub}>Used {freeUsed} of {freeLimit || 0} today</Text>
            </View>
            <View style={styles.counterCard}>
              <Text style={styles.counterLabel}>Subscription</Text>
              <Text style={styles.counterValue}>{hasPremium ? 'Premium' : 'Free'}</Text>
              <Text style={styles.counterSub}>{activeSubLabel}</Text>
            </View>
          </View>

          <PromoCard
            title="Referral bonuses and reward credits"
            desc={referralSummary ? `${referralSummary.clickCount ?? 0} referrals • GHS ${(referralSummary.commissionEarned ?? 0).toFixed(2)} earned` : 'Share your link and earn reward credits when friends join.'}
            cta="Share Link"
            icon="share-social"
            onPress={() => navigation.navigate('Earn')}
            highlight="BONUS"
          />

          {isLimitReached ? (
            <View style={styles.limitBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.limitTitle}>Daily free chat limit reached</Text>
                <Text style={styles.limitSub}>Upgrade to keep chatting, or buy credits for paid generations.</Text>
              </View>
              <TouchableOpacity style={styles.limitBtn} onPress={() => setShowPaywall(true)}>
                <Text style={styles.limitBtnText}>See Plans</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <ToolRail title="Premium Tools" badge="Power tools" items={featuredTools} onPress={go} accent={colors.info} compact />
          <ProductRail title="Bestseller Files" badge="Top downloads" products={topProducts} onPress={(productId) => navigation.navigate('ProductDetail', { productId })} />
          <ToolRail title="Educational Resources" badge="Student picks" items={educationTools} onPress={go} accent={colors.warning} compact />
          <ToolRail title="Trending Products" badge="Hot now" items={trendingTools} onPress={go} accent={colors.gold} />

          <View style={styles.planPromoGrid}>
            <TouchableOpacity style={styles.planPromoCard} onPress={() => setShowPaywall(true)} activeOpacity={0.8}>
              <Text style={styles.planPromoKicker}>Credit packages</Text>
              <Text style={styles.planPromoTitle}>GHS 50 • 100 • 200 • 500 • 1000 • 1500</Text>
              <Text style={styles.planPromoSub}>Buy once, spend on videos, PDFs, books, and large files.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.planPromoCard} onPress={() => setShowPaywall(true)} activeOpacity={0.8}>
              <Text style={styles.planPromoKicker}>Subscription deals</Text>
              <Text style={styles.planPromoTitle}>From GHS 40 monthly</Text>
              <Text style={styles.planPromoSub}>Yearly tiers unlock lower total cost and better retention.</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dealsWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Deals & Growth</Text>
              <FlashTag label={hasPremium ? 'Premium active' : 'Yearly savings'} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealRow}>
              {SECTION_DEALS.map((deal) => (
                <TouchableOpacity key={deal.id} style={styles.dealCard} activeOpacity={0.8} onPress={() => setShowPaywall(true)}>
                  <View style={styles.dealBadge}>
                    <Text style={styles.dealBadgeText}>{deal.badge}</Text>
                  </View>
                  <Text style={styles.dealTitle}>{deal.title}</Text>
                  <Text style={styles.dealDesc}>{deal.desc}</Text>
                  <Text style={styles.dealCta}>{deal.cta}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Marketplace Promotions</Text>
              <FlashTag label="Creators" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRail}>
              {topProducts.slice(0, 5).map((product: any) => (
                <TouchableOpacity key={product._id} style={styles.productCard} activeOpacity={0.8} onPress={() => navigation.navigate('ProductDetail', { productId: product._id })}>
                  <View style={styles.productThumb}>
                    <Ionicons name={product.fileType === 'PDF' ? 'document-text' : 'cube'} size={22} color={colors.gold} />
                  </View>
                  <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
                  <Text style={styles.productMeta}>{product.category}</Text>
                  <Text style={styles.productPrice}>GHS {product.price?.toFixed?.(2) ?? product.price}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Tools</Text>
              <FlashTag label="Resume fast" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
              {recentTools.length ? recentTools.map((tool) => (
                <TouchableOpacity key={tool.id} style={styles.recentChip} onPress={() => go(tool.id)} activeOpacity={0.8}>
                  <Ionicons name={tool.icon as any} size={14} color={tool.color} />
                  <Text style={styles.recentText}>{tool.name}</Text>
                </TouchableOpacity>
              )) : (
                <TouchableOpacity style={styles.recentChip} onPress={() => go('homework-helper')} activeOpacity={0.8}>
                  <Ionicons name="sparkles" size={14} color={colors.gold} />
                  <Text style={styles.recentText}>Start with Homework Helper</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          <View style={styles.workspaceCard}>
            <View style={styles.workspaceIcon}>
              <Ionicons name="folder-open" size={22} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.workspaceTitle}>Study Workspace</Text>
              <Text style={styles.workspaceSub}>{projectCount > 0 ? `${projectCount} saved projects` : 'Organize prompts, files, and homework results'}</Text>
            </View>
            <TouchableOpacity style={styles.workspaceBtn} onPress={goWorkspace} activeOpacity={0.8}>
              <Text style={styles.workspaceBtnText}>Open</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.accountShortcut} onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Ionicons name="person-circle-outline" size={22} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.accountShortcutTitle}>Login / Sign Up / Profile</Text>
              <Text style={styles.accountShortcutSub}>{user ? 'Manage your account, credits, and subscriptions' : 'Tap to log in or create your account'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.roleSwitchWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personalize Home</Text>
              <FlashTag label="Student-friendly" />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
              {ROLES.map((r) => {
                const on = category === r.key;
                return (
                  <TouchableOpacity key={r.key} activeOpacity={0.8} onPress={() => setCategory(r.key)}>
                    {on ? (
                      <LinearGradient colors={r.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.roleOn}>
                        <Ionicons name={r.icon as any} size={14} color="#FFF" />
                        <Text style={styles.roleOnText}>{r.label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.roleOff}>
                        <Ionicons name={r.icon as any} size={14} color={colors.textTertiary} />
                        <Text style={styles.roleOffText}>{r.label}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
      </SafeAreaView>

      <PaywallScreen visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  scroll: { paddingTop: spacing.sm },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: HP, marginBottom: spacing.md },
  greeting: { ...typography.caption, color: colors.textTertiary, marginBottom: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brand: { fontSize: 26, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.goldMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm },
  aiBadgeText: { fontSize: 11, fontWeight: '700', color: colors.gold },
  topAction: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },

  hero: { marginHorizontal: HP, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.lg },
  heroTopRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  heroOrbWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  glowOrb: { position: 'absolute', width: 54, height: 54, borderRadius: 27, backgroundColor: colors.goldMuted },
  heroCopy: { flex: 1 },
  heroKicker: { ...typography.captionMedium, color: colors.gold, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.8, marginBottom: 4 },
  heroSub: { ...typography.body, color: colors.textSecondary },
  heroStatsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  heroStat: { flex: 1, backgroundColor: 'rgba(10,14,26,0.55)', borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  heroStatLabel: { ...typography.small, color: colors.textTertiary, marginBottom: 4 },
  heroStatValue: { ...typography.bodyMedium, color: colors.textPrimary },
  heroInputCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  heroInputHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  heroInputLabel: { ...typography.bodyMedium, color: colors.textPrimary },
  heroInput: { ...typography.body, color: colors.textPrimary, minHeight: 84, borderRadius: borderRadius.md, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, padding: spacing.md, textAlignVertical: 'top' },
  heroActionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  heroActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, borderRadius: borderRadius.full, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  heroActionPrimary: { backgroundColor: colors.gold, borderColor: colors.gold },
  heroActionText: { ...typography.bodyMedium, color: colors.gold },
  heroActionPrimaryText: { ...typography.bodyMedium, color: colors.textInverse },

  flashTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full, backgroundColor: colors.goldMuted },
  flashTagText: { ...typography.small, color: colors.gold, fontWeight: '700' },

  quickRow: { paddingHorizontal: HP, gap: spacing.sm, marginBottom: spacing.lg },
  quickCard: { width: QUICK_W, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start' },
  quickIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  quickLabel: { ...typography.bodyMedium, color: colors.textPrimary },

  counterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: HP, marginBottom: spacing.md },
  counterCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  counterLabel: { ...typography.caption, color: colors.textTertiary, marginBottom: 4 },
  counterValue: { ...typography.h3, color: colors.textPrimary, marginBottom: 2 },
  counterSub: { ...typography.caption, color: colors.textSecondary },

  promoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, marginHorizontal: HP, padding: spacing.md, marginBottom: spacing.lg },
  promoIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center' },
  promoTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  promoDesc: { ...typography.caption, color: colors.textSecondary },
  promoCtaWrap: { alignItems: 'flex-end', gap: 4 },
  promoHighlight: { ...typography.small, color: colors.gold, fontWeight: '700' },
  promoCta: { ...typography.captionMedium, color: colors.gold },

  limitBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', marginHorizontal: HP, padding: spacing.md, marginBottom: spacing.lg },
  limitTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  limitSub: { ...typography.caption, color: colors.textSecondary },
  limitBtn: { backgroundColor: colors.warning, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full },
  limitBtnText: { ...typography.captionMedium, color: colors.textInverse },

  sectionBlock: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: HP, marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  toolRail: { paddingHorizontal: HP, gap: spacing.md },
  toolCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, minHeight: 160 },
  compactCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, minHeight: 140 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  cardBadgeText: { ...typography.small, fontWeight: '700' },
  cardTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 4 },
  cardDesc: { ...typography.caption, color: colors.textSecondary, lineHeight: 18, flex: 1 },
  cardMeta: { ...typography.small, color: colors.gold, marginTop: spacing.sm },

  productRail: { paddingHorizontal: HP, gap: spacing.md },
  productCard: { width: 150, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  productThumb: { width: '100%', height: 80, borderRadius: borderRadius.md, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  productTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  productMeta: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm },
  productPrice: { ...typography.captionMedium, color: colors.gold },

  planPromoGrid: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: HP, marginBottom: spacing.lg },
  planPromoCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  planPromoKicker: { ...typography.small, color: colors.gold, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  planPromoTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 4 },
  planPromoSub: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },

  dealsWrap: { marginBottom: spacing.xl },
  dealRow: { paddingHorizontal: HP, gap: spacing.md },
  dealCard: { width: 190, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  dealBadge: { alignSelf: 'flex-start', backgroundColor: colors.goldMuted, borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 3, marginBottom: spacing.sm },
  dealBadgeText: { ...typography.small, color: colors.gold, fontWeight: '700' },
  dealTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 4 },
  dealDesc: { ...typography.caption, color: colors.textSecondary, lineHeight: 18, flex: 1 },
  dealCta: { ...typography.captionMedium, color: colors.gold, marginTop: spacing.sm },

  recentRow: { paddingHorizontal: HP, gap: spacing.sm },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: borderRadius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  recentText: { ...typography.caption, color: colors.textSecondary },

  workspaceCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: HP, marginTop: spacing.lg, marginBottom: spacing.xl, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  workspaceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center' },
  workspaceTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  workspaceSub: { ...typography.caption, color: colors.textSecondary },
  workspaceBtn: { backgroundColor: colors.gold, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full },
  workspaceBtnText: { ...typography.captionMedium, color: colors.textInverse },

  accountShortcut: { flexDirection: 'row', alignItems: 'center', marginHorizontal: HP, marginBottom: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.goldMuted, gap: spacing.md },
  accountShortcutTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  accountShortcutSub: { ...typography.caption, color: colors.textSecondary },

  roleSwitchWrap: { marginBottom: spacing.xxl },
  roleRow: { paddingHorizontal: HP, gap: spacing.sm },
  roleOn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: borderRadius.full },
  roleOnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  roleOff: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  roleOffText: { fontSize: 13, fontWeight: '500', color: colors.textTertiary },
});
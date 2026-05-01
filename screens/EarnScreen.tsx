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
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const { isPremium } = useA0Purchases();

  const navigateTo = useCallback((s: Screen, requirePro = false) => {
    if (requirePro && !isPremium) {
      setPaywallVisible(true);
      return;
    }
    setScreen(s);
  }, [isPremium]);

  const goBack = useCallback(() => setScreen('dashboard'), []);

  return (
    <View style={styles.container}>
      {screen === 'dashboard' && <DashboardView navigateTo={navigateTo} isPremium={isPremium} />}
      {screen === 'income' && <IncomeGeneratorView goBack={goBack} isPremium={isPremium} onUpgrade={() => setPaywallVisible(true)} />}
      {screen === 'content' && <ContentGeneratorView goBack={goBack} isPremium={isPremium} onUpgrade={() => setPaywallVisible(true)} />}
      {screen === 'product' && <ProductGeneratorView goBack={goBack} isPremium={isPremium} onUpgrade={() => setPaywallVisible(true)} />}
      {screen === 'earnings' && <EarningsDashboardView goBack={goBack} />}
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
  const deviceId = useDeviceId();
  const todayStr = getTodayStr();
  const navigation = useNavigation<any>();
  const [notificationVisible, setNotificationVisible] = useState(true);
  const [referralInitDone, setReferralInitDone] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<'momo' | 'paypal'>('momo');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAccountDetails, setWithdrawAccountDetails] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const userId = getCurrentUserId();
  const userEmail = getCurrentUserEmail();

  // Convex queries
  const earningsSummary = useQuery(api.earnings.getEarningsSummary, deviceId ? { userId: deviceId } : "skip");
  const referralSummary = useQuery(api.referrals.getReferralSummary, userId ? { userId } : 'skip');
  const completedTaskIds = useQuery(api.earnings.getDailyTasksStatus, deviceId ? { userId: deviceId, date: todayStr } : "skip");
  const withdrawalRequests = useQuery(api.earnings.getWithdrawalRequests, deviceId ? { userId: deviceId } : 'skip') ?? [];

  // Convex mutations
  const ensureReferral = useMutation(api.referrals.ensureReferralCode);
  const completeTaskMut = useMutation(api.earnings.completeDailyTask);
  const recordReferralClick = useMutation(api.referrals.recordReferralClick);
  const requestWithdrawal = useMutation(api.earnings.requestWithdrawal);

  // Initialize referral code on first load
  useEffect(() => {
    if (userEmail && referralSummary === null && !referralInitDone) {
      setReferralInitDone(true);
      ensureReferral({ userId: userEmail, email: userEmail });
    }
  }, [userEmail, referralSummary, referralInitDone, ensureReferral]);

  // Derived data from Convex
  const completedTasks: Record<string, boolean> = {};
  if (completedTaskIds) {
    for (const id of completedTaskIds) completedTasks[id] = true;
  }

  const totalEarnings = earningsSummary?.total ?? 0;
  const todayEarnings = earningsSummary?.today ?? 0;
  const weeklyEarnings = earningsSummary?.weekly ?? 0;
  const monthlyEarnings = earningsSummary?.monthly ?? 0;
  const totalWithdrawn = withdrawalRequests
    .filter((request: { status: string; amount: number }) => request.status !== 'rejected')
    .reduce((sum: number, request: { amount: number }) => sum + request.amount, 0);
  const availableBalance = Math.max(0, totalEarnings - totalWithdrawn);
  const userRefLink = referralSummary?.link ?? 'Generating your link...';

  const earningGoal = 100;
  const goalProgress = Math.min((totalEarnings / earningGoal) * 100, 100);

  const DAILY_TASKS = [
    { id: 'login', label: 'Log in daily', reward: 'GHS 0.50', icon: 'log-in-outline' as const },
    { id: 'generate', label: 'Generate an income idea', reward: 'GHS 1.00', icon: 'bulb-outline' as const },
    { id: 'share', label: 'Share with a friend', reward: 'GHS 2.00', icon: 'share-social-outline' as const },
    { id: 'quiz', label: 'Complete a quiz', reward: 'GHS 0.50', icon: 'help-circle-outline' as const },
  ];

  const completedCount = Object.values(completedTasks).filter(Boolean).length;
  const dailyTaskEarnings = DAILY_TASKS.reduce((sum, t) => sum + (completedTasks[t.id] ? parseFloat(t.reward.replace('GHS ', '')) : 0), 0);

  const withdrawMin = 50;
  const withdrawProgress = Math.min((availableBalance / withdrawMin) * 100, 100);

  const affiliateProducts: Array<{
    id: number;
    name: string;
    desc: string;
    commission: string;
    clicks: number;
    conversions: number;
    earnings: number;
  }> = [
    { id: 1, name: 'AI Tool Bundle', desc: 'Premium AI content & code tools', commission: 'GHS 50', clicks: 0, conversions: 0, earnings: 0 },
    { id: 2, name: 'Digital Marketing Course', desc: 'Complete guide to viral growth', commission: 'GHS 150', clicks: 0, conversions: 0, earnings: 0 },
  ];

  const openWithdrawalModal = useCallback(() => {
    if (availableBalance < withdrawMin) {
      Alert.alert('Not yet available', `You need at least GHS ${withdrawMin.toFixed(2)} available to request a withdrawal.`);
      return;
    }

    setWithdrawMethod('momo');
    setWithdrawAmount(availableBalance.toFixed(2));
    setWithdrawAccountDetails('');
    setWithdrawModalVisible(true);
  }, [availableBalance, withdrawMin]);

  const submitWithdrawal = useCallback(async () => {
    const amount = Number.parseFloat(withdrawAmount);
    const details = withdrawAccountDetails.trim();

    if (!deviceId) {
      Alert.alert('Unavailable', 'Please wait for your wallet to finish loading.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid withdrawal amount.');
      return;
    }

    if (amount < withdrawMin) {
      Alert.alert('Minimum not met', `The minimum withdrawal is GHS ${withdrawMin.toFixed(2)}.`);
      return;
    }

    if (amount > availableBalance) {
      Alert.alert('Insufficient balance', 'Enter an amount within your available balance.');
      return;
    }

    if (!details) {
      Alert.alert('Missing details', withdrawMethod === 'momo' ? 'Enter your Mobile Money number.' : 'Enter your PayPal email.');
      return;
    }

    setWithdrawLoading(true);
    try {
      const result = await requestWithdrawal({
        userId: deviceId,
        amount,
        method: withdrawMethod,
        accountDetails: details,
      });

      if (!result.success) {
        Alert.alert('Withdrawal not submitted', result.message);
        return;
      }

      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawAccountDetails('');
      Alert.alert('Request submitted', result.message);
    } catch (_error) {
      Alert.alert('Error', 'Failed to submit withdrawal request.');
    } finally {
      setWithdrawLoading(false);
    }
  }, [availableBalance, deviceId, requestWithdrawal, withdrawAccountDetails, withdrawAmount, withdrawMethod, withdrawMin]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.dashboardContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.dashboardHeader}>
          <View>
            <Text style={styles.dashboardTitle}>Earn</Text>
            <Text style={styles.dashMotivation}>Explore platform rewards and productivity tools</Text>
          </View>
          {isPremium && (
            <View style={styles.proTag}>
              <Ionicons name="diamond" size={14} color={colors.gold} />
              <Text style={styles.proTagText}>Pro</Text>
            </View>
          )}
        </View>

        {/* Notification — only shows when there are real earnings today */}
        {notificationVisible && todayEarnings > 0 && (
          <View style={styles.notification}>
            <View style={styles.notifContent}>
              <Ionicons name="notifications" size={16} color={colors.gold} />
              <Text style={styles.notifText}>You earned GHS {todayEarnings.toFixed(2)} today!</Text>
            </View>
            <TouchableOpacity onPress={() => setNotificationVisible(false)}>
              <Ionicons name="close" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Premium Earnings Card */}
        <View style={styles.premiumCard}>
          <View style={styles.earnTop}>
            <View>
              <Text style={styles.earnLbl}>Total Earnings</Text>
              <Text style={styles.earnBig}>GHS {totalEarnings.toFixed(2)}</Text>
            </View>
            <View style={styles.walletBg}>
              <Ionicons name="wallet" size={32} color={colors.gold} />
            </View>
          </View>

          {/* Breakdown */}
          <View style={styles.breakdown}>
            <View style={styles.breakItem}>
              <Text style={styles.breakLbl}>Today</Text>
              <Text style={styles.breakVal}>GHS {todayEarnings.toFixed(2)}</Text>
            </View>
            <View style={styles.breakDivider} />
            <View style={styles.breakItem}>
              <Text style={styles.breakLbl}>Weekly</Text>
              <Text style={styles.breakVal}>GHS {weeklyEarnings.toFixed(2)}</Text>
            </View>
            <View style={styles.breakDivider} />
            <View style={styles.breakItem}>
              <Text style={styles.breakLbl}>Monthly</Text>
              <Text style={styles.breakVal}>GHS {monthlyEarnings.toFixed(2)}</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progSection}>
            <View style={styles.progTop}>
              <Text style={styles.progLbl}>Goal: GHS {earningGoal}</Text>
              <Text style={styles.progPct}>{Math.round(goalProgress)}%</Text>
            </View>
            <View style={styles.progBar}>
              <View style={[styles.progFill, { width: `${goalProgress}%` }]} />
            </View>
          </View>
        </View>

        {/* Productivity Actions */}
        <Text style={styles.sectionTitle}>Productivity Actions</Text>
        <TouchableOpacity style={styles.qAction} onPress={() => navigateTo('income')} activeOpacity={0.8}>
          <View style={styles.qActIconWrap}><Ionicons name="bulb-outline" size={20} color={colors.gold} /></View>
          <View style={styles.qActDetails}>
            <Text style={styles.qActLbl}>Generate Income Idea</Text>
            <Text style={styles.qActDesc}>AI-powered business strategy ideas</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.qAction} onPress={() => navigateTo('content', !isPremium)} activeOpacity={0.8}>
          <View style={styles.qActIconWrap}><Ionicons name="flame-outline" size={20} color={colors.gold} /></View>
          <View style={styles.qActDetails}>
            <Text style={styles.qActLbl}>Create Viral Content</Text>
            <Text style={styles.qActDesc}>Trending scripts & posts</Text>
          </View>
          {!isPremium && <View style={styles.proBadge}><Text style={styles.proBadgeText}>PRO</Text></View>}
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.qAction} onPress={() => {
          if (referralSummary) {
            recordReferralClick({ code: referralSummary.code, visitorId: userEmail, source: 'earn-screen-share' });
            Share.share({ message: `Join me on Giga3 AI and start earning! ${referralSummary.link}` });
          }
        }} activeOpacity={0.8}>
          <View style={styles.qActIconWrap}><Ionicons name="link-outline" size={20} color={colors.gold} /></View>
          <View style={styles.qActDetails}>
            <Text style={styles.qActLbl}>Share & Earn</Text>
            <Text style={styles.qActDesc}>Platform reward per referral</Text>
          </View>
          <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Daily Task Rewards */}
        <Text style={styles.sectionTitle}>Daily Task Rewards</Text>
        <View style={styles.dailyTasksCard}>
          <View style={styles.dailyTasksHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="checkbox-outline" size={18} color={colors.gold} />
              <Text style={styles.dailyTasksHeaderText}>{completedCount}/{DAILY_TASKS.length} Completed</Text>
            </View>
            <Text style={styles.dailyTasksEarned}>+GHS {dailyTaskEarnings.toFixed(2)}</Text>
          </View>
          {DAILY_TASKS.map((task) => {
            const done = !!completedTasks[task.id];
            return (
              <TouchableOpacity
                key={task.id}
                style={[styles.dailyTaskRow, done && styles.dailyTaskRowDone]}
                activeOpacity={0.7}
                onPress={() => {
                  if (!done && deviceId) {
                    completeTaskMut({
                      userId: deviceId,
                      taskId: task.id,
                      amount: parseFloat(task.reward.replace('GHS ', '')),
                      description: task.label,
                      date: todayStr,
                    });
                  }
                }}
              >
                <View style={[styles.dailyTaskCheck, done && styles.dailyTaskCheckDone]}>
                  {done && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
                </View>
                <Ionicons name={task.icon} size={18} color={done ? colors.textTertiary : colors.textSecondary} />
                <Text style={[styles.dailyTaskLabel, done && styles.dailyTaskLabelDone]}>{task.label}</Text>
                <View style={[styles.dailyTaskReward, done && styles.dailyTaskRewardDone]}>
                  <Text style={[styles.dailyTaskRewardText, done && { color: colors.textTertiary }]}>{task.reward}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Referral */}
        <Text style={styles.sectionTitle}>Invite Friends & Earn</Text>
        <View style={styles.refCard}>
          <View style={styles.refTop}>
            <View><Text style={styles.refTitle}>Referral Program</Text>
            <Text style={styles.refDesc}>Earn platform rewards for referral signups</Text></View>
            <Ionicons name="people-outline" size={28} color={colors.gold} />
          </View>
          <View style={styles.refStats}>
            <View style={styles.rstat}>
              <Text style={styles.rstatVal}>{referralSummary?.clickCount ?? 0}</Text>
              <Text style={styles.rstatLbl}>Referrals</Text>
            </View>
            <View style={styles.rstatDiv} />
            <View style={styles.rstat}>
              <Text style={styles.rstatVal}>GHS {(referralSummary?.commissionEarned ?? 0).toFixed(2)}</Text>
              <Text style={styles.rstatLbl}>Earnings</Text>
            </View>
          </View>
          <View style={styles.refLink}>
            <Ionicons name="link" size={14} color={colors.gold} />
            <Text style={styles.refLinkText} numberOfLines={1}>{userRefLink}</Text>
            <TouchableOpacity onPress={() => {
              if (referralSummary) {
                Clipboard.setStringAsync(referralSummary.link);
                recordReferralClick({ code: referralSummary.code, visitorId: userEmail, source: 'earn-screen-copy' });
                Alert.alert('Copied!', 'Your referral link has been copied.');
              }
            }} activeOpacity={0.7}>
              <Ionicons name="copy" size={16} color={colors.textInverse} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              if (referralSummary) {
                Share.share({ message: `Join me on Giga3 AI! ${referralSummary.link}` });
              }
            }} activeOpacity={0.7}>
              <Ionicons name="logo-whatsapp" size={16} color={colors.textInverse} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Marketplace Earnings */}
        <Text style={styles.sectionTitle}>Marketplace Earnings</Text>
        <View style={styles.withdrawCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
            <View style={styles.walletBg}>
              <Ionicons name="storefront" size={24} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.withdrawBalance}>GHS 0.00</Text>
              <Text style={styles.withdrawMinLabel}>Total marketplace sales</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}>
              <Text style={{ ...typography.caption, color: colors.textTertiary, marginBottom: 2 }}>Pending</Text>
              <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>GHS 0.00</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}>
              <Text style={{ ...typography.caption, color: colors.textTertiary, marginBottom: 2 }}>Available</Text>
              <Text style={{ ...typography.bodyMedium, color: colors.gold }}>GHS 0.00</Text>
            </View>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.full, paddingVertical: spacing.md }}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('CreatorDashboard')}
          >
            <Ionicons name="analytics" size={16} color={colors.gold} />
            <Text style={{ ...typography.bodyMedium, color: colors.gold }}>View Creator Dashboard</Text>
          </TouchableOpacity>
          <Text style={{ ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm }}>
            Marketplace payouts will be enabled when payment integration goes live.
          </Text>
        </View>

        {/* Affiliate Products */}
        <Text style={styles.sectionTitle}>Recommended Products</Text>
        {affiliateProducts.map(prod => (
          <View key={prod.id} style={styles.prodCard}>
            <View style={styles.prodTop}>
              <View><Text style={styles.prodName}>{prod.name}</Text>
              <Text style={styles.prodDesc}>{prod.desc}</Text></View>
              <View style={styles.commBadge}><Text style={styles.commText}>{prod.commission}</Text></View>
            </View>
            <View style={styles.prodStatRow}>
              <View style={styles.ps}><Text style={styles.psLbl}>Clicks</Text><Text style={styles.psVal}>{prod.clicks}</Text></View>
              <View style={styles.psDiv} />
              <View style={styles.ps}><Text style={styles.psLbl}>Conversions</Text><Text style={styles.psVal}>{prod.conversions}</Text></View>
              <View style={styles.psDiv} />
              <View style={styles.ps}><Text style={styles.psLbl}>Earnings</Text><Text style={[styles.psVal, { color: colors.gold }]}>GHS {prod.earnings}</Text></View>
            </View>
            <View style={styles.prodBtns}>
              <TouchableOpacity style={styles.pbtn} activeOpacity={0.7} onPress={() => {
                const link = referralSummary
                  ? `https://www.giga3ai.com/product/${prod.id}?ref=${referralSummary.code}`
                  : `https://www.giga3ai.com/product/${prod.id}`;
                Clipboard.setStringAsync(link);
                Alert.alert('Affiliate Link Copied!', link);
              }}>
                <Ionicons name="link" size={14} color={colors.textPrimary} />
                <Text style={styles.pbtnText}>Get Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pbtn, styles.pbtnAlt]} activeOpacity={0.7} onPress={() => {
                const link = referralSummary
                  ? `https://www.giga3ai.com/product/${prod.id}?ref=${referralSummary.code}`
                  : `https://www.giga3ai.com/product/${prod.id}`;
                Share.share({ message: `Check out ${prod.name} on Giga3 AI! ${link}` });
              }}>
                <Ionicons name="share-social" size={14} color={colors.textInverse} />
                <Text style={[styles.pbtnText, { color: colors.textInverse }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Payout */}
        <Text style={styles.sectionTitle}>Withdrawal Progress</Text>
        <View style={styles.withdrawCard}>
          <View style={styles.withdrawTop}>
            <View style={styles.walletBg}>
              <Ionicons name="wallet" size={24} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.withdrawBalance}>GHS {totalEarnings.toFixed(2)}</Text>
              <Text style={styles.withdrawMinLabel}>Minimum: GHS {withdrawMin.toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.withdrawBtn, availableBalance < withdrawMin && styles.withdrawBtnDisabled]}
              disabled={availableBalance < withdrawMin}
              activeOpacity={0.8}
              onPress={openWithdrawalModal}
            >
              <Ionicons name="arrow-up-circle" size={16} color={colors.textTertiary} />
              <Text style={[styles.withdrawBtnText, availableBalance < withdrawMin && { color: colors.textTertiary }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.withdrawProgSection}>
            <View style={styles.withdrawProgBar}>
              <View style={[styles.withdrawProgFill, { width: `${withdrawProgress}%` }]} />
            </View>
            <Text style={styles.withdrawProgLabel}>GHS {availableBalance.toFixed(2)} / GHS {withdrawMin.toFixed(2)} ({Math.round(withdrawProgress)}%) available</Text>
          </View>
          <View style={styles.withdrawMethods}>
            <View style={styles.withdrawMethod}>
              <Ionicons name="phone-portrait-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.withdrawMethodText}>Mobile Money</Text>
            </View>
            <View style={styles.withdrawMethod}>
              <Ionicons name="card-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.withdrawMethodText}>PayPal</Text>
            </View>
          </View>
          <View style={styles.withdrawNoteBanner}>
            <Ionicons name="time-outline" size={16} color={colors.warning} />
            <Text style={styles.comingSoonText}>Withdrawal requests are reviewed after submission. MoMo and PayPal are supported first.</Text>
          </View>

          {withdrawalRequests.length > 0 && (
            <View style={styles.withdrawHistory}>
              <Text style={styles.withdrawHistoryTitle}>Recent requests</Text>
              {withdrawalRequests.slice(0, 3).map((request: { _id: string; amount: number; method: string; status: string }) => (
                <View key={request._id} style={styles.withdrawHistoryRow}>
                  <View>
                    <Text style={styles.withdrawHistoryAmount}>GHS {request.amount.toFixed(2)}</Text>
                    <Text style={styles.withdrawHistoryMeta}>{request.method.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.withdrawStatusPill, request.status === 'pending' ? styles.withdrawStatusPending : styles.withdrawStatusApproved]}>
                    <Text style={styles.withdrawStatusText}>{request.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Streak */}
        <View style={styles.streak}>
          <View style={styles.qActIconWrap}><Ionicons name="flame" size={20} color={colors.gold} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLbl}>Complete tasks to earn platform rewards</Text>
            <Text style={styles.streakSub}>Rewards are promotional incentives, not guaranteed income</Text>
          </View>
        </View>

        {/* How It Works */}
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.howItWorksCard}>
          <View style={styles.howStep}>
            <View style={[styles.howStepNum, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Text style={[styles.howStepNumText, { color: '#3B82F6' }]}>1</Text>
            </View>
            <Text style={styles.howStepText}>Complete daily tasks like logging in and generating content</Text>
          </View>
          <View style={styles.howStep}>
            <View style={[styles.howStepNum, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
              <Text style={[styles.howStepNumText, { color: '#22C55E' }]}>2</Text>
            </View>
            <Text style={styles.howStepText}>Share your referral link to earn platform rewards per signup</Text>
          </View>
          <View style={styles.howStep}>
            <View style={[styles.howStepNum, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
              <Text style={[styles.howStepNumText, { color: '#A855F7' }]}>3</Text>
            </View>
            <Text style={styles.howStepText}>Reach GHS 50 minimum and submit a withdrawal request for review</Text>
          </View>
          <TouchableOpacity
            style={styles.rulesLink}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Info', { pageId: 'earn-rules' })}
          >
            <Text style={styles.rulesLinkText}>View Full Earning Rules</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.gold} />
          </TouchableOpacity>
        </View>

        {/* Earnings Disclaimer */}
        <View style={styles.disclaimerCard}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.disclaimerText}>
            Earnings shown are platform-based rewards and promotional incentives. Giga3 AI does not guarantee any specific level of income. Rewards are subject to platform terms and availability.
          </Text>
        </View>

        <Modal
          visible={withdrawModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setWithdrawModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request withdrawal</Text>
                <TouchableOpacity onPress={() => setWithdrawModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Method</Text>
              <View style={styles.methodRow}>
                {([
                  { key: 'momo', label: 'Mobile Money' },
                  { key: 'paypal', label: 'PayPal' },
                ] as const).map((method) => (
                  <TouchableOpacity
                    key={method.key}
                    style={[styles.methodChip, withdrawMethod === method.key && styles.methodChipActive]}
                    onPress={() => setWithdrawMethod(method.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.methodChipText, withdrawMethod === method.key && styles.methodChipTextActive]}>{method.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Amount</Text>
              <TextInput
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                keyboardType="decimal-pad"
                placeholder={`Minimum GHS ${withdrawMin.toFixed(2)}`}
                placeholderTextColor={colors.textTertiary}
                style={styles.modalInput}
              />

              <Text style={styles.modalLabel}>{withdrawMethod === 'momo' ? 'Mobile Money number' : 'PayPal email'}</Text>
              <TextInput
                value={withdrawAccountDetails}
                onChangeText={setWithdrawAccountDetails}
                keyboardType={withdrawMethod === 'momo' ? 'phone-pad' : 'email-address'}
                autoCapitalize="none"
                placeholder={withdrawMethod === 'momo' ? '+233...' : 'name@example.com'}
                placeholderTextColor={colors.textTertiary}
                style={styles.modalInput}
              />

              <View style={styles.modalSummary}>
                <Text style={styles.modalSummaryText}>Available: GHS {availableBalance.toFixed(2)}</Text>
                <Text style={styles.modalSummaryText}>Requested: GHS {Number.parseFloat(withdrawAmount || '0').toFixed(2)}</Text>
              </View>

              <TouchableOpacity
                style={[styles.modalPrimaryBtn, withdrawLoading && styles.modalPrimaryBtnDisabled]}
                onPress={submitWithdrawal}
                disabled={withdrawLoading}
                activeOpacity={0.8}
              >
                {withdrawLoading ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Submit request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  dashboardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  dashboardTitle: { ...typography.h1, color: colors.textPrimary },
  dashMotivation: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  proTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  proTagText: { ...typography.small, color: colors.gold, fontWeight: '700' },

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

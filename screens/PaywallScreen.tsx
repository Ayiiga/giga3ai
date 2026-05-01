import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { setPlan, setPlanTier } from '../lib/usageTracker';
import a0 from 'a0-sdk';
import { getCurrentUserId, getCurrentUserEmail } from '../lib/platformAuth';

// ── Plan definitions ──────────────────────────────────

const PLANS = [
  {
    id: 'ghc-40-monthly',
    name: 'Monthly Starter',
    price: 40,
    period: 'monthly',
    billingPeriod: 'monthly',
    badge: 'BEST FOR STUDENTS',
    features: [
      'Free educational chat access',
      'Higher daily generation limits',
      'Homework support with caps',
      'Priority app unlocks',
    ],
  },
  {
    id: 'ghc-80-monthly',
    name: 'Monthly Plus',
    price: 80,
    period: 'monthly',
    billingPeriod: 'monthly',
    badge: 'POPULAR',
    features: [
      'Higher free educational caps',
      'More paid generations included',
      'Premium downloads and files',
      'Faster support flow',
    ],
  },
  {
    id: 'ghc-150-monthly',
    name: 'Monthly Pro',
    price: 150,
    period: 'monthly',
    billingPeriod: 'monthly',
    badge: 'CREATORS',
    features: [
      'Advanced generation permissions',
      'Video and book workflows',
      'Large file creation unlocks',
      'Better retention value',
    ],
  },
  {
    id: 'ghc-350-monthly',
    name: 'Monthly Elite',
    price: 350,
    period: 'monthly',
    billingPeriod: 'monthly',
    badge: 'POWER USERS',
    features: [
      'High-volume AI generation',
      'Priority premium access',
      'Expanded credit usage',
      'Creator and business tools',
    ],
  },
  {
    id: 'ghc-2000-monthly',
    name: 'Monthly Max',
    price: 2000,
    period: 'monthly',
    billingPeriod: 'monthly',
    badge: 'MAX TIER',
    features: [
      'Top-tier premium access',
      'Maximum generation limits',
      'Best for teams and agencies',
      'Full ecosystem unlock',
    ],
  },
];

const YEARLY_PLANS = [
  {
    id: 'ghc-420-yearly',
    name: 'Yearly Starter',
    price: 420,
    period: 'yearly',
    billingPeriod: 'yearly',
    badge: 'SAVE 12%',
    features: ['Lower yearly cost than monthly', 'Great for JHS/SHS users', 'Automatic renewal support'],
  },
  {
    id: 'ghc-840-yearly',
    name: 'Yearly Plus',
    price: 840,
    period: 'yearly',
    billingPeriod: 'yearly',
    badge: 'SAVE 12%',
    features: ['Reduced annual total', 'Good for regular users', 'Better long-term retention'],
  },
  {
    id: 'ghc-1575-yearly',
    name: 'Yearly Pro',
    price: 1575,
    period: 'yearly',
    billingPeriod: 'yearly',
    badge: 'SAVE 12%',
    features: ['Serious production usage', 'Yearly premium retention', 'Predictable billing'],
  },
  {
    id: 'ghc-2940-yearly',
    name: 'Yearly Elite',
    price: 2940,
    period: 'yearly',
    billingPeriod: 'yearly',
    badge: 'SAVE 12%',
    features: ['High-volume annual access', 'Best yearly retention', 'Large generation allowances'],
  },
  {
    id: 'ghc-16800-yearly',
    name: 'Yearly Max',
    price: 16800,
    period: 'yearly',
    billingPeriod: 'yearly',
    badge: 'ENTERPRISE',
    features: ['Enterprise annual access', 'Full team unlock', 'Maximum platform control'],
  },
];

const CREDIT_PACKAGES = [
  { id: 'credit-50', name: 'Starter Credits', price: 50, credits: 50, badge: 'ENTRY', features: ['Best for quick top ups', 'Useful for paid generations', 'Instant voucher confirmation'] },
  { id: 'credit-100', name: 'Value Credits', price: 100, credits: 100, badge: 'POPULAR', features: ['More room for bigger jobs', 'Easy repeat purchases', 'Fast payment confirmation'] },
  { id: 'credit-200', name: 'Pro Credits', price: 200, credits: 200, badge: 'BEST VALUE', features: ['For larger projects', 'Smooth repeat checkout', 'Voucher-based confirmation'] },
  { id: 'credit-500', name: 'Max Credits', price: 500, credits: 500, badge: 'POWER USER', features: ['High-volume generation', 'Best for frequent use', 'Instant payment verification'] },
];

const FEATURES_OVERVIEW = [
  { icon: 'school', label: 'Free educational chats with daily caps' },
  { icon: 'flame', label: 'Homework solver access for students' },
  { icon: 'wallet', label: 'Credits for paid generations and files' },
  { icon: 'refresh', label: 'Monthly and yearly renewals' },
  { icon: 'shield-checkmark', label: 'Premium unlocks and payment verification' },
];

export default function PaywallScreen({
  visible,
  onClose,
  defaultSection = 'monthly',
  defaultPurchaseType = 'subscription',
}: {
  visible: boolean;
  onClose: () => void;
  defaultSection?: 'monthly' | 'yearly';
  defaultPurchaseType?: 'subscription' | 'credits';
}) {
  const nav = useNavigation<any>();
  const [selectedPlan, setSelectedPlan] = useState(PLANS[0].id);
  const [selectedCreditPackage, setSelectedCreditPackage] = useState(CREDIT_PACKAGES[0].id);
  const [selectedSection, setSelectedSection] = useState<'monthly' | 'yearly'>(defaultSection);
  const [purchaseType, setPurchaseType] = useState<'subscription' | 'credits'>(defaultPurchaseType);
  const [loading, setLoading] = useState(false);
  const [activeSub, setActiveSub] = useState<any>(null);
  const userId = getCurrentUserId();
  const userEmail = getCurrentUserEmail();

  const subscription = useQuery(
    api.subscriptions.getActive,
    userId ? { userId } : 'skip'
  );
  const accessStatus = useQuery(api.credits.getAccessStatus, userId ? { userId } : 'skip');
  const paystackPublicKey = useQuery(api.settings.getPaystackPublicKey);

  useEffect(() => {
    if (subscription !== undefined) {
      setActiveSub(subscription);
      if (subscription) {
        setPlan('pro');
        setPlanTier(subscription.billingPeriod || subscription.plan || 'monthly');
      } else {
        setPlan('free');
      }
    }
  }, [subscription]);

  useEffect(() => {
    if (visible) {
      setSelectedSection(defaultSection);
      setPurchaseType(defaultPurchaseType);
    }
  }, [defaultPurchaseType, defaultSection, visible]);

  const visiblePlans = selectedSection === 'monthly' ? PLANS : YEARLY_PLANS;
  const selectedCredit = CREDIT_PACKAGES.find((item) => item.id === selectedCreditPackage) ?? CREDIT_PACKAGES[0];

  const handleProceed = async () => {
    setLoading(true);
    try {
      const authUser = a0?.auth?.getUser?.();
      const stableUserId = userId || authUser?.id || '';
      const email = authUser?.email || userEmail || (stableUserId ? `${stableUserId}@giga3.ai` : 'user@giga3.ai');

      if (!stableUserId) {
        Alert.alert('Payment Unavailable', 'Please refresh and try again in a moment.');
        return;
      }

      if (!paystackPublicKey) {
        Alert.alert('Error', 'Payment system not ready. Please try again in a moment.');
        return;
      }

      const reference = purchaseType === 'credits'
        ? `giga3_credit_${selectedCredit.id}_${Date.now()}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
        : `giga3_sub_${selectedPlan}_${Date.now()}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

      onClose();
      nav.push('PaystackCheckout', {
        publicKey: paystackPublicKey,
        email,
        amount: purchaseType === 'credits' ? selectedCredit.price : (visiblePlans.find((p) => p.id === selectedPlan)?.price ?? 0),
        reference,
        currency: 'GHS',
        productTitle: purchaseType === 'credits'
          ? `Giga3 Credit Voucher - ${selectedCredit.name}`
          : `Giga3 Premium - ${visiblePlans.find((p) => p.id === selectedPlan)?.name}`,
        isSubscription: purchaseType === 'subscription',
        purchaseType: purchaseType === 'credits' ? 'credit' : 'product',
        creditAmount: purchaseType === 'credits' ? selectedCredit.credits : undefined,
        purchaseLabel: purchaseType === 'credits' ? selectedCredit.name : visiblePlans.find((p) => p.id === selectedPlan)?.name,
        plan: selectedPlan,
        billingPeriod: purchaseType === 'subscription' ? selectedSection : undefined,
        userId: stableUserId,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const daysLeft = activeSub ? Math.max(0, Math.ceil((activeSub.expiryDate - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  // ── Active subscription view ──
  if (activeSub && activeSub.status === 'active') {
    const planInfo = [...PLANS, ...YEARLY_PLANS].find((p) => p.id === activeSub.plan) || PLANS[0];
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={s.container}>
          <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>

              <View style={s.activeHeader}>
                <View style={s.proBadge}>
                  <Ionicons name="diamond" size={36} color={colors.gold} />
                </View>
                <Text style={s.activeTitle}>You're on Premium!</Text>
                <Text style={s.activePlan}>{planInfo.name}</Text>
                <Text style={s.activeSubtitle}>
                  GHS {activeSub.amount}/{(activeSub.billingPeriod ?? 'monthly') === 'yearly' ? 'year' : 'month'}
                </Text>
              </View>

              <View style={s.statusCard}>
                <View style={s.statusRow}>
                  <Text style={s.statusLabel}>Status</Text>
                  <View style={s.activeBadge}>
                    <Text style={s.activeBadgeText}>Active</Text>
                  </View>
                </View>
                <View style={s.statusRow}>
                  <Text style={s.statusLabel}>Started</Text>
                  <Text style={s.statusValue}>{formatDate(activeSub.startDate)}</Text>
                </View>
                <View style={s.statusRow}>
                  <Text style={s.statusLabel}>Expires</Text>
                  <Text style={s.statusValue}>{formatDate(activeSub.expiryDate)}</Text>
                </View>
                <View style={[s.statusRow, { borderBottomWidth: 0 }]}>
                  <Text style={s.statusLabel}>Days Left</Text>
                  <Text style={[s.statusValue, { color: colors.gold }]}>{daysLeft} days</Text>
                </View>
              </View>

              <View style={s.featCard}>
                {planInfo.features.map((f, i) => (
                  <View key={i} style={s.featRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                    <Text style={s.featLabel}>{f}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={s.continueBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={s.continueBtnText}>Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  // ── Subscription selector ──
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Header */}
            <View style={s.header}>
              <View style={s.proBadge}>
                <Ionicons name="diamond" size={32} color={colors.gold} />
              </View>
              <Text style={s.title}>Choose Premium Access</Text>
              <Text style={s.subtitle}>
                Pick a subscription or buy a credit voucher, then go straight to payment confirmation.
              </Text>
            </View>

            <View style={s.switchRow}>
              <TouchableOpacity style={[s.switchChip, purchaseType === 'subscription' && s.switchChipActive]} onPress={() => setPurchaseType('subscription')}>
                <Text style={[s.switchChipText, purchaseType === 'subscription' && s.switchChipTextActive]}>Subscription</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.switchChip, purchaseType === 'credits' && s.switchChipActive]} onPress={() => setPurchaseType('credits')}>
                <Text style={[s.switchChipText, purchaseType === 'credits' && s.switchChipTextActive]}>Credits</Text>
              </TouchableOpacity>
            </View>

            {/* Features overview */}
            <View style={s.featCard}>
              {FEATURES_OVERVIEW.map((f, i) => (
                <View key={i} style={s.featRow}>
                  <View style={s.featIcon}>
                    <Ionicons name={f.icon as any} size={16} color={colors.gold} />
                  </View>
                  <Text style={s.featLabel}>{f.label}</Text>
                </View>
              ))}
            </View>

            {purchaseType === 'subscription' ? (
              <>
                <View style={s.billingToggle}>
                  <TouchableOpacity style={[s.billingChip, selectedSection === 'monthly' && s.billingChipActive]} onPress={() => setSelectedSection('monthly')}>
                    <Text style={[s.billingChipText, selectedSection === 'monthly' && s.billingChipTextActive]}>Monthly</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.billingChip, selectedSection === 'yearly' && s.billingChipActive]} onPress={() => setSelectedSection('yearly')}>
                    <Text style={[s.billingChipText, selectedSection === 'yearly' && s.billingChipTextActive]}>Yearly</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.plans}>
                  {visiblePlans.map((plan) => {
                    const selected = selectedPlan === plan.id;
                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={[s.planCard, selected && s.planCardSelected]}
                        onPress={() => setSelectedPlan(plan.id)}
                        activeOpacity={0.7}
                      >
                        {plan.badge && (
                          <View style={s.planBadge}>
                            <Text style={s.planBadgeText}>{plan.badge}</Text>
                          </View>
                        )}

                        <View style={s.planRadio}>
                          <View style={[s.radioOuter, selected && s.radioOuterActive]}>
                            {selected && <View style={s.radioInner} />}
                          </View>
                        </View>

                        <View style={s.planInfo}>
                          <Text style={[s.planName, selected && { color: colors.gold }]}>{plan.name}</Text>
                          <Text style={s.planFeatures}>
                            {plan.features.slice(0, 2).join(' · ')}
                          </Text>
                        </View>

                        <View style={s.planPricing}>
                          <Text style={[s.planPrice, selected && { color: colors.gold }]}>
                            GHS {plan.price}
                          </Text>
                          <Text style={s.planPeriod}>/{plan.period}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={s.plans}>
                {CREDIT_PACKAGES.map((pack) => {
                  const selected = selectedCreditPackage === pack.id;
                  return (
                    <TouchableOpacity
                      key={pack.id}
                      style={[s.planCard, selected && s.planCardSelected]}
                      onPress={() => setSelectedCreditPackage(pack.id)}
                      activeOpacity={0.7}
                    >
                      {pack.badge && (
                        <View style={s.planBadge}>
                          <Text style={s.planBadgeText}>{pack.badge}</Text>
                        </View>
                      )}
                      <View style={s.planRadio}>
                        <View style={[s.radioOuter, selected && s.radioOuterActive]}>
                          {selected && <View style={s.radioInner} />}
                        </View>
                      </View>
                      <View style={s.planInfo}>
                        <Text style={[s.planName, selected && { color: colors.gold }]}>{pack.name}</Text>
                        <Text style={s.planFeatures}>{pack.features.slice(0, 2).join(' · ')}</Text>
                      </View>
                      <View style={s.planPricing}>
                        <Text style={[s.planPrice, selected && { color: colors.gold }]}>
                          GHS {pack.price}
                        </Text>
                        <Text style={s.planPeriod}>{pack.credits} credits</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Subscribe button */}
            <TouchableOpacity
              style={[s.subscribeBtn, loading && s.subscribeBtnDisabled]}
              onPress={handleProceed}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <>
                  <Ionicons name="card" size={18} color={colors.textInverse} />
                  <Text style={s.subscribeBtnText}>
                    {purchaseType === 'credits'
                      ? `Confirm Voucher — GHS ${selectedCredit.price}`
                      : `Subscribe — GHS ${visiblePlans.find((p) => p.id === selectedPlan)?.price}/${selectedSection === 'monthly' ? 'mo' : 'yr'}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={s.legal}>
              {purchaseType === 'credits'
                ? 'Credit vouchers are confirmed immediately after payment verification and repeat purchases stay simple.'
                : 'Monthly and yearly plans renew automatically. Payments are processed securely via Paystack and verified before premium unlocks.'}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: 60 },
  closeBtn: { alignSelf: 'flex-end', padding: spacing.sm, marginBottom: spacing.sm },

  // Header
  header: { alignItems: 'center', marginBottom: spacing.xl },
  proBadge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.goldMuted,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 320, lineHeight: 22 },

  // Features
  featCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.xl, gap: spacing.sm,
  },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.goldMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  featLabel: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },

  switchRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.lg },
  switchChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  switchChipText: { ...typography.captionMedium, color: colors.textSecondary },
  switchChipTextActive: { color: colors.textInverse },
  billingToggle: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.md },
  billingChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billingChipActive: { backgroundColor: colors.surfaceLight, borderColor: colors.gold },
  billingChipText: { ...typography.captionMedium, color: colors.textSecondary },
  billingChipTextActive: { color: colors.gold },

  // Plans
  plans: { gap: spacing.sm, marginBottom: spacing.xl },
  planCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, backgroundColor: colors.surface,
    borderRadius: borderRadius.lg, borderWidth: 1.5,
    borderColor: colors.border, gap: spacing.md,
    position: 'relative', overflow: 'hidden',
  },
  planCardSelected: { borderColor: colors.gold, backgroundColor: colors.surfaceLight },
  planBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderBottomLeftRadius: borderRadius.sm,
  },
  planBadgeText: { ...typography.small, color: colors.textInverse, fontWeight: '700', fontSize: 10 },
  planRadio: { justifyContent: 'center' },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.gold },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
  planInfo: { flex: 1 },
  planName: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  planFeatures: { ...typography.caption, color: colors.textTertiary },
  planPricing: { alignItems: 'flex-end' },
  planPrice: { ...typography.h3, color: colors.textPrimary },
  planPeriod: { ...typography.small, color: colors.textTertiary },

  // Subscribe
  subscribeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.gold,
    paddingVertical: spacing.lg, borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeBtnText: { ...typography.h3, color: colors.textInverse },
  legal: { ...typography.small, color: colors.textTertiary, textAlign: 'center', lineHeight: 18 },

  // Active subscription
  activeHeader: { alignItems: 'center', marginBottom: spacing.xl },
  activeTitle: { ...typography.h1, color: colors.gold, marginBottom: 4 },
  activePlan: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  activeSubtitle: { ...typography.body, color: colors.textSecondary },
  statusCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusLabel: { ...typography.body, color: colors.textSecondary },
  statusValue: { ...typography.bodyMedium, color: colors.textPrimary },
  activeBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: spacing.sm,
    paddingVertical: 2, borderRadius: borderRadius.sm,
  },
  activeBadgeText: { ...typography.small, color: '#22C55E', fontWeight: '700' },
  continueBtn: {
    backgroundColor: colors.gold, paddingVertical: spacing.lg,
    borderRadius: borderRadius.full, alignItems: 'center', marginTop: spacing.md,
  },
  continueBtnText: { ...typography.h3, color: colors.textInverse },
});
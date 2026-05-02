import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  Linking,
  Share,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { Authenticated, Unauthenticated } from 'convex/react';
import { a0 } from 'a0-sdk';
import { useA0Purchases } from 'a0-purchases';
import { useCategory, CategoryKey } from '../lib/categoryContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUserId } from '../lib/platformAuth';
import {
  getUsageInfo,
  UsageInfo,
  FREE_DAILY_LIMIT,
  syncSubscriptionFromDB,
} from '../lib/usageTracker';
import PaywallScreen from './PaywallScreen';

// ─── Private Admin Metadata (never displayed in UI) ───
const _ADMIN_META = {
  name: 'Ayiiga Benard Issaka',
  profession: 'Teacher',
  country: 'Ghana',
  phone: '+233542524252',
  email: 'ayiiga3@gmail.com',
};

const CATEGORIES: { key: CategoryKey; label: string; icon: string; color: string }[] = [
  { key: 'student', label: 'Student', icon: 'school', color: '#3B82F6' },
  { key: 'tutor', label: 'Tutor', icon: 'people', color: '#22C55E' },
  { key: 'creator', label: 'Creator', icon: 'color-palette', color: '#A855F7' },
  { key: 'entrepreneur', label: 'Entrepreneur', icon: 'briefcase', color: '#F59E0B' },
];

// ─── Category Picker Modal ───
function CategoryPickerModal({
  visible,
  currentCategory,
  onSelect,
  onClose,
}: {
  visible: boolean;
  currentCategory: CategoryKey;
  onSelect: (cat: CategoryKey) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Change Category</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={modalStyles.subtitle}>
            Your home dashboard tools will update to match
          </Text>
          {CATEGORIES.map((cat) => {
            const isSelected = currentCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  modalStyles.option,
                  isSelected && modalStyles.optionSelected,
                  isSelected && { borderColor: cat.color },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  onSelect(cat.key);
                  onClose();
                }}
              >
                <View style={[modalStyles.optionIcon, { backgroundColor: `${cat.color}20` }]}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                </View>
                <Text style={modalStyles.optionLabel}>{cat.label}</Text>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={cat.color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

// ─── Sign-In Card ───
function SignInCard() {
  return (
    <View style={styles.signInCard}>
      <View style={styles.signInAvatar}>
        <Ionicons name="person" size={36} color={colors.textTertiary} />
      </View>
      <Text style={styles.signInTitle}>Login / Sign Up</Text>
      <Text style={styles.signInSubtitle}>
        Sign in to sync your account, subscriptions, credits, and chat history across devices.
      </Text>
      <TouchableOpacity
        style={styles.googleBtn}
        onPress={() => a0.auth.signInWithGoogle()}
        activeOpacity={0.7}
      >
        <Ionicons name="logo-google" size={18} color={colors.textInverse} />
        <Text style={styles.authBtnText}>Continue with Google</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={styles.appleBtn}
          onPress={() => a0.auth.signInWithApple()}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-apple" size={18} color="#fff" />
          <Text style={[styles.authBtnText, { color: '#fff' }]}>Continue with Apple</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Profile Editor ───
function ProfileEditor({ refreshToken }: { refreshToken: number }) {
  const authUser = a0?.auth?.getUser?.();
  const [profile, setProfile] = useState({
    name: authUser?.name || '',
    email: authUser?.email || '',
    phone: authUser?.phone || '',
  } as { name: string; email: string; phone: string });
  const [saving, setSaving] = useState(false);
  const [photoStorageId, setPhotoStorageId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(authUser?.image || null);

  const profileQuery = useQuery(api.users.getMyProfile, { refreshToken });
  const upsertProfile = useMutation(api.users.upsertMyProfile);
  const generateUploadUrl = useMutation(api.marketplace.generateUploadUrl);
  const { signOut } = a0?.auth ?? {};

  useEffect(() => {
    if (profileQuery) {
      setProfile({
        name: profileQuery.name || authUser?.name || '',
        email: profileQuery.email || authUser?.email || '',
        phone: profileQuery.phone || authUser?.phone || '',
      });
      setPhotoStorageId(profileQuery.photoStorageId ? String(profileQuery.photoStorageId) : null);
      setPhotoUrl(profileQuery.photoUrl || authUser?.image || null);
    }
  }, [profileQuery, authUser?.email, authUser?.image, authUser?.name, authUser?.phone, refreshToken]);

  const pickPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow photo library access to choose a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const uploadUrl = await generateUploadUrl();
      const fetchFn = globalThis.fetch.bind(globalThis);
      const response = await fetchFn(result.assets[0].uri);
      const blob = await response.blob();
      const uploadResponse = await fetchFn(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      const payload = await uploadResponse.json();
      setPhotoStorageId(payload.storageId);
      setPhotoUrl(result.assets[0].uri);
    } catch {
      Alert.alert('Upload failed', 'Could not upload the profile photo.');
    }
  }, [generateUploadUrl]);

  const saveProfile = useCallback(async () => {
    setSaving(true);
    try {
      await upsertProfile({
        name: profile.name.trim() || undefined,
        email: profile.email.trim() || undefined,
        phone: profile.phone.trim() || undefined,
        photoStorageId: photoStorageId ? (photoStorageId as any) : undefined,
      });
      Alert.alert('Saved', 'Your profile was updated successfully.');
    } catch (error: any) {
      Alert.alert('Save failed', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [photoStorageId, profile.email, profile.name, profile.phone, upsertProfile]);

  const handlePasswordReset = useCallback(() => {
    if (!profile.email.trim()) {
      Alert.alert('Email required', 'Add an email first so we can send a secure password reset link.');
      return;
    }
    Alert.alert(
      'Reset Password',
      'Use the email/password login flow to request a secure reset code, then change your password from the sign-in screen.'
    );
  }, [profile.email]);

  return (
    <View style={styles.profileCard}>
      <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto} activeOpacity={0.8}>
        <View style={styles.avatarPhoto}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{(profile.name || profile.email || 'U').charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.editPhotoBadge}>
          <Ionicons name="camera" size={12} color={colors.textInverse} />
        </View>
      </TouchableOpacity>

      <TextInput style={styles.profileInput} value={profile.name} onChangeText={(name: string) => setProfile((p: { name: string; email: string; phone: string }) => ({ ...p, name }))} placeholder="Name" placeholderTextColor={colors.textTertiary} />
      <TextInput style={styles.profileInput} value={profile.email} onChangeText={(email: string) => setProfile((p: { name: string; email: string; phone: string }) => ({ ...p, email }))} placeholder="Email" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.profileInput} value={profile.phone} onChangeText={(phone: string) => setProfile((p: { name: string; email: string; phone: string }) => ({ ...p, phone }))} placeholder="Phone number" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" />

      <View style={styles.profileActionsRow}>
        <TouchableOpacity style={styles.profileActionBtn} onPress={saveProfile} activeOpacity={0.8} disabled={saving}>
          <Text style={styles.profileActionBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.profileActionSecondary} onPress={handlePasswordReset} activeOpacity={0.8}>
          <Text style={styles.profileActionSecondaryText}>Reset Password</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileMetaRow}>
        <View style={styles.memberBadge}>
          <Ionicons name="lock-closed" size={12} color={colors.gold} />
          <Text style={styles.memberBadgeText}>Persistent login enabled</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Profile Card (signed in) ───
function ProfileCard({ isPro }: { isPro: boolean }) {
  const user = a0?.auth?.getUser?.();
  const { category } = useCategory();
  const displayName = user?.name || user?.email || 'User';
  const email = user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();
  const currentMeta = CATEGORIES.find((c) => c.key === category);

  return (
    <View style={styles.profileCard}>
      <View style={styles.profileHeaderBlock}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, isPro && { borderColor: colors.gold }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.profileHeaderText}>
          <Text style={styles.profileName}>{displayName}</Text>
          {email ? <Text style={styles.profileEmail}>{email}</Text> : null}
          <View style={styles.badgeRow}>
            <View style={styles.memberBadge}>
              <Ionicons name={isPro ? 'diamond' : 'sparkles'} size={12} color={colors.gold} />
              <Text style={styles.memberBadgeText}>{isPro ? 'Pro Member' : 'Giga3 Member'}</Text>
            </View>
            {currentMeta && (
              <View style={[styles.memberBadge, { backgroundColor: `${currentMeta.color}15` }]}>
                <Ionicons name={currentMeta.icon as any} size={12} color={currentMeta.color} />
                <Text style={[styles.memberBadgeText, { color: currentMeta.color }]}>
                  {currentMeta.label}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Usage Card ───
function UsageCard({ usage }: { usage: UsageInfo }) {
  const percentage = usage.isPro ? 0 : usage.percentage;
  const barColor =
    percentage > 0.8 ? colors.error : percentage > 0.6 ? colors.warning : colors.gold;

  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <View style={styles.sectionCardHeaderLeft}>
          <View style={[styles.sectionIconWrap, { backgroundColor: `${colors.gold}20` }]}>
            <Ionicons name="flash" size={16} color={colors.gold} />
          </View>
          <Text style={styles.sectionCardTitle}>Today's Generations</Text>
        </View>
        <Text style={[styles.usageCountText, usage.isPro && { color: colors.gold }]}>
          {usage.isPro ? '∞' : `${usage.count}/${usage.limit}`}
        </Text>
      </View>

      {!usage.isPro ? (
        <>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${percentage * 100}%`, backgroundColor: barColor },
              ]}
            />
          </View>
          <Text style={styles.usageSubtext}>
            {usage.remaining} remaining · Resets daily at midnight
          </Text>
        </>
      ) : (
        <Text style={styles.usageSubtext}>Unlimited generations with Pro plan</Text>
      )}
    </View>
  );
}

// ─── Plan Card ───
function PlanCard({ isPro, onUpgrade }: { isPro: boolean; onUpgrade: () => void }) {
  return (
    <View style={[styles.sectionCard, isPro && { borderColor: `${colors.gold}30` }]}>
      <View style={styles.planHeader}>
        <View
          style={[
            styles.planBadge,
            { backgroundColor: isPro ? colors.goldMuted : `${colors.info}20` },
          ]}
        >
          <Ionicons
            name={isPro ? 'diamond' : 'leaf'}
            size={16}
            color={isPro ? colors.gold : colors.info}
          />
          <Text style={[styles.planBadgeText, { color: isPro ? colors.gold : colors.info }]}>
            {isPro ? 'PRO' : 'FREE'}
          </Text>
        </View>
      </View>
      <Text style={styles.planTitle}>{isPro ? 'Pro Plan' : 'Free Plan'}</Text>
      <Text style={styles.planDesc}>
        {isPro
          ? 'Unlimited AI generations with priority processing'
          : `${FREE_DAILY_LIMIT} AI generations per day`}
      </Text>
      {!isPro && (
        <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade} activeOpacity={0.8}>
          <Ionicons name="sparkles" size={16} color={colors.textInverse} />
          <Text style={styles.upgradeBtnText}>Upgrade to Pro — from GHS 20/mo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Category Row ───
function CategoryRow({
  category,
  onPress,
}: {
  category: CategoryKey;
  onPress: () => void;
}) {
  const meta = CATEGORIES.find((c) => c.key === category);
  if (!meta) return null;

  return (
    <TouchableOpacity style={styles.sectionCard} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.categoryRowContent}>
        <View style={[styles.sectionIconWrap, { backgroundColor: `${meta.color}20` }]}>
          <Ionicons name={meta.icon as any} size={16} color={meta.color} />
        </View>
        <View style={styles.categoryRowText}>
          <Text style={styles.categoryRowLabel}>Your Category</Text>
          <Text style={[styles.categoryRowValue, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={styles.categoryEditBadge}>
          <Ionicons name="pencil" size={14} color={colors.textSecondary} />
          <Text style={styles.categoryEditText}>Edit</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Settings Menu ───
const MENU_SECTIONS = [
  {
    title: 'Creator Tools',
    items: [
      { icon: 'storefront-outline', label: 'Marketplace', color: colors.gold, action: 'marketplace' },
      { icon: 'analytics-outline', label: 'Creator Dashboard', color: '#A855F7', action: 'creator-dashboard' },
      { icon: 'cloud-upload-outline', label: 'Upload Product', color: '#22C55E', action: 'upload-product' },
      { icon: 'library-outline', label: 'My Library', color: '#3B82F6', action: 'my-library' },
    ],
  },
  {
    title: 'General',
    items: [
      { icon: 'bookmark-outline', label: 'Saved Content', color: colors.gold, action: 'saved' },
      { icon: 'notifications-outline', label: 'Notifications', color: colors.warning, action: 'notifications' },
      { icon: 'color-palette-outline', label: 'Appearance', color: colors.success, action: 'appearance' },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: 'help-circle-outline', label: 'Help Center', color: colors.textSecondary, action: 'help' },
      { icon: 'chatbox-outline', label: 'Send Feedback', color: colors.gold, action: 'feedback' },
      { icon: 'bug-outline', label: 'Report a Problem', color: colors.error, action: 'report' },
      { icon: 'refresh-outline', label: 'Restore Purchases', color: colors.info, action: 'restore' },
      { icon: 'star-outline', label: 'Rate App', color: colors.warning, action: 'rate' },
      { icon: 'share-outline', label: 'Share App', color: colors.info, action: 'share' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { icon: 'document-text-outline', label: 'Terms of Service', color: colors.textSecondary, action: 'terms' },
      { icon: 'shield-outline', label: 'Privacy Policy', color: colors.textSecondary, action: 'privacy' },
      { icon: 'information-circle-outline', label: 'About Giga3 AI', color: colors.textSecondary, action: 'about' },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: 'person-outline', label: 'Account & Security', color: colors.gold, action: 'account' },
      { icon: 'download-outline', label: 'Request My Data', color: colors.info, action: 'data-request' },
      { icon: 'trash-outline', label: 'Delete Account', color: colors.error, action: 'delete-account' },
    ],
  },
];

// ─── Stats Section ───
function StatsSection({ userId }: { userId: string }) {
  const stats = useQuery(
    api.activity.getProfileStats,
    userId ? { userId } : 'skip'
  );
  const earnings = useQuery(
    api.earnings.getEarningsSummary,
    userId ? { userId } : 'skip'
  );

  const STAT_CARDS = [
    { label: 'Study Streak', value: `${stats?.studyStreak ?? 0}`, icon: 'flame', color: '#F97316', suffix: ' days' },
    { label: 'Tools Used', value: `${stats?.toolsUsed ?? 0}`, icon: 'construct', color: '#3B82F6', suffix: '' },
    { label: 'Quizzes Done', value: `${stats?.quizzesCompleted ?? 0}`, icon: 'help-circle', color: '#8B5CF6', suffix: '' },
    { label: 'Earnings', value: `GHS ${(earnings?.total ?? 0).toFixed(0)}`, icon: 'cash', color: '#22C55E', suffix: '' },
  ];

  return (
    <View style={statsStyles.grid}>
      {STAT_CARDS.map((stat) => (
        <View key={stat.label} style={statsStyles.card}>
          <View style={[statsStyles.iconWrap, { backgroundColor: `${stat.color}15` }]}>
            <Ionicons name={stat.icon as any} size={18} color={stat.color} />
          </View>
          <Text style={statsStyles.value}>{stat.value}{stat.suffix}</Text>
          <Text style={statsStyles.label}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

const statsStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  label: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});

// ─── Main ProfileScreen ───
export default function ProfileScreen() {
  const { category, setCategory } = useCategory();
  const { isPremium, restore } = useA0Purchases();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [usage, setUsage] = useState<UsageInfo>({
    count: 0,
    limit: FREE_DAILY_LIMIT,
    remaining: FREE_DAILY_LIMIT,
    isPro: false,
    percentage: 0,
  });
  const [profileRefreshToken, setProfileRefreshToken] = useState(0);

  // Check Convex subscription (Paystack)
  const user = a0?.auth?.getUser?.();
  const authId = getCurrentUserId() || user?.id || '';
  const subscription = useQuery(api.subscriptions.getActive, authId ? { userId: authId } : 'skip');
  const isSignedIn = !!authId;
  const handleAuthAction = useCallback(() => {
    if (isSignedIn) {
      handleSignOut();
      return;
    }
    void a0?.auth?.signInWithGoogle?.();
  }, [isSignedIn]);

  // Derive Pro status from both Paystack subscription AND Apple/Google IAP
  const hasPaystackSub = subscription != null && subscription.status === 'active';
  const isPro = isPremium || hasPaystackSub;

  useFocusEffect(
    useCallback(() => {
      getUsageInfo().then(setUsage);
      // Sync Paystack subscription to local storage
      if (subscription !== undefined) {
        syncSubscriptionFromDB(subscription);
      }
    }, [subscription])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setProfileRefreshToken((value: number) => value + 1);
    await getUsageInfo().then(setUsage);
    setRefreshing(false);
  }, []);

  // Merge purchase state into usage info
  const effectiveUsage: UsageInfo = isPro
    ? { ...usage, isPro: true, remaining: Infinity, percentage: 0 }
    : usage;

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => a0.auth.signOut() },
    ]);
  };

  const handleMenuAction = (action: string) => {
    switch (action) {
      case 'workspace':
        navigation.navigate('Workspace');
        break;
      case 'saved':
        navigation.navigate('Saved');
        break;
      case 'notifications':
        if (Platform.OS === 'ios') {
          Linking.openURL('app-settings:').catch(() => {
            Linking.openSettings().catch(() => {});
          });
        } else {
          Linking.openSettings().catch(() => {
            Alert.alert('Settings', 'Unable to open device settings.');
          });
        }
        break;
      case 'appearance':
        Alert.alert('Appearance', 'The app uses a dark theme optimized for readability and eye comfort. More theme options coming soon.');
        break;
      case 'help':
        Linking.openURL('mailto:ayiiga3@gmail.com?subject=Giga3%20AI%20Help%20Request').catch(() => {
          Alert.alert('Help', 'Contact us at ayiiga3@gmail.com for assistance.');
        });
        break;
      case 'feedback':
        navigation.navigate('Info', { pageId: 'feedback' });
        break;
      case 'report':
        Linking.openURL('mailto:ayiiga3@gmail.com?subject=Giga3%20AI%20Bug%20Report').catch(() => {
          Alert.alert('Report', 'Send bug reports to ayiiga3@gmail.com');
        });
        break;
      case 'restore':
        (async () => {
          try {
            await restore();
            Alert.alert(
              'Restore Complete',
              isPremium
                ? 'Your Pro subscription has been restored.'
                : 'No active subscriptions were found for this account.'
            );
          } catch (error: any) {
            Alert.alert('Restore Failed', error.message || 'Please try again.');
          }
        })();
        break;
      case 'rate':
        Alert.alert('Rate Giga3 AI', 'Rating will be available once the app is published to the store. Thank you for your support!');
        break;
      case 'share':
        Share.share({
          message: 'Check out Giga3 AI — your all-in-one AI assistant for homework, captions, resumes, and more! https://www.giga3ai.com',
        }).catch(() => {});
        break;
      case 'terms':
        navigation.navigate('Info', { pageId: 'terms' });
        break;
      case 'privacy':
        navigation.navigate('Info', { pageId: 'privacy' });
        break;
      case 'about':
        navigation.navigate('Info', { pageId: 'about' });
        break;
      case 'data-request':
        Linking.openURL('mailto:ayiiga3@gmail.com?subject=Giga3%20AI%20Data%20Request&body=I%20would%20like%20to%20request%20a%20copy%20of%20my%20personal%20data.').catch(() => {
          Alert.alert('Data Request', 'Send your data request to ayiiga3@gmail.com');
        });
        break;
      case 'delete-account':
        Alert.alert(
          'Delete Account',
          'This will permanently delete your account and all associated data. This action cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete Account',
              style: 'destructive',
              onPress: () => {
                Linking.openURL('mailto:ayiiga3@gmail.com?subject=Giga3%20AI%20Account%20Deletion%20Request&body=I%20would%20like%20to%20delete%20my%20Giga3%20AI%20account%20and%20all%20associated%20data.').catch(() => {
                  Alert.alert('Delete Account', 'Send your deletion request to ayiiga3@gmail.com');
                });
              },
            },
          ]
        );
        break;
      case 'account':
        Alert.alert('Account', 'Edit your name, email, phone, photo, and password from the profile card above.');
        break;
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} colors={[colors.gold]} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity style={styles.headerAuthButton} onPress={() => {
              if (isSignedIn) {
                handleSignOut();
                return;
              }
              void a0?.auth?.signInWithGoogle?.();
            }} activeOpacity={0.8}>
              <Ionicons name={isSignedIn ? 'log-out-outline' : 'log-in-outline'} size={16} color={colors.textInverse} />
              <Text style={styles.headerAuthButtonText}>{isSignedIn ? 'Sign Out' : 'Sign Up / Login'}</Text>
            </TouchableOpacity>
          </View>

          {/* Auth-specific: Sign-in prompt or Profile card */}
          <Unauthenticated>
            <SignInCard />
          </Unauthenticated>
          <Authenticated>
            <ProfileEditor refreshToken={profileRefreshToken} />
          </Authenticated>

          {/* Section Label */}
          <Text style={styles.sectionLabel}>USAGE & PLAN</Text>

          {/* Usage Card */}
          <UsageCard usage={effectiveUsage} />

          {/* Plan Card */}
          <PlanCard isPro={isPro} onUpgrade={() => setShowPaywall(true)} />

          {/* Section Label */}
          <Text style={styles.sectionLabel}>GROWTH DASHBOARD</Text>

          {/* Stats Section */}
          <StatsSection userId={authId} />

          {/* Section Label */}
          <Text style={styles.sectionLabel}>PERSONALIZATION</Text>

          {/* Category Editor */}
          <CategoryRow category={category} onPress={() => setShowCategoryPicker(true)} />

          {/* Settings Menu Sections */}
          {MENU_SECTIONS.map((section, sIdx) => (
            <View key={sIdx}>
              <Text style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
              <View style={styles.menuCard}>
                {section.items.map((item, iIdx) => (
                  <TouchableOpacity
                    key={iIdx}
                    style={[
                      styles.menuItem,
                      iIdx < section.items.length - 1 && styles.menuItemBorder,
                    ]}
                    activeOpacity={0.6}
                    onPress={() => handleMenuAction(item.action)}
                  >
                    <View style={[styles.menuItemIcon, { backgroundColor: `${item.color}20` }]}>
                      <Ionicons name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Sign Out */}
          <Authenticated>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.error} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </Authenticated>

          {/* Footer */}
          <Text style={styles.versionText}>Giga3 AI v2.0.0</Text>
          <Text style={styles.footerText}>© Giga3 AI — Built in Africa</Text>
          <View style={{ height: spacing.xxxl }} />
        </ScrollView>

        <CategoryPickerModal
          visible={showCategoryPicker}
          currentCategory={category}
          onSelect={setCategory}
          onClose={() => setShowCategoryPicker(false)}
        />

        <PaywallScreen visible={showPaywall} onClose={() => setShowPaywall(false)} />
      </SafeAreaView>
    </View>
  );
}

// ─── Modal Styles ───
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  container: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
});

// ─── Main Styles ───
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  headerAuthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  headerAuthButtonText: {
    ...typography.captionMedium,
    color: colors.textInverse,
  },

  // Sign-in card
  signInCard: {
    alignItems: 'center',
    padding: spacing.xxl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signInAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  signInTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  signInSubtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    width: '100%',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#000',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    width: '100%',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  authBtnText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
  },

  // Profile card
  profileCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  profileHeaderBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  avatarPhoto: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  editPhotoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  profileInput: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  profileActionsRow: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  profileActionBtn: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  profileActionBtnText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
  },
  profileActionSecondary: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileActionSecondaryText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  profileMetaRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  profileHeaderText: {
    flex: 1,
  },
  profileName: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  profileEmail: {
    ...typography.body,
    color: colors.textTertiary,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberBadgeText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  avatarText: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    position: 'absolute',
    right: 0,
    top: 0,
  },

  // Section labels
  sectionLabel: {
    ...typography.captionMedium,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.lg + spacing.xs,
  },

  // Section cards (usage, plan, category)
  sectionCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  usageCountText: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  usageSubtext: {
    ...typography.caption,
    color: colors.textTertiary,
  },

  // Plan card
  planHeader: {
    marginBottom: spacing.sm,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  planBadgeText: {
    ...typography.captionMedium,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  planTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  planDesc: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  upgradeBtnText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
  },

  // Category row
  categoryRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  categoryRowText: {
    flex: 1,
  },
  categoryRowLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  categoryRowValue: {
    ...typography.bodyMedium,
  },
  categoryEditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  categoryEditText: {
    ...typography.small,
    color: colors.textSecondary,
  },

  // Menu sections
  menuCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuItemIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },

  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: {
    ...typography.bodyMedium,
    color: colors.error,
  },
  versionText: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  aboutText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  supportEmail: {
    ...typography.bodyMedium,
    color: colors.gold,
    textDecorationLine: 'underline',
  },
  footerText: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});

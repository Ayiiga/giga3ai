import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, StatusBar, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { A0PurchaseProvider } from 'a0-purchases';
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { a0 } from 'a0-sdk';
import { CategoryContext, CategoryKey, normalizeCategory } from './lib/categoryContext';
import { colors } from './lib/theme';
import { getCurrentUser, onAuthStateChanged } from './lib/platformAuth';
import OnboardingScreen from './screens/OnboardingScreen';
const EarnScreen = lazy(() => import('./screens/EarnScreen'));

const isWebRuntime = Platform.OS === 'web' && typeof globalThis !== 'undefined';

if (isWebRuntime) {
  try {
    const web = globalThis as typeof globalThis & {
      addEventListener?: typeof globalThis.addEventListener;
      removeEventListener?: typeof globalThis.removeEventListener;
      console?: Console;
      __giga3BrowserErrorFilterInstalled?: boolean;
    };

    if (!web.__giga3BrowserErrorFilterInstalled) {
      web.__giga3BrowserErrorFilterInstalled = true;

      const shouldIgnore = (message: string) =>
        message.includes('ResizeObserver loop completed with undelivered notifications') ||
        message.includes('ResizeObserver loop limit exceeded');

      const originalConsoleError = web.console?.error ?? console.error;
      const originalConsoleWarn = web.console?.warn ?? console.warn;

      const patchConsoleMethod = (original: typeof console.error) => (...args: unknown[]) => {
        const message = args.map((value) => String(value)).join(' ');
        if (!shouldIgnore(message)) {
          original(...args);
        }
      };

      if (web.console) {
        try {
          web.console.error = patchConsoleMethod(originalConsoleError);
          web.console.warn = patchConsoleMethod(originalConsoleWarn);
        } catch {
          // Ignore consoles that disallow reassignment.
        }
      }

      const handleWindowError = (event: ErrorEvent) => {
        if (shouldIgnore(event.message || '')) {
          event.preventDefault();
          event.stopImmediatePropagation?.();
        }
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        const reason = String((event.reason && (event.reason.message || event.reason)) || '');
        if (shouldIgnore(reason)) {
          event.preventDefault();
          event.stopImmediatePropagation?.();
        }
      };

      web.addEventListener?.('error', handleWindowError, true);
      web.addEventListener?.('unhandledrejection', handleUnhandledRejection, true);
    }
  } catch {
    // Never let web-only diagnostics break app startup.
  }
}

const HomeScreen = lazy(() => import('./screens/HomeScreen'));
const ChatAIScreen = lazy(() => import('./screens/ChatAIScreen'));
const GeneratorToolsScreen = lazy(() => import('./screens/GeneratorToolsScreen'));
const StudentToolsScreen = lazy(() => import('./screens/StudentToolsScreen'));
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'));
const ToolScreen = lazy(() => import('./screens/ToolScreen'));
const InfoScreen = lazy(() => import('./screens/InfoScreen'));
const SavedScreen = lazy(() => import('./screens/SavedScreen'));
const MarketplaceScreen = lazy(() => import('./screens/MarketplaceScreen'));
const ProductDetailScreen = lazy(() => import('./screens/ProductDetailScreen'));
const UploadProductScreen = lazy(() => import('./screens/UploadProductScreen'));
const CreatorDashboardScreen = lazy(() => import('./screens/CreatorDashboardScreen'));
const MyLibraryScreen = lazy(() => import('./screens/MyLibraryScreen'));
const PaystackCheckoutScreen = lazy(() => import('./screens/PaystackCheckoutScreen'));
const WorkspaceScreen = lazy(() => import('./screens/WorkspaceScreen'));
const ProjectDetailScreen = lazy(() => import('./screens/ProjectDetailScreen'));

const CATEGORY_KEY = 'giga3_user_category';
const ONBOARDING_KEY = 'giga3_onboarding_complete';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS: Record<string, { focused: string; unfocused: string }> = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Earn: { focused: 'storefront', unfocused: 'storefront-outline' },
  Studio: { focused: 'construct', unfocused: 'construct-outline' },
  Learn: { focused: 'school', unfocused: 'school-outline' },
  Profile: { focused: 'person', unfocused: 'person-outline' },
};

function ScreenFallback() {
  return (
    <View style={styles.loadingWrap}>
      <Text style={styles.loadingTitle}>Loading Giga3 AI</Text>
      <Text style={styles.loadingSubtitle}>Optimizing for your device and connection...</Text>
    </View>
  );
}

function AuthScreen() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [step, setStep] = useState<'signIn' | 'signUp' | 'code'>('signIn');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submitEmail = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password.trim()) {
      Alert.alert('Missing details', 'Enter your email and password to continue.');
      return;
    }

    setBusy(true);
    try {
      await signIn('password', { email: trimmedEmail, password, flow: step });
    } catch (error: any) {
      Alert.alert('Authentication failed', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [email, password, signIn, step]);

  const requestPhoneCode = useCallback(async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      Alert.alert('Missing details', 'Enter your phone number to continue.');
      return;
    }

    setBusy(true);
    try {
      await signIn('phone', { phone: trimmedPhone, flow: 'signIn' } as any);
      setStep('code');
    } catch (error: any) {
      Alert.alert('Authentication failed', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [phone, signIn]);

  const submitPhoneCode = useCallback(async () => {
    if (!phone.trim() || !phoneCode.trim()) {
      Alert.alert('Missing details', 'Enter the code sent to your phone.');
      return;
    }

    setBusy(true);
    try {
      await signIn('phone', { phone: phone.trim(), code: phoneCode.trim(), flow: 'signIn' } as any);
    } catch (error: any) {
      Alert.alert('Authentication failed', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [phone, phoneCode, signIn]);

  const handleSocialSignIn = useCallback(async (provider: 'google' | 'apple') => {
    try {
      if (provider === 'google') {
        await a0.auth.signInWithGoogle();
      } else {
        await a0.auth.signInWithApple();
      }
    } catch (error: any) {
      Alert.alert('Sign-in failed', error?.message || 'Please try again.');
    }
  }, []);

  return (
    <KeyboardAvoidingView style={styles.authContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
        <View style={styles.authHeader}>
          <View style={styles.logoBadge}>
            <Ionicons name="sparkles" size={22} color={colors.gold} />
          </View>
          <Text style={styles.authTitle}>Welcome to Giga3 AI</Text>
          <Text style={styles.authSubtitle}>
            Fast email, Google, and phone sign-in with secure session persistence.
          </Text>
        </View>

        <View style={styles.authCard}>
          <View style={styles.authPills}>
            <TouchableOpacity style={[styles.authPill, mode === 'email' && styles.authPillActive]} onPress={() => setMode('email')}>
              <Text style={[styles.authPillText, mode === 'email' && styles.authPillTextActive]}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.authPill, mode === 'phone' && styles.authPillActive]} onPress={() => setMode('phone')}>
              <Text style={[styles.authPillText, mode === 'phone' && styles.authPillTextActive]}>Phone</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.authPill, styles.authPillMuted]} onPress={() => handleSocialSignIn('google')}>
              <Text style={styles.authPillText}>Google</Text>
            </TouchableOpacity>
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={[styles.authPill, styles.authPillMuted]} onPress={() => handleSocialSignIn('apple')}>
                <Text style={styles.authPillText}>Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {mode === 'email' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                inputMode="email"
                textContentType="emailAddress"
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                secureTextEntry
                autoComplete={step === 'signIn' ? 'password' : 'new-password'}
                textContentType={step === 'signIn' ? 'password' : 'newPassword'}
                style={styles.input}
              />

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={submitEmail}
                activeOpacity={0.8}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryBtnText}>{step === 'signIn' ? 'Sign In' : 'Create Account'}</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => setStep(step === 'signIn' ? 'signUp' : 'signIn')}
                activeOpacity={0.7}
              >
                <Text style={styles.linkBtnText}>
                  {step === 'signIn' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
                </Text>
              </TouchableOpacity>
            </>
          ) : step === 'code' ? (
            <>
              <Text style={styles.phoneHelp}>Enter the code we sent to your phone.</Text>
              <TextInput
                value={phoneCode}
                onChangeText={setPhoneCode}
                placeholder="6-digit code"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                style={styles.input}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={submitPhoneCode} activeOpacity={0.8} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryBtnText}>Continue</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkBtn} onPress={() => setStep('signIn')} activeOpacity={0.7}>
                <Text style={styles.linkBtnText}>Use a different number</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                style={styles.input}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={requestPhoneCode} activeOpacity={0.8} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryBtnText}>Send Code</Text>}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.authDivider}>
            <View style={styles.authDividerLine} />
            <Text style={styles.authDividerText}>or continue with</Text>
            <View style={styles.authDividerLine} />
          </View>

          <TouchableOpacity style={styles.socialBtn} onPress={() => handleSocialSignIn('google')} activeOpacity={0.8}>
            <Ionicons name="logo-google" size={18} color={colors.textInverse} />
            <Text style={styles.socialBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.socialBtnDark} onPress={() => handleSocialSignIn('apple')} activeOpacity={0.8}>
              <Ionicons name="logo-apple" size={18} color={colors.textPrimary} />
              <Text style={styles.socialBtnTextDark}>Continue with Apple</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        headerShown: false,
        lazy: true,
        detachInactiveScreens: true,
        tabBarIcon: ({ focused, color }: { focused: boolean; color: string; size: number }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.unfocused;
          return <Ionicons name={iconName as any} size={22} color={color} />;
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 6,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500' as const,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Earn" component={EarnScreen} options={{ tabBarLabel: 'Sell' }} />
      <Tab.Screen name="Studio" component={GeneratorToolsScreen} options={{ tabBarLabel: 'Studio' }} />
      <Tab.Screen name="Learn" component={StudentToolsScreen} options={{ tabBarLabel: 'Learn' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Earn" component={EarnScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Tool" component={ToolScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ChatAI" component={ChatAIScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Info" component={InfoScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Saved" component={SavedScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="UploadProduct" component={UploadProductScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="CreatorDashboard" component={CreatorDashboardScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="MyLibrary" component={MyLibraryScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PaystackCheckout" component={PaystackCheckoutScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Workspace" component={WorkspaceScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}

function AppWithPurchases({
  onboardingComplete,
  onCompleteOnboarding,
}: {
  onboardingComplete: boolean;
  onCompleteOnboarding: (category: CategoryKey) => void;
}) {
  const [userId, setUserId] = useState<string | undefined>(() => getCurrentUser()?.id);

  useEffect(() => {
    return onAuthStateChanged((user) => {
      setUserId(user?.id);
    });
  }, []);

  return (
    <A0PurchaseProvider config={{ appUserId: userId }}>
      <NavigationContainer>
        <Suspense fallback={<ScreenFallback />}>
          {!onboardingComplete ? (
            <OnboardingScreen onComplete={onCompleteOnboarding} />
          ) : (
            <RootNavigator />
          )}
        </Suspense>
      </NavigationContainer>
    </A0PurchaseProvider>
  );
}

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [category, setCategoryState] = useState<CategoryKey>('student');
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CATEGORY_KEY),
      AsyncStorage.getItem(ONBOARDING_KEY),
    ]).then(([storedCategory, storedOnboarding]) => {
      if (storedCategory) setCategoryState(normalizeCategory(storedCategory));
      setOnboardingComplete(storedOnboarding === '1' || !!storedCategory);
      setHydrated(true);
    });
  }, []);

  const setCategory = useCallback(async (cat: CategoryKey) => {
    const normalizedCategory = normalizeCategory(cat);
    setCategoryState(normalizedCategory);
    await AsyncStorage.multiSet([
      [CATEGORY_KEY, normalizedCategory],
      [ONBOARDING_KEY, '1'],
    ]);
    setOnboardingComplete(true);
  }, []);

  const completeOnboarding = useCallback(
    async (cat: CategoryKey) => {
      await setCategory(cat);
    },
    [setCategory]
  );

  if (!hydrated) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingTitle}>Loading Giga3 AI</Text>
          <Text style={styles.loadingSubtitle}>Preparing your workspace...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <CategoryContext.Provider value={{ category, setCategory }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <AuthLoading>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.loadingSubtitle}>Loading your account...</Text>
          </View>
        </AuthLoading>
        <Authenticated>
          <AppWithPurchases
            onboardingComplete={onboardingComplete}
            onCompleteOnboarding={completeOnboarding}
          />
        </Authenticated>
        <Unauthenticated>
          <View style={styles.authGateWrap}>
            <AuthScreen />
          </View>
        </Unauthenticated>
      </SafeAreaProvider>
    </CategoryContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  authContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  authContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  authSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  authCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  authPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  authPill: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  authPillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  authPillMuted: {
    opacity: 0.95,
  },
  authPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  authPillTextActive: {
    color: colors.textInverse,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  linkBtn: {
    alignSelf: 'center',
    paddingVertical: 14,
  },
  linkBtnText: {
    color: colors.goldLight,
    fontSize: 13,
    fontWeight: '600',
  },
  authDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  authDividerText: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 4,
  },
  socialBtnDark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000',
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  socialBtnText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '700',
  },
  socialBtnTextDark: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  phoneHelp: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  authGateWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
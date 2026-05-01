import AsyncStorage from '@react-native-async-storage/async-storage';

const USAGE_KEY = 'giga3_daily_usage';
const PLAN_KEY = 'giga3_user_plan';
const PLAN_TIER_KEY = 'giga3_plan_tier';
export const FREE_DAILY_LIMIT = 8;

const TIER_LIMITS: Record<string, number> = {
  free: 8,
  monthly: 20,
  yearly: 50,
  premium: 999999,
};

type DailyUsage = { date: string; count: number };

export type UsageInfo = {
  count: number;
  limit: number;
  remaining: number;
  isPro: boolean;
  planTier: string;
  percentage: number;
};

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getPlan(): Promise<'free' | 'pro'> {
  const val = await AsyncStorage.getItem(PLAN_KEY);
  return (val as 'free' | 'pro') || 'free';
}

export async function setPlan(plan: 'free' | 'pro'): Promise<void> {
  await AsyncStorage.setItem(PLAN_KEY, plan);
}

export async function getPlanTier(): Promise<string> {
  const val = await AsyncStorage.getItem(PLAN_TIER_KEY);
  return val || 'free';
}

export async function setPlanTier(tier: string): Promise<void> {
  await AsyncStorage.setItem(PLAN_TIER_KEY, tier);
}

export async function syncSubscriptionFromDB(
  subscription: { plan: string; status: string; expiryDate: number; billingPeriod?: string | null } | null
): Promise<void> {
  if (subscription && subscription.status === 'active' && subscription.expiryDate > Date.now()) {
    await setPlan('pro');
    await setPlanTier(subscription.billingPeriod || subscription.plan || 'monthly');
  } else {
    await setPlan('free');
    await setPlanTier('free');
  }
}

export async function getUsageInfo(): Promise<UsageInfo> {
  const plan = await getPlan();
  const tier = await getPlanTier();
  const isPro = plan === 'pro';
  const limit = TIER_LIMITS[tier] || FREE_DAILY_LIMIT;

  if (isPro && tier === 'premium') {
    return { count: 0, limit: 0, remaining: Infinity, isPro: true, planTier: tier, percentage: 0 };
  }

  const raw = await AsyncStorage.getItem(USAGE_KEY);
  const data: DailyUsage = raw ? JSON.parse(raw) : { date: '', count: 0 };
  const today = getTodayString();
  const count = data.date === today ? data.count : 0;
  const remaining = Math.max(0, limit - count);
  const percentage = Math.min(count / limit, 1);

  return { count, limit, remaining, isPro, planTier: tier, percentage };
}

export async function incrementUsage(): Promise<number> {
  const raw = await AsyncStorage.getItem(USAGE_KEY);
  const data: DailyUsage = raw ? JSON.parse(raw) : { date: '', count: 0 };
  const today = getTodayString();
  const newCount = data.date === today ? data.count + 1 : 1;
  await AsyncStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: newCount }));
  return newCount;
}

export async function canGenerate(): Promise<{ allowed: boolean; remaining: number }> {
  const { isPro, remaining } = await getUsageInfo();
  if (isPro) return { allowed: true, remaining: Infinity };
  return { allowed: remaining > 0, remaining };
}
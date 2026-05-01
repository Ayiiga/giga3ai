import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { CategoryKey } from '../lib/categoryContext';

export type { CategoryKey };

const { width } = Dimensions.get('window');

const CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: string;
  description: string;
  color: string;
}[] = [
  { key: 'jhs', label: 'JHS Student', icon: 'school', description: 'Homework, revision, and exam prep', color: '#3B82F6' },
  { key: 'shs', label: 'SHS Student', icon: 'book', description: 'WAEC support, essays, and study plans', color: '#22C55E' },
  { key: 'general', label: 'General User', icon: 'sparkles', description: 'Quick help for daily tasks and writing', color: '#F59E0B' },
  { key: 'creator', label: 'Creator', icon: 'color-palette', description: 'Captions, scripts, and content ideas', color: '#A855F7' },
];

type Props = {
  onComplete: (category: CategoryKey) => void;
};

export default function OnboardingScreen({ onComplete }: Props) {
  const [selected, setSelected] = useState<CategoryKey | null>(null);

  const handleContinue = () => {
    if (selected) {
      onComplete(selected);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="sparkles" size={22} color={colors.gold} />
            </View>
            <Text style={styles.title}>Welcome to Giga3 AI</Text>
            <Text style={styles.subtitle}>
              Choose your main path so we can personalize your tools immediately
            </Text>
          </View>

          <View style={styles.cardsGrid}>
            {CATEGORIES.map((cat) => {
              const isSelected = selected === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.card,
                    isSelected && {
                      borderColor: cat.color,
                      borderWidth: 2,
                      backgroundColor: `${cat.color}08`,
                      ...(Platform.OS === 'ios'
                        ? {
                            shadowColor: cat.color,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.4,
                            shadowRadius: 12,
                          }
                        : { elevation: 8 }),
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setSelected(cat.key)}
                >
                  <View style={styles.cardTop}>
                    <View
                      style={[
                        styles.cardIconWrap,
                        { backgroundColor: `${cat.color}18` },
                        isSelected && { backgroundColor: `${cat.color}28` },
                      ]}
                    >
                      <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                    </View>
                    {isSelected && (
                      <View style={[styles.checkBadge, { backgroundColor: cat.color }]}>
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.cardLabel, isSelected && { color: '#fff' }]}>
                    {cat.label}
                  </Text>
                  <Text style={[styles.cardDesc, isSelected && { color: colors.textSecondary }]}>
                    {cat.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!selected}
            activeOpacity={0.8}
          >
            <Text style={[styles.continueBtnText, !selected && styles.continueBtnTextDisabled]}>
              Get Started
            </Text>
            <Ionicons name="arrow-forward" size={18} color={selected ? colors.textInverse : colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const cardWidth = (width - spacing.lg * 2 - spacing.md) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    width: cardWidth,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    ...typography.caption,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  continueBtnDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
  continueBtnTextDisabled: {
    color: colors.textTertiary,
  },
});
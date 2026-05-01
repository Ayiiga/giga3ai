import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { useNavigation } from '@react-navigation/native';
import { getToolById, ToolDef } from '../lib/tools';

const STUDY_TOOLS = [
  { id: 'study-planner', tagline: 'Timetables, revision & exam prep', highlight: 'NEW — 4 templates', highlightColor: '#0EA5E9' },
  { id: 'flashcards-generator', tagline: 'Auto-generate flashcards from any topic', highlight: 'NEW — 3 formats', highlightColor: '#8B5CF6' },
  { id: 'homework-helper', tagline: 'Step-by-step solutions to any problem', highlight: 'Image upload', highlightColor: '#3B82F6' },
  { id: 'study-notes-generator', tagline: 'Organized notes for any topic', highlight: 'Key terms & mnemonics', highlightColor: '#14B8A6' },
  { id: 'explain-like-10', tagline: 'Complex topics made super simple', highlight: 'Fun & easy', highlightColor: '#10B981' },
];

const EXAM_PREP_TOOLS = [
  { id: 'past-questions', tagline: 'BECE, WASSCE & university practice questions', highlight: 'WAEC Support', highlightColor: '#F97316' },
  { id: 'quiz-generator', tagline: 'Test yourself on any subject', highlight: '4 quiz formats', highlightColor: '#F97316' },
];

const ACADEMIC_WRITING_IDS = [
  'essay-writer', 'thesis-writer', 'research-paper',
  'research-proposal', 'literature-review', 'academic-template',
];

function MainToolCard({ tool, tagline, highlight, highlightColor, onPress }: {
  tool: ToolDef; tagline: string; highlight: string; highlightColor: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.mainCard} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.mainCardIcon, { backgroundColor: `${tool.color}18` }]}>
        <Ionicons name={tool.icon as any} size={26} color={tool.color} />
      </View>
      <View style={styles.mainCardContent}>
        <Text style={styles.mainCardName}>{tool.name}</Text>
        <Text style={styles.mainCardTagline}>{tagline}</Text>
        <View style={[styles.highlightBadge, { backgroundColor: `${highlightColor}15` }]}>
          <Text style={[styles.highlightText, { color: highlightColor }]}>{highlight}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

function SmallToolRow({ tool, onPress }: { tool: ToolDef; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.smallRow} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.smallRowIcon, { backgroundColor: `${tool.color}18` }]}>
        <Ionicons name={tool.icon as any} size={18} color={tool.color} />
      </View>
      <View style={styles.smallRowText}>
        <Text style={styles.smallRowName} numberOfLines={1}>{tool.name}</Text>
        <Text style={styles.smallRowDesc} numberOfLines={1}>{tool.description}</Text>
      </View>
      {tool.templates && tool.templates.length > 0 && (
        <View style={styles.templateCount}>
          <Text style={styles.templateCountText}>{tool.templates.length}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

export default function StudentToolsScreen() {
  const navigation = useNavigation<any>();
  const goTool = (id: string) => navigation.navigate('Tool', { toolId: id });
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>AI Learning Assistant</Text>
            <Text style={styles.headerSubtitle}>
              Study smarter with AI-powered tools
            </Text>
          </View>

          {/* African Education Badge */}
          <View style={styles.africaBanner}>
            <Text style={styles.africaBannerEmoji}>🌍</Text>
            <View style={styles.africaBannerContent}>
              <Text style={styles.africaBannerTitle}>African Education Support</Text>
              <Text style={styles.africaBannerDesc}>WAEC · BECE · WASSCE curriculum-aligned</Text>
            </View>
          </View>

          {/* Academic Integrity Notice */}
          <View style={styles.integrityBanner}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.textTertiary} />
            <Text style={styles.integrityText}>
              AI tools are learning aids. Use responsibly and review all content before submission.
            </Text>
          </View>

          {/* Study Tools */}
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Study Tools</Text>
          </View>
          <View style={styles.toolsList}>
            {STUDY_TOOLS.map((item) => {
              const tool = getToolById(item.id);
              if (!tool) return null;
              return (
                <MainToolCard
                  key={item.id}
                  tool={tool}
                  tagline={item.tagline}
                  highlight={item.highlight}
                  highlightColor={item.highlightColor}
                  onPress={() => goTool(item.id)}
                />
              );
            })}
          </View>

          {/* Exam Prep */}
          <View style={styles.sectionHeader}>
            <Ionicons name="ribbon-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Exam Preparation</Text>
            <View style={styles.examBadge}>
              <Text style={styles.examBadgeText}>BECE · WASSCE</Text>
            </View>
          </View>
          <View style={styles.toolsList}>
            {EXAM_PREP_TOOLS.map((item) => {
              const tool = getToolById(item.id);
              if (!tool) return null;
              return (
                <MainToolCard
                  key={item.id}
                  tool={tool}
                  tagline={item.tagline}
                  highlight={item.highlight}
                  highlightColor={item.highlightColor}
                  onPress={() => goTool(item.id)}
                />
              );
            })}
          </View>

          {/* Image Explain Feature */}
          <View style={styles.featureCard}>
            <View style={styles.featureCardRow}>
              <View style={[styles.featureIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                <Ionicons name="camera" size={24} color="#3B82F6" />
              </View>
              <View style={styles.featureCardContent}>
                <Text style={styles.featureCardTitle}>Image-to-Explain</Text>
                <Text style={styles.featureCardDesc}>
                  Upload assignment screenshots, math problems, book pages, or diagrams — AI explains step-by-step
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.featureCardBtn}
              activeOpacity={0.7}
              onPress={() => goTool('homework-helper')}
            >
              <Ionicons name="camera-outline" size={16} color={colors.textInverse} />
              <Text style={styles.featureCardBtnText}>Try Image Upload</Text>
            </TouchableOpacity>
          </View>

          {/* Academic Writing */}
          <View style={styles.sectionHeader}>
            <Ionicons name="school-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Academic Writing</Text>
          </View>
          <View style={styles.toolsList}>
            {ACADEMIC_WRITING_IDS.map((id) => {
              const tool = getToolById(id);
              if (!tool) return null;
              return <SmallToolRow key={id} tool={tool} onPress={() => goTool(id)} />;
            })}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  scrollContent: { paddingTop: spacing.lg },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  headerTitle: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  headerSubtitle: { ...typography.body, color: colors.textSecondary },

  africaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    padding: spacing.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    gap: spacing.md,
  },
  africaBannerEmoji: { fontSize: 28 },
  africaBannerContent: { flex: 1 },
  africaBannerTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  africaBannerDesc: { ...typography.caption, color: colors.gold },

  integrityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(100, 116, 139, 0.08)',
    borderRadius: borderRadius.md,
  },
  integrityText: {
    ...typography.caption,
    color: colors.textTertiary,
    flex: 1,
    lineHeight: 18,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  examBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  examBadgeText: { ...typography.small, color: '#F97316', fontWeight: '600' },

  toolsList: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  mainCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  mainCardIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCardContent: { flex: 1 },
  mainCardName: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  mainCardTagline: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  highlightBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  highlightText: { ...typography.small, fontWeight: '600' },

  featureCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureCardRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCardContent: { flex: 1 },
  featureCardTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 4 },
  featureCardDesc: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  featureCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  featureCardBtnText: { ...typography.bodyMedium, color: colors.textInverse },

  smallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  smallRowIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallRowText: { flex: 1 },
  smallRowName: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  smallRowDesc: { ...typography.caption, color: colors.textSecondary },
  templateCount: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCountText: { ...typography.small, color: colors.gold, fontWeight: '700' },
});
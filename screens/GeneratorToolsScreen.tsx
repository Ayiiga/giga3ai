import React, { useState } from 'react';
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

type StudioCategory = 'academic' | 'creator' | 'business';

const STUDIO_TABS: { key: StudioCategory; label: string; icon: string; color: string }[] = [
  { key: 'academic', label: 'Academic', icon: 'school', color: '#3B82F6' },
  { key: 'creator', label: 'Creator', icon: 'color-palette', color: '#A855F7' },
  { key: 'business', label: 'Business', icon: 'briefcase', color: '#F59E0B' },
];

const STUDIO_TOOLS: Record<StudioCategory, { id: string; tagline: string }[]> = {
  academic: [
    { id: 'essay-writer', tagline: 'Well-structured academic essays' },
    { id: 'thesis-writer', tagline: 'Full thesis & dissertation support' },
    { id: 'research-paper', tagline: 'Structured academic papers' },
    { id: 'research-proposal', tagline: 'Compelling research proposals' },
    { id: 'literature-review', tagline: 'Comprehensive lit reviews' },
    { id: 'academic-template', tagline: 'Outlines & academic templates' },
    { id: 'study-notes-generator', tagline: 'Organized study summaries' },
  ],
  creator: [
    { id: 'caption-generator', tagline: 'Viral social media captions' },
    { id: 'script-generator', tagline: 'Video, podcast & presentation' },
    { id: 'hook-generator', tagline: 'Scroll-stopping content hooks' },
    { id: 'book-writer', tagline: 'Write any genre of book' },
    { id: 'chapter-builder', tagline: 'Chapter-by-chapter writing' },
    { id: 'ai-image-generator', tagline: 'Create images from text' },
    { id: 'copywriting-assistant', tagline: 'Marketing & educational copy' },
  ],
  business: [
    { id: 'business-name-generator', tagline: 'Creative business name ideas' },
    { id: 'business-plan-builder', tagline: 'Complete business plan structures' },
    { id: 'pitch-deck-generator', tagline: 'Investor pitch deck content' },
    { id: 'marketing-copy', tagline: 'Conversion-focused marketing' },
    { id: 'sales-copy-generator', tagline: 'High-converting sales pages' },
    { id: 'email-writer', tagline: 'Professional emails in seconds' },
    { id: 'resume-builder', tagline: 'ATS-friendly resumes' },
  ],
};

function ToolCard({ tool, tagline, onPress }: { tool: ToolDef; tagline: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: `${tool.color}18` }]}>
          <Ionicons name={tool.icon as any} size={24} color={tool.color} />
        </View>
        <View style={styles.cardArrow}>
          <Ionicons name="arrow-forward" size={14} color={colors.gold} />
        </View>
      </View>
      <Text style={styles.cardName}>{tool.name}</Text>
      <Text style={styles.cardTagline}>{tagline}</Text>
      {tool.templates && tool.templates.length > 0 && (
        <View style={styles.templateBadge}>
          <Ionicons name="layers-outline" size={11} color={colors.gold} />
          <Text style={styles.templateBadgeText}>{tool.templates.length} templates</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function GeneratorToolsScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<StudioCategory>('academic');
  const tabMeta = STUDIO_TABS.find((t) => t.key === activeTab)!;
  const tools = STUDIO_TOOLS[activeTab];
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Generator Studio</Text>
            <Text style={styles.headerSubtitle}>AI-powered content generators by category</Text>
          </View>

          {/* Category Tabs */}
          <View style={styles.tabRow}>
            {STUDIO_TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && { backgroundColor: `${tab.color}20`, borderColor: tab.color }]}
                  activeOpacity={0.7}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Ionicons name={tab.icon as any} size={16} color={isActive ? tab.color : colors.textTertiary} />
                  <Text style={[styles.tabText, isActive && { color: tab.color }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Category Header */}
          <View style={styles.categoryHeader}>
            <Ionicons name={tabMeta.icon as any} size={18} color={tabMeta.color} />
            <Text style={[styles.categoryTitle, { color: tabMeta.color }]}>{tabMeta.label} Tools</Text>
            <Text style={styles.categoryCount}>{tools.length} tools</Text>
          </View>

          {/* Tools Grid */}
          <View style={styles.grid}>
            {tools.map((item) => {
              const tool = getToolById(item.id);
              if (!tool) return null;
              return (
                <ToolCard
                  key={item.id}
                  tool={tool}
                  tagline={item.tagline}
                  onPress={() => navigation.navigate('Tool', { toolId: item.id })}
                />
              );
            })}
          </View>

          <View style={styles.proTip}>
            <Ionicons name="bulb-outline" size={18} color={colors.gold} />
            <Text style={styles.proTipText}>
              Each tool has specialized templates. Select a template for more focused results.
            </Text>
          </View>

          <View style={styles.proTip}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textTertiary} />
            <Text style={styles.proTipText}>
              AI-generated content may contain errors. Always review and verify output before use.
            </Text>
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

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tabText: { ...typography.captionMedium, color: colors.textTertiary },

  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  categoryTitle: { ...typography.h3, flex: 1 },
  categoryCount: { ...typography.caption, color: colors.textTertiary },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: spacing.xs },
  cardTagline: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  templateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  templateBadgeText: { ...typography.small, color: colors.gold },
  proTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    padding: spacing.lg,
    backgroundColor: colors.goldMuted,
    borderRadius: borderRadius.md,
  },
  proTipText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 20 },
});
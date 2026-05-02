import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Share,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import {
  ProjectItem,
  Project,
  getProjectItems,
  getProjects,
  deleteProjectItem,
  moveItemToProject,
  searchProjectItems,
  updateProject,
} from '../lib/projectStorage';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function getTypeLabel(toolName: string): string {
  const lower = toolName.toLowerCase();
  if (lower.includes('quiz')) return 'Quiz';
  if (lower.includes('essay')) return 'Essay';
  if (lower.includes('summary') || lower.includes('summariz')) return 'Summary';
  if (lower.includes('note')) return 'Notes';
  if (lower.includes('flashcard')) return 'Flashcards';
  if (lower.includes('image')) return 'Image';
  return 'Text';
}

// ─── Move to Project Modal ──────────────────────────

function MoveModal({
  visible,
  onClose,
  currentProjectId,
  onMove,
}: {
  visible: boolean;
  onClose: () => void;
  currentProjectId: string;
  onMove: (toProjectId: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);

  React.useEffect(() => {
    if (visible) {
      getProjects().then((p: Project[]) => setProjects(p.filter((pr: Project) => pr.id !== currentProjectId)));
    }
  }, [visible, currentProjectId]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.container}>
          <View style={ms.header}>
            <Text style={ms.title}>Move to Project</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {projects.length === 0 ? (
            <Text style={ms.emptyText}>No other projects available. Create another project first.</Text>
          ) : (
            projects.map((p: Project) => (
              <TouchableOpacity
                key={p.id}
                style={ms.option}
                activeOpacity={0.7}
                onPress={() => {
                  onMove(p.id);
                  onClose();
                }}
              >
                <Ionicons name="folder" size={18} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={ms.optionName}>{p.name}</Text>
                  <Text style={ms.optionSub}>{p.itemCount} items</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Item Card ──────────────────────────────────────

function ItemCard({
  item,
  onCopy,
  onExport,
  onMove,
  onDelete,
  onReopen,
}: {
  item: ProjectItem;
  onCopy: () => void;
  onExport: () => void;
  onMove: () => void;
  onDelete: () => void;
  onReopen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = getTypeLabel(item.toolName);
  const preview = item.result.slice(0, 150);

  return (
    <View style={st.item}>
      <TouchableOpacity style={st.itemHeader} activeOpacity={0.7} onPress={() => setExpanded(!expanded)}>
        <View style={[st.itemIcon, { backgroundColor: `${item.toolColor}15` }]}>
          <Ionicons name={item.toolIcon as any} size={16} color={item.toolColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.itemName} numberOfLines={1}>{item.toolName}</Text>
          <View style={st.itemMeta}>
            <View style={[st.typeBadge, { backgroundColor: `${item.toolColor}15` }]}>
              <Text style={[st.typeText, { color: item.toolColor }]}>{typeLabel}</Text>
            </View>
            <Text style={st.itemDate}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Prompt */}
      <Text style={st.promptLabel}>Prompt</Text>
      <Text style={st.promptText} numberOfLines={expanded ? undefined : 1}>{item.prompt}</Text>

      {/* Preview */}
      <View style={st.previewBox}>
        <Text style={st.previewText} numberOfLines={expanded ? undefined : 3} selectable={expanded}>
          {expanded ? item.result : preview + (item.result.length > 150 ? '...' : '')}
        </Text>
      </View>

      {/* Actions */}
      {expanded && (
        <View style={st.actions}>
          <TouchableOpacity style={st.actionBtn} activeOpacity={0.7} onPress={onCopy}>
            <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
            <Text style={st.actionText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actionBtn} activeOpacity={0.7} onPress={onExport}>
            <Ionicons name="share-outline" size={14} color={colors.textSecondary} />
            <Text style={st.actionText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actionBtn} activeOpacity={0.7} onPress={onMove}>
            <Ionicons name="swap-horizontal" size={14} color={colors.info} />
            <Text style={[st.actionText, { color: colors.info }]}>Move</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actionBtn} activeOpacity={0.7} onPress={onReopen}>
            <Ionicons name="open-outline" size={14} color={colors.gold} />
            <Text style={[st.actionText, { color: colors.gold }]}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.actionBtn} activeOpacity={0.7} onPress={onDelete}>
            <Ionicons name="trash-outline" size={14} color={colors.error} />
            <Text style={[st.actionText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────

type Props = {
  route: { params: { projectId: string; projectName: string } };
  navigation: any;
};

export default function ProjectDetailScreen({ route, navigation }: Props) {
  const { projectId, projectName } = route.params;
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [moveItem, setMoveItem] = useState<ProjectItem | null>(null);

  const load = useCallback(async () => {
    const data = await getProjectItems(projectId);
    setItems(data);
  }, [projectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      await load();
      return;
    }
    const results = await searchProjectItems(projectId, q);
    setItems(results);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setSearchQuery('');
    await load();
    setRefreshing(false);
  };

  const handleCopy = async (item: ProjectItem) => {
    await Clipboard.setStringAsync(item.result);
    Alert.alert('Copied', 'Content copied to clipboard.');
  };

  const handleExport = async (item: ProjectItem) => {
    try {
      if (item.resultType === 'image') {
        await Share.share({
          url: item.result,
          message: Platform.OS === 'android' ? item.result : undefined,
        });
        return;
      }
      // Export as text file
      const fileName = `${item.toolName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, item.result, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: `Export ${item.toolName}`,
          UTI: 'public.plain-text',
        });
      } else {
        await Share.share({ message: item.result });
      }
    } catch (_e) {
      try { await Share.share({ message: item.result }); } catch (__e) {}
    }
  };

  const handleMove = async (toProjectId: string) => {
    if (!moveItem) return;
    await moveItemToProject(projectId, toProjectId, moveItem.id);
    setMoveItem(null);
    await load();
  };

  const handleDelete = (item: ProjectItem) => {
    Alert.alert('Delete Item', `Remove this ${item.toolName} result?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProjectItem(projectId, item.id);
          await load();
        },
      },
    ]);
  };

  const handleReopen = (item: ProjectItem) => {
    navigation.navigate('Tool', {
      toolId: item.toolId,
      preloadedPrompt: item.prompt,
      preloadedResult: item.result,
    });
  };

  const handleExportAll = async () => {
    if (items.length === 0) return;
    const content = items
      .filter((i: ProjectItem) => i.resultType === 'text')
      .map((i: ProjectItem) => `── ${i.toolName} ──\nPrompt: ${i.prompt}\n\n${i.result}`)
      .join('\n\n' + '═'.repeat(40) + '\n\n');

    if (!content) {
      Alert.alert('No Text Content', 'This project only contains image results.');
      return;
    }

    try {
      const fileName = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_export.txt`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: `Export ${projectName}`,
          UTI: 'public.plain-text',
        });
      } else {
        await Share.share({ message: content });
      }
    } catch (_e) {
      try { await Share.share({ message: content }); } catch (__e) {}
    }
  };

  return (
    <View style={st.root}>
      <SafeAreaView edges={['top']} style={st.safe}>
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ padding: spacing.sm }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle} numberOfLines={1}>{projectName}</Text>
            <Text style={st.headerSub}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
          </View>
          {items.length > 0 && (
            <TouchableOpacity
              style={st.exportAllBtn}
              activeOpacity={0.7}
              onPress={handleExportAll}
            >
              <Ionicons name="download-outline" size={18} color={colors.gold} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search */}
        {items.length > 2 && (
          <View style={st.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={st.searchInput}
              placeholder="Search in project..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Items */}
        {items.length === 0 ? (
          <View style={st.empty}>
            <View style={st.emptyIcon}>
              <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={st.emptyTitle}>No saved items</Text>
            <Text style={st.emptySub}>
              Generate content with any AI tool, then use "Save to Project" to add it here
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item: ProjectItem) => item.id}
            contentContainerStyle={st.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} colors={[colors.gold]} />
            }
            renderItem={({ item }: { item: ProjectItem }) => (
              <ItemCard
                item={item}
                onCopy={() => handleCopy(item)}
                onExport={() => handleExport(item)}
                onMove={() => setMoveItem(item)}
                onDelete={() => handleDelete(item)}
                onReopen={() => handleReopen(item)}
              />
            )}
          />
        )}

        {/* Move Modal */}
        <MoveModal
          visible={!!moveItem}
          onClose={() => setMoveItem(null)}
          currentProjectId={projectId}
          onMove={handleMove}
        />
      </SafeAreaView>
    </View>
  );
}

// ─── Modal Styles ────────────────────────────────────

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.lg },
  container: { backgroundColor: colors.surfaceLight, borderRadius: borderRadius.lg, padding: spacing.xxl, maxHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  title: { ...typography.h2, color: colors.textPrimary },
  emptyText: { ...typography.body, color: colors.textTertiary, textAlign: 'center' as const, paddingVertical: spacing.xl },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  optionName: { ...typography.bodyMedium, color: colors.textPrimary },
  optionSub: { ...typography.caption, color: colors.textTertiary },
});

// ─── Main Styles ─────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textTertiary },
  exportAllBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: 4 },

  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  item: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  itemIcon: { width: 32, height: 32, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  itemName: { ...typography.bodyMedium, color: colors.textPrimary },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: borderRadius.sm },
  typeText: { fontSize: 10, fontWeight: '600' as const },
  itemDate: { ...typography.small, color: colors.textTertiary },

  promptLabel: { ...typography.small, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 },
  promptText: { ...typography.caption, color: colors.textSecondary, fontStyle: 'italic' as const, marginBottom: spacing.sm },

  previewBox: { backgroundColor: colors.surfaceLight, borderRadius: borderRadius.md, padding: spacing.md },
  previewText: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md, marginTop: spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, minWidth: '18%' as any, flexGrow: 1, justifyContent: 'center' },
  actionText: { ...typography.small, color: colors.textSecondary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  emptySub: { ...typography.body, color: colors.textTertiary, textAlign: 'center' as const, lineHeight: 22 },
});
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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import {
  Project,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  PROJECT_CATEGORIES,
} from '../lib/projectStorage';

const CATEGORY_COLORS: Record<string, string> = {
  Study: '#3B82F6',
  Research: '#8B5CF6',
  Business: '#F59E0B',
  Creative: '#EC4899',
  Teaching: '#22C55E',
  Other: '#64748B',
};

const CATEGORY_ICONS: Record<string, string> = {
  Study: 'school',
  Research: 'flask',
  Business: 'briefcase',
  Creative: 'color-palette',
  Teaching: 'people',
  Other: 'folder',
};

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

// ─── Create/Edit Project Modal ─────────────────────

function ProjectModal({
  visible,
  onClose,
  onSave,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, category: string) => void;
  initial?: { name: string; description: string; category: string };
}) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState(initial?.category || 'Study');

  // Reset when modal opens
  React.useEffect(() => {
    if (visible) {
      setName(initial?.name || '');
      setDescription(initial?.description || '');
      setCategory(initial?.category || 'Study');
    }
  }, [visible, initial?.name, initial?.description, initial?.category]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a project name.');
      return;
    }
    onSave(name.trim(), description.trim(), category);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <View style={ms.container}>
          <View style={ms.header}>
            <Text style={ms.title}>{initial ? 'Edit Project' : 'New Project'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={ms.label}>Project Name</Text>
          <TextInput
            style={ms.input}
            placeholder="e.g. BECE Preparation"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            maxLength={60}
            autoFocus
          />

          <Text style={ms.label}>Description (optional)</Text>
          <TextInput
            style={[ms.input, { minHeight: 60 }]}
            placeholder="Brief description..."
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            maxLength={200}
            multiline
            textAlignVertical="top"
          />

          <Text style={ms.label}>Category</Text>
          <View style={ms.catGrid}>
            {PROJECT_CATEGORIES.map((cat) => {
              const active = category === cat;
              const clr = CATEGORY_COLORS[cat] || colors.textTertiary;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[ms.catChip, active && { backgroundColor: `${clr}20`, borderColor: clr }]}
                  activeOpacity={0.7}
                  onPress={() => setCategory(cat)}
                >
                  <Ionicons
                    name={(CATEGORY_ICONS[cat] || 'folder') as any}
                    size={14}
                    color={active ? clr : colors.textTertiary}
                  />
                  <Text style={[ms.catText, active && { color: clr }]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={ms.saveBtn} activeOpacity={0.8} onPress={handleSave}>
            <Ionicons name="checkmark" size={18} color={colors.textInverse} />
            <Text style={ms.saveBtnText}>{initial ? 'Update' : 'Create Project'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Project Card ────────────────────────────────────

function ProjectCard({
  project,
  onPress,
  onEdit,
  onDelete,
}: {
  project: Project;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const clr = CATEGORY_COLORS[project.category] || colors.textTertiary;
  const icon = CATEGORY_ICONS[project.category] || 'folder';

  return (
    <TouchableOpacity style={st.card} activeOpacity={0.7} onPress={onPress}>
      <View style={st.cardTop}>
        <View style={[st.cardIcon, { backgroundColor: `${clr}15` }]}>
          <Ionicons name={icon as any} size={22} color={clr} />
        </View>
        <TouchableOpacity
          style={st.moreBtn}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {
            Alert.alert(project.name, '', [
              { text: 'Edit', onPress: onEdit },
              { text: 'Delete', style: 'destructive', onPress: onDelete },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={st.cardName} numberOfLines={1}>{project.name}</Text>
      {project.description ? (
        <Text style={st.cardDesc} numberOfLines={2}>{project.description}</Text>
      ) : null}

      <View style={st.cardFooter}>
        <View style={st.footerBadge}>
          <Ionicons name="document-text" size={12} color={colors.textTertiary} />
          <Text style={st.footerText}>{project.itemCount} {project.itemCount === 1 ? 'item' : 'items'}</Text>
        </View>
        <Text style={st.footerDate}>{formatDate(project.updatedAt)}</Text>
      </View>

      <View style={[st.catStrip, { backgroundColor: clr }]} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────

export default function WorkspaceScreen() {
  const navigation = useNavigation<any>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    const p: Project[] = await getProjects();
    setProjects(p);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCreate = async (name: string, desc: string, cat: string) => {
    await createProject(name, desc, cat);
    await load();
  };

  const handleEdit = async (name: string, desc: string, cat: string) => {
    if (!editProject) return;
    await updateProject(editProject.id, { name, description: desc, category: cat });
    setEditProject(null);
    await load();
  };

  const handleDelete = (project: Project) => {
    Alert.alert('Delete Project', `Delete "${project.name}" and all its saved items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProject(project.id);
          await load();
        },
      },
    ]);
  };

  const filtered = searchQuery.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects;

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
            <Text style={st.headerTitle}>Workspace</Text>
            <Text style={st.headerSub}>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</Text>
          </View>
          <TouchableOpacity
            style={st.addBtn}
            activeOpacity={0.7}
            onPress={() => setShowCreate(true)}
          >
            <Ionicons name="add" size={22} color={colors.gold} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        {projects.length > 0 && (
          <View style={st.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={st.searchInput}
              placeholder="Search projects..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Project List */}
        {filtered.length === 0 ? (
          <View style={st.empty}>
            <View style={st.emptyIcon}>
              <Ionicons name="folder-open-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={st.emptyTitle}>
              {searchQuery ? 'No projects found' : 'No projects yet'}
            </Text>
            <Text style={st.emptySub}>
              {searchQuery
                ? 'Try a different search term'
                : 'Create a project to organize your AI-generated content'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={st.emptyBtn}
                activeOpacity={0.8}
                onPress={() => setShowCreate(true)}
              >
                <Ionicons name="add" size={18} color={colors.textInverse} />
                <Text style={st.emptyBtnText}>Create Project</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item: Project) => item.id}
            numColumns={2}
            columnWrapperStyle={st.row}
            contentContainerStyle={st.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.gold}
                colors={[colors.gold]}
              />
            }
            renderItem={({ item }: { item: Project }) => (
              <ProjectCard
                project={item}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id, projectName: item.name })}
                onEdit={() => setEditProject(item)}
                onDelete={() => handleDelete(item)}
              />
            )}
          />
        )}

        {/* Create Modal */}
        <ProjectModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />

        {/* Edit Modal */}
        <ProjectModal
          visible={!!editProject}
          onClose={() => setEditProject(null)}
          onSave={handleEdit}
          initial={editProject ? { name: editProject.name, description: editProject.description, category: editProject.category } : undefined}
        />
      </SafeAreaView>
    </View>
  );
}

// ─── Modal Styles ────────────────────────────────────

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: spacing.lg },
  container: { backgroundColor: colors.surfaceLight, borderRadius: borderRadius.lg, padding: spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  title: { ...typography.h2, color: colors.textPrimary },
  label: { ...typography.captionMedium, color: colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.lg, ...typography.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  catText: { ...typography.captionMedium, color: colors.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.gold, paddingVertical: spacing.lg, borderRadius: borderRadius.full, marginTop: spacing.xl },
  saveBtnText: { ...typography.bodyMedium, color: colors.textInverse },
});

// ─── Main Styles ─────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSub: { ...typography.caption, color: colors.textTertiary },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldMuted, alignItems: 'center', justifyContent: 'center' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: 4 },

  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  row: { gap: spacing.md },

  card: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  moreBtn: { padding: spacing.xs },
  cardName: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 4 },
  cardDesc: { ...typography.caption, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' as any, paddingTop: spacing.sm },
  footerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { ...typography.small, color: colors.textTertiary },
  footerDate: { ...typography.small, color: colors.textTertiary },
  catStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  emptySub: { ...typography.body, color: colors.textTertiary, textAlign: 'center' as const, lineHeight: 22, marginBottom: spacing.xl },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.gold, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, borderRadius: borderRadius.full },
  emptyBtnText: { ...typography.bodyMedium, color: colors.textInverse },
});
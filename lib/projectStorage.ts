import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────

export type Project = {
  id: string;
  name: string;
  description: string;
  category: string;
  createdAt: number;
  updatedAt: number;
  itemCount: number;
};

export type ProjectItem = {
  id: string;
  projectId: string;
  toolId: string;
  toolName: string;
  toolIcon: string;
  toolColor: string;
  prompt: string;
  result: string;
  resultType: 'text' | 'image';
  createdAt: number;
};

export const PROJECT_CATEGORIES = [
  'Study',
  'Research',
  'Business',
  'Creative',
  'Teaching',
  'Other',
] as const;

// ─── Storage Keys ────────────────────────────────────

const PROJECTS_KEY = 'giga3_projects';
const ITEMS_PREFIX = 'giga3_project_items_';

function itemsKey(projectId: string) {
  return ITEMS_PREFIX + projectId;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// ─── Project CRUD ────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  const raw = await AsyncStorage.getItem(PROJECTS_KEY);
  const projects: Project[] = raw ? JSON.parse(raw) : [];
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function saveProjects(projects: Project[]): Promise<void> {
  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export async function createProject(
  name: string,
  description: string = '',
  category: string = 'Other'
): Promise<Project> {
  const projects = await getProjects();
  const project: Project = {
    id: genId(),
    name: name.trim(),
    description: description.trim(),
    category,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    itemCount: 0,
  };
  projects.unshift(project);
  await saveProjects(projects);
  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'category'>>
): Promise<void> {
  const projects = await getProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return;
  if (updates.name !== undefined) projects[idx].name = updates.name.trim();
  if (updates.description !== undefined) projects[idx].description = updates.description.trim();
  if (updates.category !== undefined) projects[idx].category = updates.category;
  projects[idx].updatedAt = Date.now();
  await saveProjects(projects);
}

export async function deleteProject(id: string): Promise<void> {
  const projects = await getProjects();
  await saveProjects(projects.filter((p) => p.id !== id));
  await AsyncStorage.removeItem(itemsKey(id));
}

// ─── Project Items CRUD ──────────────────────────────

export async function getProjectItems(projectId: string): Promise<ProjectItem[]> {
  const raw = await AsyncStorage.getItem(itemsKey(projectId));
  const items: ProjectItem[] = raw ? JSON.parse(raw) : [];
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

async function saveProjectItems(projectId: string, items: ProjectItem[]): Promise<void> {
  await AsyncStorage.setItem(itemsKey(projectId), JSON.stringify(items));
}

async function syncItemCount(projectId: string): Promise<void> {
  const items = await getProjectItems(projectId);
  const projects = await getProjects();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx !== -1) {
    projects[idx].itemCount = items.length;
    projects[idx].updatedAt = Date.now();
    await saveProjects(projects);
  }
}

export async function addItemToProject(
  projectId: string,
  item: Omit<ProjectItem, 'id' | 'projectId' | 'createdAt'>
): Promise<ProjectItem> {
  const items = await getProjectItems(projectId);
  const newItem: ProjectItem = {
    ...item,
    id: genId(),
    projectId,
    createdAt: Date.now(),
  };
  items.unshift(newItem);
  await saveProjectItems(projectId, items);
  await syncItemCount(projectId);
  return newItem;
}

export async function deleteProjectItem(projectId: string, itemId: string): Promise<void> {
  const items = await getProjectItems(projectId);
  await saveProjectItems(projectId, items.filter((i) => i.id !== itemId));
  await syncItemCount(projectId);
}

export async function moveItemToProject(
  fromProjectId: string,
  toProjectId: string,
  itemId: string
): Promise<void> {
  const fromItems = await getProjectItems(fromProjectId);
  const item = fromItems.find((i) => i.id === itemId);
  if (!item) return;

  // Remove from source
  await saveProjectItems(fromProjectId, fromItems.filter((i) => i.id !== itemId));
  await syncItemCount(fromProjectId);

  // Add to destination
  const toItems = await getProjectItems(toProjectId);
  toItems.unshift({ ...item, projectId: toProjectId });
  await saveProjectItems(toProjectId, toItems);
  await syncItemCount(toProjectId);
}

// ─── Search ──────────────────────────────────────────

export async function searchProjectItems(
  projectId: string,
  query: string
): Promise<ProjectItem[]> {
  const items = await getProjectItems(projectId);
  const q = query.toLowerCase().trim();
  if (!q) return items;
  return items.filter(
    (i) =>
      i.toolName.toLowerCase().includes(q) ||
      i.prompt.toLowerCase().includes(q) ||
      i.result.toLowerCase().includes(q)
  );
}

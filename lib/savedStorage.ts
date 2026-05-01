import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedResult = {
  id: string;
  toolId: string;
  toolName: string;
  toolIcon: string;
  toolColor: string;
  prompt: string;
  result: string;
  resultType: 'text' | 'image';
  timestamp: number;
};

const STORAGE_KEY = 'giga3_saved_results';

export async function getSavedResults(): Promise<SavedResult[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveResult(
  item: Omit<SavedResult, 'id' | 'timestamp'>
): Promise<SavedResult> {
  const items = await getSavedResults();
  const newItem: SavedResult = {
    ...item,
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
  };
  items.unshift(newItem);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return newItem;
}

export async function deleteResult(id: string): Promise<void> {
  const items = await getSavedResults();
  const filtered = items.filter((i) => i.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
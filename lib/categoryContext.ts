import { createContext, useContext } from 'react';

export type CategoryKey = 'jhs' | 'shs' | 'general' | 'creator' | 'student' | 'tutor' | 'entrepreneur';

export const CATEGORY_ALIASES: Record<string, 'student' | 'tutor' | 'creator' | 'entrepreneur'> = {
  jhs: 'student',
  shs: 'student',
  general: 'student',
  creator: 'creator',
  student: 'student',
  tutor: 'tutor',
  entrepreneur: 'entrepreneur',
};

export function normalizeCategory(category: string): 'student' | 'tutor' | 'creator' | 'entrepreneur' {
  return CATEGORY_ALIASES[category] || 'student';
}

type CategoryContextType = {
  category: CategoryKey;
  setCategory: (cat: CategoryKey) => void;
};

export const CategoryContext = createContext<CategoryContextType>({
  category: 'student',
  setCategory: () => {},
});

export const useCategory = () => useContext(CategoryContext);
import { a0 } from 'a0-sdk';

export type PlatformUser = {
  id: string;
  email: string;
  name: string;
  image?: string;
};

function normalizeUser(user: any): PlatformUser | null {
  if (!user) return null;
  const email = String(user.email || '').trim().toLowerCase();
  const id = String(user.id || email || 'anonymous');
  return {
    id,
    email,
    name: user.name || email || 'User',
    image: user.image,
  };
}

function getAuth() {
  return a0?.auth ?? null;
}

export function getCurrentUser(): PlatformUser | null {
  return normalizeUser(getAuth()?.getUser?.());
}

export function getCurrentUserId(): string {
  return getCurrentUser()?.id || '';
}

export function getCurrentUserEmail(): string {
  const user = getCurrentUser();
  return user?.email || user?.id || '';
}

export function onAuthStateChanged(callback: (user: PlatformUser | null) => void) {
  const auth = getAuth();
  if (!auth?.onAuthStateChanged) {
    callback(getCurrentUser());
    return () => {};
  }

  const unsubscribe = auth.onAuthStateChanged((state: any) => {
    callback(normalizeUser(state?.user ?? null));
  });

  return typeof unsubscribe === 'function' ? unsubscribe : () => {};
}

export function signInWithGoogle() {
  return getAuth()?.signInWithGoogle?.();
}

export function signInWithApple() {
  return getAuth()?.signInWithApple?.();
}

export function signOut() {
  return getAuth()?.signOut?.();
}
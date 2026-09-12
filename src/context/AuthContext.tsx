import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as updateAuthProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getAuthOrThrow, getDbOrThrow, isFirebaseConfigured } from '@/lib/firebase';

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
}

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  isStaff: boolean;
  isAdmin: boolean;
  /** Set by an admin from the panel. Cart and ordering are blocked by the rules. */
  suspended: boolean;
  /** True until the first auth state resolution — gate redirects on this. */
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  /** Re-authenticates with the current password first, as Firebase requires. */
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_PROFILE: UserProfile = { name: '', email: '', phone: '', city: '', address: '' };

/**
 * Turns Firebase's error codes into something a shopper can act on.
 * Sign-in failures are deliberately vague about *which* half was wrong, so the
 * form cannot be used to discover which email addresses have accounts.
 */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Try signing in instead.';
    case 'auth/invalid-email':
      return 'That email address does not look valid.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment before trying again.';
    case 'auth/network-request-failed':
      return 'Network unreachable. Check your connection and retry.';
    case 'auth/requires-recent-login':
      return 'For security, sign out and back in, then try again.';
    case 'auth/operation-not-allowed':
      return 'Email sign-in is not enabled for this project yet.';
    default:
      return 'Authentication failed. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('CUSTOMER');
  const [suspended, setSuspended] = useState(false);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;

    return onAuthStateChanged(getAuthOrThrow(), async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setRole('CUSTOMER');
        setSuspended(false);
        setLoading(false);
        return;
      }

      // Hold `user` back until the role has loaded. Publishing the user first
      // would briefly present an admin as a customer, and the admin panel's
      // guard would bounce them before the role arrived.
      setLoading(true);
      const db = getDbOrThrow();

      // The role document is the RBAC source of truth. Rules let a user read
      // only their own, and nobody write one — so a missing doc means customer.
      const [profileSnap, roleSnap, suspensionSnap] = await Promise.all([
        getDoc(doc(db, 'users', nextUser.uid)).catch(() => null),
        getDoc(doc(db, 'roles', nextUser.uid)).catch(() => null),
        getDoc(doc(db, 'suspensions', nextUser.uid)).catch(() => null),
      ]);

      setProfile(
        profileSnap?.exists()
          ? ({ ...EMPTY_PROFILE, ...profileSnap.data() } as UserProfile)
          : { ...EMPTY_PROFILE, name: nextUser.displayName ?? '', email: nextUser.email ?? '' },
      );

      const nextRole = roleSnap?.exists() ? (roleSnap.data().role as UserRole) : 'CUSTOMER';
      setRole(nextRole === 'ADMIN' || nextRole === 'STAFF' ? nextRole : 'CUSTOMER');
      setSuspended(Boolean(suspensionSnap?.exists()));
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (email, password, name) => {
    const credential = await createUserWithEmailAndPassword(
      getAuthOrThrow(),
      email.trim(),
      password,
    );
    await updateAuthProfile(credential.user, { displayName: name.trim() });
    const fresh: UserProfile = { name: name.trim(), email: email.trim(), phone: '', city: '', address: '' };
    await setDoc(doc(getDbOrThrow(), 'users', credential.user.uid), {
      ...fresh,
      updatedAt: serverTimestamp(),
    });
    // The auth listener fired before this document existed, so it would have
    // loaded an empty profile. Publish the real one.
    setProfile(fresh);
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    await signInWithEmailAndPassword(getAuthOrThrow(), email.trim(), password);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getAuthOrThrow());
  }, []);

  const resetPassword = useCallback<AuthContextValue['resetPassword']>(async (email) => {
    await sendPasswordResetEmail(getAuthOrThrow(), email.trim());
  }, []);

  const saveProfile = useCallback<AuthContextValue['saveProfile']>(
    async (next) => {
      if (!user) throw new Error('Not signed in');
      await setDoc(
        doc(getDbOrThrow(), 'users', user.uid),
        { ...next, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setProfile(next);
    },
    [user],
  );

  const changePassword = useCallback<AuthContextValue['changePassword']>(
    async (currentPassword, nextPassword) => {
      if (!user?.email) throw new Error('Not signed in');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      await updatePassword(user, nextPassword);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role,
      isStaff: role === 'ADMIN' || role === 'STAFF',
      isAdmin: role === 'ADMIN',
      suspended,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      saveProfile,
      changePassword,
    }),
    [user, profile, role, suspended, loading, signUp, signIn, signOut, resetPassword, saveProfile, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

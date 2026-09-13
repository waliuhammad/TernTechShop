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
import { siteConfig } from '@/config/site';
import { useToast } from '@/context/ToastContext';
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
  /** True after a suspended customer was signed out, so the login page can explain why. */
  accountSuspended: boolean;
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
export const SUSPENDED_MESSAGE = `This account has been suspended. Contact ${siteConfig.contact.email} if you think this is a mistake.`;

/** Thrown by signIn when the account exists but an admin has suspended it. */
class AccountSuspendedError extends Error {
  code = 'app/account-suspended';
}

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'app/account-suspended':
      return SUSPENDED_MESSAGE;
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
  const [accountSuspended, setAccountSuspended] = useState(false);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const { notify } = useToast();

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

      const nextRole = roleSnap?.exists() ? (roleSnap.data().role as UserRole) : 'CUSTOMER';
      const isCustomer = nextRole !== 'ADMIN' && nextRole !== 'STAFF';

      // Firebase Auth can only disable an account from a server, so a suspended
      // customer is signed straight back out here. The rules refuse their cart,
      // orders and reviews regardless, so this is the visible half of the block.
      if (isCustomer && suspensionSnap?.exists()) {
        setAccountSuspended(true);
        notify(SUSPENDED_MESSAGE, 'error');
        await firebaseSignOut(getAuthOrThrow());
        return;
      }

      setProfile(
        profileSnap?.exists()
          ? ({ ...EMPTY_PROFILE, ...profileSnap.data() } as UserProfile)
          : { ...EMPTY_PROFILE, name: nextUser.displayName ?? '', email: nextUser.email ?? '' },
      );

      setRole(isCustomer ? 'CUSTOMER' : nextRole);
      setSuspended(false);
      setUser(nextUser);
      setLoading(false);
    });
  }, [notify]);

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
    setAccountSuspended(false);
    const credential = await signInWithEmailAndPassword(getAuthOrThrow(), email.trim(), password);
    const [roleSnap, suspensionSnap] = await Promise.all([
      getDoc(doc(getDbOrThrow(), 'roles', credential.user.uid)).catch(() => null),
      getDoc(doc(getDbOrThrow(), 'suspensions', credential.user.uid)).catch(() => null),
    ]);
    if (!roleSnap?.exists() && suspensionSnap?.exists()) {
      setAccountSuspended(true);
      await firebaseSignOut(getAuthOrThrow());
      throw new AccountSuspendedError(SUSPENDED_MESSAGE);
    }
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
      accountSuspended,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      saveProfile,
      changePassword,
    }),
    [user, profile, role, suspended, accountSuspended, loading, signUp, signIn, signOut, resetPassword, saveProfile, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

/**
 * Auth context with phone+OTP, Google, email+OTP support.
 * Now uses REAL Supabase authentication.
 * 
 * No upfront role choice — every user can both post jobs and find work.
 * After login, profileComplete drives whether /complete-profile is shown.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { Session, User, AuthError } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  profileComplete: boolean;
  /** Avatar URL or initials */
  avatar?: string | undefined;
  location?: string | undefined;
}

export interface PendingAction {
  type: "book-shift" | "post-shift" | "message" | "dashboard";
  payload?: unknown;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  openLoginModal: (pending?: PendingAction) => void;
  closeLoginModal: () => void;
  loginModalOpen: boolean;
  pendingAction: PendingAction | null;
  clearPendingAction: () => void;
  /** Phone+OTP login. Returns user object on success. */
  loginWithPhone: (phone: string, otp: string) => Promise<AuthUser>;
  /** Google OAuth login. Returns user object on success. */
  loginWithGoogle: () => Promise<AuthUser>;
  /** Email+OTP login. Returns user object on success. */
  loginWithEmail: (email: string, otp: string) => Promise<AuthUser>;
  /** Send OTP to phone. Returns true on success. */
  sendPhoneOTP: (phone: string) => Promise<boolean>;
  /** Send OTP to email. Returns true on success. */
  sendEmailOTP: (email: string) => Promise<boolean>;
  /** Complete user profile after first login. */
  completeProfile: (data: Partial<AuthUser>) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const supabase = getSupabase();

  // ── Fetch user profile from database ──────────────────────────────────────
  const fetchUserProfile = useCallback(async (authUser: User): Promise<AuthUser> => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned (profile doesn't exist yet)
      console.error("Error fetching profile:", error);
    }

    // Generate initials from name
    const initials = profile?.name
      ? profile.name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : undefined;

    return {
      id: authUser.id,
      name: profile?.name || null,
      phone: profile?.phone || authUser.phone || null,
      email: profile?.email || authUser.email || null,
      profileComplete: profile?.profile_complete || false,
      avatar: profile?.avatar_url || initials,
      location: profile?.location || undefined,
    };
  }, [supabase]);

  // ── Initialize session on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user).then(setUser).catch(console.error);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user).then(setUser).catch(console.error);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchUserProfile]);

  const openLoginModal = useCallback((pending?: PendingAction) => {
    if (pending) setPendingAction(pending);
    setLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
  }, []);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  // ── Real phone+OTP login ──────────────────────────────────────────────────
  const loginWithPhone = useCallback(async (phone: string, otp: string): Promise<AuthUser> => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("No user returned from OTP verification");
    }

    const authUser = await fetchUserProfile(data.user);
    setUser(authUser);
    setLoginModalOpen(false);
    return authUser;
  }, [supabase, fetchUserProfile]);

  // ── Real Google OAuth ─────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(async (): Promise<AuthUser> => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth-callback`,
      },
    });

    if (error) {
      throw error;
    }

    // OAuth flow redirects, so we won't immediately have a user
    // The user will be set via onAuthStateChange after redirect
    // For now, return a placeholder that will be replaced
    throw new Error("OAuth redirect in progress");
  }, [supabase]);

  // ── Real email+OTP login ──────────────────────────────────────────────────
  const loginWithEmail = useCallback(async (email: string, otp: string): Promise<AuthUser> => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("No user returned from OTP verification");
    }

    const authUser = await fetchUserProfile(data.user);
    setUser(authUser);
    setLoginModalOpen(false);
    return authUser;
  }, [supabase, fetchUserProfile]);

  // ── Send phone OTP ────────────────────────────────────────────────────────
  const sendPhoneOTP = useCallback(async (phone: string): Promise<boolean> => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      throw error;
    }

    return true;
  }, [supabase]);

  // ── Send email OTP ────────────────────────────────────────────────────────
  const sendEmailOTP = useCallback(async (email: string): Promise<boolean> => {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      throw error;
    }

    return true;
  }, [supabase]);

  // ── Complete profile ──────────────────────────────────────────────────────
  const completeProfile = useCallback(async (data: Partial<AuthUser>) => {
    if (!supabase || !user) {
      throw new Error("Not authenticated");
    }

    const initials = data.name
      ? data.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : undefined;

    const { error } = await supabase
      .from("profiles")
      .update({
        name: data.name || null,
        phone: data.phone || null,
        location: data.location || null,
        avatar_url: data.avatar || initials || null,
        profile_complete: true,
      })
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    // Update local state
    setUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        ...data,
        profileComplete: true,
        avatar: data.avatar || initials,
      };
    });
  }, [supabase, user]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      setPendingAction(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
    setUser(null);
    setPendingAction(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn: user !== null && !loading,
      user,
      session,
      loading,
      openLoginModal,
      closeLoginModal,
      loginModalOpen,
      pendingAction,
      clearPendingAction,
      loginWithPhone,
      loginWithGoogle,
      loginWithEmail,
      sendPhoneOTP,
      sendEmailOTP,
      completeProfile,
      logout,
    }),
    [
      user,
      session,
      loading,
      loginModalOpen,
      pendingAction,
      openLoginModal,
      closeLoginModal,
      clearPendingAction,
      loginWithPhone,
      loginWithGoogle,
      loginWithEmail,
      sendPhoneOTP,
      sendEmailOTP,
      completeProfile,
      logout,
    ],
  );

  // If Supabase is not configured, provide fallback context that won't crash
  if (!isSupabaseConfigured) {
    const fallbackValue: AuthContextValue = {
      isLoggedIn: false,
      user: null,
      session: null,
      loading: false,
      openLoginModal: () => console.warn("Supabase not configured"),
      closeLoginModal: () => {},
      loginModalOpen: false,
      pendingAction: null,
      clearPendingAction: () => {},
      loginWithPhone: async () => {
        throw new Error("Supabase not configured");
      },
      loginWithGoogle: async () => {
        throw new Error("Supabase not configured");
      },
      loginWithEmail: async () => {
        throw new Error("Supabase not configured");
      },
      sendPhoneOTP: async () => {
        throw new Error("Supabase not configured");
      },
      sendEmailOTP: async () => {
        throw new Error("Supabase not configured");
      },
      completeProfile: async () => {
        throw new Error("Supabase not configured");
      },
      logout: async () => {},
    };
    return <AuthContext.Provider value={fallbackValue}>{children}</AuthContext.Provider>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

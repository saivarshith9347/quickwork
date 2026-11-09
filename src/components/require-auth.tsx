/**
 * RequireAuth - Centralized authentication guard
 *
 * Usage:
 *   <RequireAuth>
 *     <ProtectedContent />
 *   </RequireAuth>
 *
 * Behavior:
 * - Loading: Show skeleton, never redirect
 * - Logged out: Open login modal with pending action, show sign-in prompt
 * - Incomplete profile: Redirect to /complete-profile
 * - Authenticated & complete: Render children
 */

import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, isLoading, profileComplete, openLoginModal } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If logged out, open login modal with current path as pending action
    if (!isLoading && !user) {
      openLoginModal({ action: "resume", path: window.location.pathname });
    }

    // If profile incomplete, redirect to complete-profile
    if (!isLoading && user && !profileComplete) {
      void navigate({ to: "/complete-profile" });
    }
  }, [user, isLoading, profileComplete, openLoginModal, navigate]);

  // Loading state: show skeleton
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          {/* Header skeleton */}
          <div className="h-8 w-64 rounded-lg bg-muted" />

          {/* Content skeleton */}
          <div className="space-y-4">
            <div className="h-32 rounded-2xl bg-muted" />
            <div className="h-32 rounded-2xl bg-muted" />
            <div className="h-32 rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  // Not logged in: show sign-in prompt
  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-8 w-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-foreground">Sign in required</h2>
          <p className="mb-6 text-muted-foreground">
            Please sign in to access this page
          </p>
          <button
            onClick={() => openLoginModal({ action: "resume", path: window.location.pathname })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:opacity-90"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Profile incomplete: navigating to complete-profile (handled by useEffect)
  if (!profileComplete) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded-lg bg-muted" />
          <div className="space-y-4">
            <div className="h-32 rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  // Authenticated and profile complete: render children
  return <>{children}</>;
}

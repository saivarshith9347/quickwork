/**
 * OAuth Callback Route
 * 
 * Handles OAuth provider redirects (Google, etc.) after successful authentication.
 * Supabase automatically handles the token exchange, we just need to redirect
 * the user to an appropriate page.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth-callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Wait for auth state to settle
    if (loading) return;

    if (user) {
      // If profile is incomplete, redirect to complete profile
      if (!user.profileComplete) {
        window.location.href = "/complete-profile";
      } else {
        // Otherwise go to dashboard or home
        window.location.href = "/dashboard";
      }
    } else {
      // No user? Something went wrong, go back to home
      window.location.href = "/";
    }
  }, [user, loading]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

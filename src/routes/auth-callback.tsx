/**
 * OAuth Callback Route
 *
 * Handles OAuth provider redirects (Google, etc.) after successful authentication.
 * Supabase automatically handles the token exchange, we just need to redirect
 * the user to an appropriate page.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth-callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const { user, loading, pendingAction, clearPendingAction } = useAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check for error in URL parameters
    const params = new URLSearchParams(window.location.search);
    const errorDescription = params.get("error_description");
    
    if (errorDescription) {
      setErrorMessage(decodeURIComponent(errorDescription));
      return;
    }

    // Wait for auth state to settle - both loading must be false AND user must be resolved
    if (loading) return;

    if (user) {
      // Determine redirect destination
      let destination = "/dashboard";

      if (!user.profileComplete) {
        // Profile incomplete - always go to complete profile first
        destination = "/complete-profile";
      } else if (pendingAction) {
        // Profile complete and there's a saved pending action
        switch (pendingAction.type) {
          case "book-shift":
            destination = pendingAction.payload 
              ? `/apply/${(pendingAction.payload as { shiftId: string }).shiftId}`
              : "/hire";
            break;
          case "post-shift":
            destination = "/post-job";
            break;
          case "message":
            destination = "/messages";
            break;
          case "dashboard":
          default:
            destination = "/dashboard";
            break;
        }
        clearPendingAction();
      }

      // Use router navigation instead of window.location
      navigate({ to: destination });
    } else {
      // No user after loading complete - auth failed
      navigate({ to: "/" });
    }
  }, [user, loading, pendingAction, clearPendingAction, navigate]);

  // Show error message if present
  if (errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="mb-4 text-destructive">
            <svg
              className="inline-block h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

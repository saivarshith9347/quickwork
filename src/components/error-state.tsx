/**
 * Error State Component
 *
 * Reusable error display with retry functionality.
 * Used for failed API calls, network errors, etc.
 */

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  type?: "network" | "generic" | "notFound";
}

export function ErrorState({ title, description, onRetry, type = "generic" }: ErrorStateProps) {
  const config = {
    network: {
      icon: WifiOff,
      defaultTitle: "Connection Error",
      defaultDescription:
        "Unable to connect to the server. Please check your internet connection and try again.",
      retryLabel: "Retry Connection",
    },
    notFound: {
      icon: AlertCircle,
      defaultTitle: "Not Found",
      defaultDescription: "The item you're looking for doesn't exist or has been removed.",
      retryLabel: "Go Back",
    },
    generic: {
      icon: AlertCircle,
      defaultTitle: "Something Went Wrong",
      defaultDescription: "We encountered an error while loading this page. Please try again.",
      retryLabel: "Try Again",
    },
  }[type];

  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <Icon className="size-8" />
      </div>
      <h3 className="mt-6 text-xl font-semibold text-destructive">
        {title || config.defaultTitle}
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description || config.defaultDescription}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="lg"
          className="mt-6 border-destructive/50 text-destructive hover:bg-destructive/10"
          onClick={onRetry}
        >
          <RefreshCw className="size-4" />
          {config.retryLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * Empty State Component
 *
 * Reusable empty state display with icon, title, description, and optional action.
 * Used when no data is available (no jobs, no applicants, etc.).
 */

import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "muted";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-surface p-12 text-center">
      <div
        className={`flex size-16 items-center justify-center rounded-2xl ${
          variant === "muted" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="size-8" />
      </div>
      <h3 className="mt-6 text-xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button variant="hero" size="lg" className="mt-6" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Application Card Component
 * Displays application details with actions for both workers and employers
 */

import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApplicationStatusBadge } from "@/components/application-status-badge";
import { ApplicationService, type Application } from "@/lib/services/application-service";

interface ApplicationCardProps {
  application: Application;
  viewMode: "worker" | "employer";
  showActions?: boolean;
  onStatusChange?: () => void;
}

export function ApplicationCard({
  application,
  viewMode,
  showActions = true,
  onStatusChange,
}: ApplicationCardProps) {
  const [acting, setActing] = useState(false);

  const handleAccept = async () => {
    setActing(true);
    const result = await ApplicationService.employerUpdateApplication(application.id, "ACCEPTED");
    if (result.success) {
      toast.success("Application accepted!");
      onStatusChange?.();
    } else {
      toast.error("Failed to accept application", {
        description: result.error || "Unable to update application status. Please try again.",
      });
    }
    setActing(false);
  };

  const handleReject = async () => {
    setActing(true);
    const result = await ApplicationService.employerUpdateApplication(application.id, "REJECTED");
    if (result.success) {
      toast.success("Application rejected");
      onStatusChange?.();
    } else {
      toast.error("Failed to reject application", {
        description: result.error || "Unable to update application status. Please try again.",
      });
    }
    setActing(false);
  };

  const showEmployerActions =
    viewMode === "employer" &&
    showActions &&
    application.status === "PENDING";

  return (
    <div className="rounded-lg border bg-card p-4 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {viewMode === "employer" ? (
                <p className="font-medium">
                  {application.worker?.name || `Worker ID: ${application.workerId}`}
                </p>
              ) : (
                <p className="font-medium">Job ID: {application.jobId}</p>
              )}
            </div>
            <ApplicationStatusBadge status={application.status} />
          </div>

          {/* Dates */}
          <div className="text-sm text-muted-foreground">
            <p>
              Applied:{" "}
              {new Date(application.appliedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {application.status === "ACCEPTED" && (
              <p className="text-success">
                Accepted
              </p>
            )}
          </div>

          {/* Worker Note */}
          {application.workerNote && (
            <div className="rounded bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">Worker note:</p>
              <p className="mt-1 text-sm italic">"{application.workerNote}"</p>
            </div>
          )}

          {/* Employer Note */}
          {application.employerNote && (
            <div className="rounded border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary">
                {viewMode === "worker" ? "Employer note:" : "Your note:"}
              </p>
              <p className="mt-1 text-sm">{application.employerNote}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions (Employer only) */}
      {showEmployerActions && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button 
            onClick={handleAccept} 
            size="sm" 
            className="flex-1 sm:flex-initial"
            disabled={acting}
          >
            {acting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Accept
          </Button>

          <Button
            onClick={handleReject}
            size="sm"
            variant="ghost"
            className="flex-1 sm:flex-initial"
            disabled={acting}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </div>
      )}

      {/* View Booking Button (Worker view, Accepted / Booked status) */}
      {viewMode === "worker" &&
        (application.status === "ACCEPTED" || application.status === "BOOKED") && (
          <div className="mt-4">
            <Button variant="hero" size="sm" asChild className="w-full">
              <Link
                to="/booking-confirmation/$applicationId"
                params={{ applicationId: application.id }}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                View Booking Confirmation
              </Link>
            </Button>
          </div>
        )}
    </div>
  );
}

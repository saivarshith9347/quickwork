/**
 * Application Card Component
 * Displays application details with actions for both workers and employers
 */

import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApplicationStatusBadge } from '@/components/application-status-badge';
import {
  useApplications,
  canConfirmApplication,
  canRejectApplication,
  canWaitlistApplication,
  type Application as ModelApplication,
} from '@/lib/application-model';
import type { Application as ServiceApplication } from '@/lib/services/application-service';
import { useApplicationJobSync } from '@/lib/application-job-sync';

export type CompatibleApplication = (ServiceApplication | ModelApplication) & {
  posterNote?: string | null | undefined;
  employerNote?: string | null | undefined;
};

interface ApplicationCardProps {
  application: CompatibleApplication;
  viewMode: 'worker' | 'employer';
  showActions?: boolean;
  onStatusChange?: (jobId: string, confirmedCount: number) => void;
}

export function ApplicationCard({
  application,
  viewMode,
  showActions = true,
  onStatusChange,
}: ApplicationCardProps) {
  const { confirmWithSync, rejectWithSync, waitlistWithSync } = useApplicationJobSync();
  
  const handleConfirm = () => {
    const result = confirmWithSync(application.id, 'Welcome! Looking forward to working with you.');
    if (result.success) {
      toast.success('Application confirmed!');
      if (result.jobId && result.confirmedCount !== undefined) {
        onStatusChange?.(result.jobId, result.confirmedCount);
      }
    } else {
      toast.error('Failed to confirm application');
    }
  };
  
  const handleReject = () => {
    const result = rejectWithSync(application.id, 'Position filled. Thank you for your interest.');
    if (result.success) {
      toast.success('Application rejected');
      if (result.jobId && result.confirmedCount !== undefined) {
        onStatusChange?.(result.jobId, result.confirmedCount);
      }
    } else {
      toast.error('Failed to reject application');
    }
  };
  
  const handleWaitlist = () => {
    const result = waitlistWithSync(application.id, 'Great profile! We may contact you if a spot opens.');
    if (result.success) {
      toast.success('Moved to waitlist');
      onStatusChange?.(application.jobId, 0); // No position change for waitlist
    } else {
      toast.error('Failed to waitlist application');
    }
  };
  
  const showEmployerActions = 
    viewMode === 'employer' && 
    showActions && 
    (application.status === 'Pending' || application.status === 'Waitlisted');
  
  return (
    <div className="rounded-lg border bg-card p-4 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {viewMode === 'employer' ? (
                <p className="font-medium">Worker ID: {application.workerId}</p>
              ) : (
                <p className="font-medium">Job ID: {application.jobId}</p>
              )}
            </div>
            <ApplicationStatusBadge status={application.status} />
          </div>
          
          {/* Dates */}
          <div className="text-sm text-muted-foreground">
            <p>Applied: {new Date(application.appliedAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            {application.confirmedAt && (
              <p className="text-success">
                Confirmed: {new Date(application.confirmedAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
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
          
          {/* Employer / Poster Note */}
          {(application.employerNote || application.posterNote) && (
            <div className="rounded border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary">
                {viewMode === 'worker' ? 'Employer note:' : 'Your note:'}
              </p>
              <p className="mt-1 text-sm">{application.employerNote || application.posterNote}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Actions (Employer only) */}
      {showEmployerActions && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canConfirmApplication(application.status as any) && (
            <Button onClick={handleConfirm} size="sm" className="flex-1 sm:flex-initial">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm
            </Button>
          )}
          
          {canWaitlistApplication(application.status as any) && (
            <Button onClick={handleWaitlist} size="sm" variant="outline" className="flex-1 sm:flex-initial">
              <Clock className="mr-2 h-4 w-4" />
              Waitlist
            </Button>
          )}
          
          {canRejectApplication(application.status as any) && (
            <Button onClick={handleReject} size="sm" variant="ghost" className="flex-1 sm:flex-initial">
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          )}
        </div>
      )}
      
      {/* View Booking Button (Worker view, Confirmed / Booked / Accepted status) */}
      {viewMode === 'worker' && (application.status === 'Confirmed' || application.status === 'BOOKED' || application.status === 'ACCEPTED') && (
        <div className="mt-4">
          <Button variant="hero" size="sm" asChild className="w-full">
            <Link to="/booking-confirmation/$applicationId" params={{ applicationId: application.id }}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              View Booking Confirmation
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

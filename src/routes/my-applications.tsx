/**
 * My Applications Page - Worker view of all submitted job applications
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, CheckCircle2, XCircle, Users, Briefcase, ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ApplicationCard } from "@/components/application-card";
import { useAuth } from "@/lib/auth-context";
import { useWorkerApplications } from "@/lib/hooks/use-applications";
import type { ApplicationStatus } from "@/lib/services/application-service";
import { ErrorState } from "@/components/error-state";

export const Route = createFileRoute("/my-applications")({
  head: () => ({
    meta: [
      { title: "My Applications — QuickWork" },
      {
        name: "description",
        content: "View and manage all your job applications on QuickWork. Track application status and employer feedback.",
      },
      { property: "og:title", content: "QuickWork — My Applications" },
      {
        property: "og:description",
        content: "Track all your job applications in one place.",
      },
    ],
  }),
  component: MyApplicationsPage,
});

function MyApplicationsPage() {
  const { user, isLoggedIn, openLoginModal } = useAuth();
  
  const [filter, setFilter] = useState<'all' | ApplicationStatus>('all');

  // Fetch applications using React Query (always called at top level before early returns)
  const { data: allApplications, isLoading, error, refetch } = useWorkerApplications(
    { workerId: user?.id },
    { enabled: !!user?.id && isLoggedIn }
  );
  
  // Redirect if not logged in
  if (!isLoggedIn || !user) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Briefcase className="size-8" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">Login Required</h1>
          <p className="mt-2 text-muted-foreground">
            Please log in to view your job applications.
          </p>
          <Button
            variant="hero"
            size="lg"
            className="mt-6"
            onClick={() => openLoginModal()}
          >
            Log in to continue
          </Button>
        </div>
      </div>
    );
  }
  
  const filteredApplications = filter === 'all'
    ? (allApplications || [])
    : (allApplications || []).filter(app => app.status === filter);
  
  // Count by status
  const counts = {
    all: allApplications?.length || 0,
    PENDING: allApplications?.filter(a => a.status === 'PENDING').length || 0,
    BOOKED: allApplications?.filter(a => a.status === 'BOOKED' || a.status === 'ACCEPTED').length || 0,
    CANCELLED: allApplications?.filter(a => a.status === 'CANCELLED').length || 0,
    REJECTED: allApplications?.filter(a => a.status === 'REJECTED').length || 0,
  };
  
  return (
    <div className="mx-auto max-w-4xl px-5 py-14 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/work">
            <ArrowLeft className="size-4" />
            Back to Jobs
          </Link>
        </Button>
      </div>
      
      <div className="mt-6">
        <p className="text-sm font-semibold text-primary">Your Applications</p>
        <h1 className="mt-2 text-4xl font-bold sm:text-5xl">My Applications</h1>
        <p className="mt-3 text-muted-foreground">
          Track the status of all your job applications in one place.
        </p>
      </div>
      
      {/* Stats Cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total"
          value={counts.all}
          icon={Briefcase}
          color="text-foreground"
          isActive={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <StatCard
          label="Pending"
          value={counts.PENDING}
          icon={Clock}
          color="text-amber-600"
          isActive={filter === 'PENDING'}
          onClick={() => setFilter('PENDING')}
        />
        <StatCard
          label="Booked"
          value={counts.BOOKED}
          icon={CheckCircle2}
          color="text-success"
          isActive={filter === 'BOOKED'}
          onClick={() => setFilter('BOOKED')}
        />
        <StatCard
          label="Cancelled"
          value={counts.CANCELLED}
          icon={XCircle}
          color="text-destructive"
          isActive={filter === 'CANCELLED'}
          onClick={() => setFilter('CANCELLED')}
        />
      </div>
      
      {/* Filter Tabs */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-4">
        <TabButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`All (${counts.all})`}
        />
        <TabButton
          active={filter === 'PENDING'}
          onClick={() => setFilter('PENDING')}
          label={`Pending (${counts.PENDING})`}
        />
        <TabButton
          active={filter === 'BOOKED'}
          onClick={() => setFilter('BOOKED')}
          label={`Booked (${counts.BOOKED})`}
        />
        <TabButton
          active={filter === 'CANCELLED'}
          onClick={() => setFilter('CANCELLED')}
          label={`Cancelled (${counts.CANCELLED})`}
        />
        <TabButton
          active={filter === 'REJECTED'}
          onClick={() => setFilter('REJECTED')}
          label={`Rejected (${counts.REJECTED})`}
        />
      </div>
      
      {/* Loading state */}
      {isLoading && (
        <div className="mt-8 flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}
      
      {/* Error state */}
      {error && !isLoading && (
        <ErrorState
          title="Could not load applications"
          description={error.message}
          onRetry={() => refetch()}
        />
      )}
      
      {/* Applications List */}
      {!isLoading && !error && (
        <div className="mt-8 space-y-4">
          {filteredApplications.length === 0 ? (
            <EmptyState filter={filter === 'all' ? 'all' : filter} />
          ) : (
            filteredApplications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                viewMode="worker"
                showActions={false}
              />
            ))
          )}
        </div>
      )}
      
      {/* Call to Action */}
      {!isLoading && allApplications && allApplications.length > 0 && (
        <div className="mt-12 rounded-2xl border border-border bg-surface p-8 text-center">
          <h3 className="text-xl font-semibold">Keep Applying!</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse more job opportunities and increase your chances of getting hired.
          </p>
          <Button variant="hero" size="lg" className="mt-6" asChild>
            <Link to="/work">
              <Briefcase className="size-4" />
              Browse More Jobs
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Supporting Components ─────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  isActive: boolean;
  onClick: () => void;
}

function StatCard({ label, value, icon: Icon, color, isActive, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border bg-card p-4 text-left transition-all hover:shadow-md ${
        isActive ? 'border-primary/50 ring-2 ring-primary/20' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`size-5 ${color}`} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </button>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function TabButton({ active, onClick, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ filter }: { filter: string }) {
  const getMessage = () => {
    switch (filter) {
      case 'Pending':
        return 'You have no pending applications. All your applications have been reviewed.';
      case 'Confirmed':
        return 'No confirmed applications yet. Keep applying to jobs!';
      case 'Waitlisted':
        return 'No waitlisted applications. Employers may add you to their waitlist if positions fill up.';
      case 'NotSelected':
        return 'No rejected applications. Keep up the good work!';
      default:
        return 'You haven\'t applied to any jobs yet. Browse available jobs and start applying!';
    }
  };
  
  const getIcon = () => {
    switch (filter) {
      case 'Pending':
        return Clock;
      case 'Confirmed':
        return CheckCircle2;
      case 'Waitlisted':
        return Users;
      case 'NotSelected':
        return XCircle;
      default:
        return Briefcase;
    }
  };
  
  const Icon = getIcon();
  
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
      <Icon className="mx-auto size-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium">No Applications Found</h3>
      <p className="mt-2 text-sm text-muted-foreground">{getMessage()}</p>
      {filter === 'all' && (
        <Button variant="hero" size="lg" className="mt-6" asChild>
          <Link to="/work">
            <Briefcase className="size-4" />
            Browse Jobs
          </Link>
        </Button>
      )}
    </div>
  );
}

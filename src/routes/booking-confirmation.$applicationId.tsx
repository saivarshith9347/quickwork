import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  Phone,
  Share2,
  Wallet,
  Loader2,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useApplication } from "@/lib/hooks/use-applications";
import { useJob } from "@/lib/hooks/use-jobs";
import { useAuth } from "@/lib/auth-context";
import { formatLocation } from "@/lib/job-types";

export const Route = createFileRoute("/booking-confirmation/$applicationId")({
  head: () => ({
    meta: [
      { title: "Booking Confirmed — QuickWork" },
      {
        name: "description",
        content: "Your job application has been confirmed. View your booking details.",
      },
    ],
  }),
  component: BookingConfirmationPage,
});

// Mock job data (should match work.$jobId.tsx)
const mockJobs: Record<string, any> = {
  "1": {
    id: "1",
    jobTitle: "Banquet servers for wedding reception",
    venueName: "Grand Palm Banquets",
    employer: "Grand Palm Banquets",
    wage: 1200,
    wageDisplay: "₹1,200",
    date: "2026-09-10",
    startTime: "17:00",
    endTime: "23:00",
    location: "Plot 42, MIDC Road, Andheri East, Mumbai",
    area: "Andheri East",
    city: "Mumbai",
    reportingContact: {
      name: "Rajesh Kumar",
      phone: "+91 98765 43210",
    },
    isRapidJob: true,
  },
  "2": {
    id: "2",
    jobTitle: "Kitchen staff for catering event",
    venueName: "Commercial Kitchen Complex",
    employer: "Saffron Caterers",
    wage: 950,
    wageDisplay: "₹950",
    date: "2026-09-11",
    startTime: "09:00",
    endTime: "16:00",
    location: "Building 12, Hiranandani Business Park, Powai, Mumbai",
    area: "Powai",
    city: "Mumbai",
    reportingContact: {
      name: "Chef Priya Sharma",
      phone: "+91 98765 11111",
    },
    isRapidJob: false,
  },
};

function BookingConfirmationPage() {
  const { applicationId } = Route.useParams();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  
  // Fetch application using React Query
  const { data: application, isLoading: appLoading } = useApplication(applicationId);
  
  // Fetch job details if we have an application
  const { data: job, isLoading: jobLoading } = useJob(application?.jobId, {
    enabled: !!application?.jobId,
  });

  useEffect(() => {
    if (!isLoggedIn) {
      toast.error("Please log in to view booking confirmation");
      navigate({ to: "/work" });
      return;
    }

    if (!appLoading && !application) {
      toast.error("Booking confirmation not found");
      navigate({ to: "/work" });
      return;
    }

    if (application && application.status !== "BOOKED" && application.status !== "ACCEPTED") {
      toast.error("This application has not been confirmed yet");
      navigate({ to: "/my-applications" });
      return;
    }

    // Check if this application belongs to the logged-in user
    if (application && application.workerId !== user?.id) {
      toast.error("You don't have permission to view this booking");
      navigate({ to: "/work" });
      return;
    }
  }, [isLoggedIn, application, user, navigate, applicationId, appLoading]);

  if (appLoading || jobLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!application || !isLoggedIn || (application.status !== "BOOKED" && application.status !== "ACCEPTED")) {
    return null;
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 text-center lg:px-8">
        <h1 className="text-4xl">Job not found</h1>
        <p className="mt-4 text-muted-foreground">Unable to load job details.</p>
        <Button variant="hero" size="lg" className="mt-8" asChild>
          <Link to="/my-applications">
            <ArrowLeft /> Back to applications
          </Link>
        </Button>
      </div>
    );
  }

  // Extract location
  const location = typeof job.location === 'object' 
    ? job.location 
    : { venueName: formatLocation(job.location, 'short'), fullAddress: job.location };

  // Generate booking ID from application ID
  const bookingId = `BK${application.id.substring(0, 8).toUpperCase()}`;

  // Format dates
  const jobDate = new Date(job.date);
  const formattedDate = jobDate.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Format reporting time (30 minutes before shift start)
  const [startHours, startMinutes] = job.startTime.split(":").map(Number);
  const reportingDate = new Date(job.date);
  reportingDate.setHours(startHours || 0, (startMinutes || 0) - 30, 0, 0);
  const reportingTime = reportingDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const shiftStartTime = new Date(job.date);
  shiftStartTime.setHours(startHours ?? 0, startMinutes ?? 0, 0, 0);
  const formattedStartTime = shiftStartTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const [endHours, endMinutes] = job.endTime.split(":").map(Number);
  const shiftEndTime = new Date(job.date);
  shiftEndTime.setHours(endHours ?? 0, endMinutes ?? 0, 0, 0);
  const formattedEndTime = shiftEndTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleShare() {
    if (!job) return;
    const shareText = `Booking Confirmed!\n\nJob: ${job.jobTitle}\nDate: ${formattedDate}\nTime: ${formattedStartTime} - ${formattedEndTime}\nLocation: ${location.venueName}\nBooking ID: ${bookingId}`;

    if (navigator.share) {
      navigator
        .share({
          title: "QuickWork Booking Confirmation",
          text: shareText,
        })
        .then(() => toast.success("Shared successfully"))
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Booking details copied to clipboard");
    }
  }

  function handleDownload() {
    toast.success("Download feature coming soon!");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-success/5 via-background to-primary/5 py-8">
      <div className="mx-auto max-w-2xl px-5 lg:px-8">
        {/* Success Header */}
        <div className="text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success/10 text-success animate-in fade-in zoom-in duration-500">
            <CheckCircle2 className="size-10" strokeWidth={2.5} />
          </div>
          <h1 className="mt-6 text-3xl font-bold sm:text-4xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            Booking Confirmed!
          </h1>
          <p className="mt-3 text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Your application has been accepted. See you at the venue!
          </p>
        </div>

        {/* Booking ID Card */}
        <div className="mt-8 rounded-2xl border-2 border-success/40 bg-card p-6 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Booking ID</p>
              <p className="mt-1 font-mono text-2xl font-bold text-primary">{bookingId}</p>
            </div>
            <div className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
              <BadgeCheck className="size-8" />
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          {/* Job Title & Employer */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl font-bold">{job.jobTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Employer</p>
          </div>

          {/* Date & Time */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="size-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-muted-foreground">Date & Time</p>
                <p className="mt-1 font-semibold">{formattedDate}</p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  {formattedStartTime} – {formattedEndTime}
                </p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="size-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-muted-foreground">Location</p>
                <p className="mt-1 font-semibold">{location.venueName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{location.fullAddress}</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(location.fullAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <MapPin className="size-3.5" />
                  View on map
                </a>
              </div>
            </div>
          </div>

          {/* Wage */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start gap-4">
              <div
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${
                  job.isRapidJob
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <Wallet className="size-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-muted-foreground">Wage</p>
                <p
                  className={`mt-1 font-display text-3xl font-bold ${
                    job.isRapidJob
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-primary"
                  }`}
                >
                  ₹{job.wage.toLocaleString("en-IN")}
                </p>
                <p className="text-sm text-muted-foreground">per worker</p>
                {job.isRapidJob && (
                  <p className="mt-1 text-sm font-semibold text-orange-600 dark:text-orange-400">
                    +20% surge pricing included
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Important: Reporting Time */}
          <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Clock className="size-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold uppercase tracking-wide text-primary">
                  Important
                </p>
                <p className="mt-1 font-semibold">Report by {reportingTime}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Arrive 30 minutes before shift start for briefing and preparation
                </p>
              </div>
            </div>
          </div>

          {/* Reporting Contact */}
          {job.reportingContact && (
            <div className="rounded-2xl border border-success/40 bg-success/5 p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success/20 text-success">
                  <Phone className="size-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-success">Reporting Contact</p>
                  <p className="mt-1 font-semibold">{job.reportingContact.name}</p>
                  <a
                    href={`tel:${job.reportingContact.phone}`}
                    className="mt-1 inline-block text-sm font-semibold text-primary hover:underline"
                  >
                    {job.reportingContact.phone}
                  </a>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Call if you have any questions or need directions
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Employer Note (if provided) */}
          {application.employerNote && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="text-sm font-semibold text-muted-foreground">Message from Employer</p>
              <p className="mt-2 text-sm italic">"{application.employerNote}"</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
          <Button variant="outline" size="lg" onClick={handleShare} className="flex-1">
            <Share2 className="size-4" /> Share
          </Button>
          <Button variant="outline" size="lg" onClick={handleDownload} className="flex-1">
            <Download className="size-4" /> Download
          </Button>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
          <Button variant="hero" size="lg" asChild>
            <Link to="/my-applications">View all my applications</Link>
          </Button>
          <Button variant="ghost" size="lg" asChild>
            <Link to="/work">
              <ArrowLeft className="size-4" /> Browse more jobs
            </Link>
          </Button>
        </div>

        {/* Footer Note */}
        <div className="mt-8 rounded-xl border border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground animate-in fade-in duration-700 delay-700">
          <p>
            Save this booking ID: <span className="font-mono font-bold text-foreground">{bookingId}</span>
          </p>
          <p className="mt-1">
            You can view this confirmation anytime from{" "}
            <Link to="/my-applications" className="font-medium text-primary hover:underline">
              My Applications
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

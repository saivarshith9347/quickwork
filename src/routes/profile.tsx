import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Worker Profile — Rahul Mehta | QuickWork" },
      {
        name: "description",
        content:
          "View Rahul Mehta's verified worker profile on QuickWork: skill category, verification status, job history and employer ratings.",
      },
      { property: "og:title", content: "Worker Profile — Rahul Mehta | QuickWork" },
      {
        property: "og:description",
        content: "Verified banquet server with 128 completed shifts and a 4.9 star rating.",
      },
    ],
  }),
  component: ProfilePage,
});

type VerificationState = "locked" | "in-progress" | "earned";

const jobs: never[] = [];

const ratings: never[] = [];

function VerificationBadge({ state }: { state: VerificationState }) {
  if (state === "earned") {
    return (
      <span className="relative inline-flex animate-bounce-in items-center gap-1.5 rounded-lg border border-gold/45 bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold-foreground dark:text-gold">
        <span className="absolute inset-0 rounded-lg bg-gold/20 blur-md" />
        <span className="relative flex items-center gap-1.5">
          <BadgeCheck className="size-4" />
          Verified Professional
        </span>
      </span>
    );
  }

  if (state === "in-progress") {
    return (
      <span className="inline-flex animate-bounce-in items-center gap-1.5 rounded-lg border border-primary/45 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
        <TrendingUp className="size-4" />
        Verification in progress
      </span>
    );
  }

  return (
    <span className="inline-flex animate-bounce-in items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
      <Lock className="size-4" />
      Badge locked
    </span>
  );
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-4 ${i < score ? "fill-gold text-gold" : "text-muted-foreground/40"}`}
        />
      ))}
    </div>
  );
}

function ProfilePage() {
  const [verificationState, setVerificationState] = useState<VerificationState>("earned");

  const isVerified = verificationState === "earned";

  return (
    <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
      {/* Preview toggle */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-gold" />
          Preview badge state
        </div>
        <div className="flex rounded-xl border border-border bg-background p-1">
          {(
            [
              ["earned", "Earned"],
              ["in-progress", "In progress"],
              ["locked", "Locked"],
            ] as [VerificationState, string][]
          ).map(([state, label]) => (
            <button
              key={state}
              onClick={() => setVerificationState(state)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                verificationState === state
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Profile header */}
        <div className="lg:col-span-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-lift">
            <div className="absolute inset-x-0 top-0 h-32 bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] opacity-90" />
            <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-end">
              <div className="relative shrink-0">
                <div className="flex size-28 items-center justify-center rounded-2xl border-4 border-card bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] font-display text-3xl font-bold text-primary-foreground shadow-brand">
                  RM
                </div>
                {isVerified && (
                  <span className="absolute -right-2 -bottom-2 flex size-8 items-center justify-center rounded-full border-2 border-card bg-gold text-gold-foreground shadow-gold">
                    <CheckCircle2 className="size-4" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold">Rahul Mehta</h1>
                  <VerificationBadge state={verificationState} />
                </div>
                <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="size-4 text-primary" />
                  Banquet server · 3 years experience
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="size-4" /> Andheri East, Mumbai · 3.2 km from you
                </p>
              </div>
              <div className="flex w-full shrink-0 gap-2 lg:w-auto lg:flex-col">
                <Button variant="outline" size="lg" className="flex-1 lg:flex-initial">
                  Edit profile
                </Button>
                <Button variant="hero" size="lg" className="flex-1 lg:flex-initial" asChild>
                  <Link to="/work">
                    Find shifts <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Verification status card */}
        <div className="lg:col-span-4">
          <div
            className={`relative h-full overflow-hidden rounded-3xl border p-7 transition-colors ${
              isVerified
                ? "border-gold/40 bg-gold/8"
                : verificationState === "in-progress"
                  ? "border-primary/40 bg-primary/8"
                  : "border-border bg-card"
            }`}
          >
            {isVerified && (
              <div className="pointer-events-none absolute inset-0 opacity-40">
                <div className="absolute -right-12 -top-12 size-56 rounded-full bg-gold/30 blur-3xl" />
                <div className="absolute -bottom-12 -left-12 size-48 rounded-full bg-brand/15 blur-3xl" />
              </div>
            )}
            <div className="relative">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Verification</h2>
                <VerificationBadge state={verificationState} />
              </div>

              <div className="mt-6 space-y-4">
                {[
                  ["Government ID", isVerified],
                  ["Address proof", isVerified],
                  ["Skill assessment", verificationState !== "locked"],
                  ["Background check", verificationState === "earned"],
                ].map(([label, passed]) => {
                  const passedBool = passed as boolean;
                  return (
                    <div
                      key={label as string}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{label as string}</span>
                      {passedBool ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : (
                        <XCircle className="size-4 text-muted-foreground/50" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-7">
                {verificationState === "earned" ? (
                  <div className="rounded-2xl border border-gold/30 bg-gold/15 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-gold-foreground dark:text-gold">
                      <Sparkles className="size-4" /> Gold badge active
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Renews automatically in 42 days if punctuality stays above 90%.
                    </p>
                  </div>
                ) : verificationState === "in-progress" ? (
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                    <p className="text-sm font-semibold text-primary">Skill assessment pending</p>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
                      <div className="h-full w-2/3 rounded-full bg-primary" />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Complete your practical skill test to earn the badge.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-semibold text-foreground">
                      Get verified to earn more
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verified professionals get priority access and 30% higher bookings.
                    </p>
                    <Button variant="gold" size="lg" className="mt-4 w-full">
                      <UserCheck /> Start verification
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats - hidden until real data available */}
        <div className="lg:col-span-12">
          <div className="rounded-3xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Your profile statistics will appear here once you complete shifts and receive ratings.
            </p>
          </div>
        </div>

        {/* Job history - hidden until real data available */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-border bg-card p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Job history</h2>
            </div>
            <div className="mt-6">
              <p className="text-sm text-muted-foreground">
                Your completed jobs will appear here.
              </p>
            </div>
          </div>
        </div>

        {/* Ratings - hidden until ratings table exists */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-border bg-card p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Employer ratings</h2>
            </div>
            <div className="mt-6">
              <p className="text-sm text-muted-foreground">
                Employer ratings will appear here once the ratings system is implemented.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  CalendarDays,
  Check,
  CheckCircle2,
  MapPin,
  Send,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  Wallet,
  Users,
  ShowerHead,
  Zap,
  Clock,
  Briefcase,
  Wrench,
  Plus,
  X,
  FileText,
  AlertCircle,
  ListChecks,
  UserCheck,
  Star,
  BadgeCheck,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Utensils,
  Car,
  Package,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, useId } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  JobCategory,
  JobType,
  JOB_CATEGORY_LABELS,
  JOB_TYPE_LABELS,
  calculateDuration,
  calculateRapidJobExpiry,
} from "@/lib/job-types";
import { useAuth } from "@/lib/auth-context";
import { useCreateJob } from "@/lib/hooks/use-jobs";
import { useNavigate } from "@tanstack/react-router";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/post-job")({
  head: () => ({
    meta: [
      { title: "Post a Job — QuickWork" },
      {
        name: "description",
        content:
          "Post a job in 6 steps. Define work categories, set positions, and connect with verified workers near you.",
      },
      { property: "og:title", content: "Post a Job — QuickWork" },
      {
        property: "og:description",
        content: "A guided 6-step flow to publish your next job to verified daily-wage workers nearby.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostJobPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "basics", label: "Basics", short: "Job Details" },
  { id: "schedule", label: "Date & Time", short: "Schedule" },
  { id: "workforce", label: "Workforce", short: "Categories" },
  { id: "facilities", label: "Facilities", short: "Perks" },
  { id: "requirements", label: "Requirements", short: "Requirements" },
  { id: "review", label: "Review", short: "Review" },
] as const;

const TOTAL_STEPS = STEPS.length;

const JOB_CATEGORIES_LIST = Object.values(JobCategory);

const FACILITY_OPTIONS = [
  { label: "Meals provided", icon: UtensilsCrossed },
  { label: "Transport", icon: Bus },
  { label: "Uniform", icon: Shirt },
  { label: "Locker room", icon: ShowerHead },
  { label: "Accommodation", icon: Briefcase },
  { label: "Parking", icon: MapPin },
  { label: "Equipment", icon: Wrench },
  { label: "Water", icon: Sparkles },
] as const;

const CATEGORY_ICONS = ["🍽", "🍹", "🥗", "🧃", "🎪", "🎭", "🎵", "🛒", "🧹", "📦", "🚚", "👷", "💼", "🎯"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkCategory {
  id: string;
  name: string;
  description: string;
  requiredWorkers: number;
  wage: number;
  wageType: "per-shift" | "per-hour";
  requirements: string;
  icon: string;
}

type Form = {
  // Step 1: Basics
  title: string;
  description: string;
  category: string;
  businessType: string;
  jobType: string;
  isRapidJob: boolean;
  rapidJobHours: string;

  // Step 2: Schedule + Location
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  fullAddress: string;
  area: string;
  city: string;
  landmark: string;

  // Step 3: Work categories (the new dynamic builder)
  workCategories: WorkCategory[];
  categoryDraft: Omit<WorkCategory, "id">;

  // Step 4: Facilities
  facilities: string[];
  customFacility: string;

  // Step 5: Requirements
  experience: string;
  skills: string[];
  skillInput: string;
  dressCode: string;
  documentsRequired: string;
  languages: string;
  beforeArrivalItems: string[];
  beforeArrivalInput: string;
  duringShiftItems: string[];
  duringShiftInput: string;
  notes: string;
};

const blankCategory: Omit<WorkCategory, "id"> = {
  name: "",
  description: "",
  requiredWorkers: 1,
  wage: 1200,
  wageType: "per-shift",
  requirements: "",
  icon: "🍽",
};

const INITIAL_FORM: Form = {
  title: "",
  description: "",
  category: JOB_CATEGORIES_LIST[0]!,
  businessType: "",
  jobType: JobType.OneTime,
  isRapidJob: false,
  rapidJobHours: "2",

  date: "",
  startTime: "",
  endTime: "",
  venueName: "",
  fullAddress: "",
  area: "",
  city: "",
  landmark: "",

  workCategories: [],
  categoryDraft: { ...blankCategory },

  facilities: [],
  customFacility: "",

  experience: "",
  skills: [],
  skillInput: "",
  dressCode: "",
  documentsRequired: "",
  languages: "",
  beforeArrivalItems: [],
  beforeArrivalInput: "",
  duringShiftItems: [],
  duringShiftInput: "",
  notes: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function totalWorkers(cats: WorkCategory[]) {
  return cats.reduce((s, c) => s + c.requiredWorkers, 0);
}

function totalPayout(cats: WorkCategory[], startTime: string, endTime: string) {
  return cats.reduce((s, c) => {
    if (c.wageType === "per-hour" && startTime && endTime) {
      const hours = calculateDuration(startTime, endTime) / 60;
      return s + c.wage * c.requiredWorkers * hours;
    }
    return s + c.wage * c.requiredWorkers;
  }, 0);
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedCounter({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const diff = value - prev.current;
    const steps = Math.min(Math.abs(diff), 12);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(Math.round(prev.current + (diff * i) / steps));
      if (i >= steps) {
        clearInterval(interval);
        setDisplayed(value);
        prev.current = value;
      }
    }, 35);
    return () => clearInterval(interval);
  }, [value]);
  return <>{displayed}</>;
}

// ─── Category card ────────────────────────────────────────────────────────────

interface CategoryCardProps {
  cat: WorkCategory;
  index: number;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  startTime: string;
  endTime: string;
}

function CategoryCard({ cat, index, onEdit, onRemove, startTime, endTime }: CategoryCardProps) {
  const shiftHours = startTime && endTime ? calculateDuration(startTime, endTime) / 60 : null;
  const payout =
    cat.wageType === "per-hour" && shiftHours
      ? cat.wage * cat.requiredWorkers * shiftHours
      : cat.wage * cat.requiredWorkers;

  return (
    <article
      className="animate-bounce-in group relative overflow-hidden rounded-2xl border-2 border-border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-lift"
      style={{ animationDelay: `${index * 60}ms` }}
      aria-label={`Work category: ${cat.name}`}
    >
      {/* Subtle brand gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[image:linear-gradient(135deg,var(--brand)/0,var(--brand)/0)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:bg-[image:linear-gradient(135deg,oklch(0.6837_0.1848_44.94/4%),transparent)]" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl"
            aria-hidden="true"
          >
            {cat.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-base font-bold">{cat.name}</h4>
            {cat.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{cat.description}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">Workers needed</p>
            <p className="mt-0.5 text-2xl font-bold text-foreground">
              <AnimatedCounter value={cat.requiredWorkers} />
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">Wage</p>
            <p className="mt-0.5 text-lg font-bold text-primary">
              ₹{cat.wage.toLocaleString("en-IN")}
              <span className="text-xs font-normal text-muted-foreground">
                /{cat.wageType === "per-hour" ? "hr" : "shift"}
              </span>
            </p>
          </div>
        </div>

        {/* Payout estimate */}
        <div className="mt-3 rounded-xl border border-success/25 bg-success/5 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Estimated payout:{" "}
            <span className="font-semibold text-success">
              ₹{Math.round(payout).toLocaleString("en-IN")}
            </span>
            {cat.wageType === "per-hour" && shiftHours
              ? ` (${cat.requiredWorkers}w × ₹${cat.wage}/hr × ${shiftHours.toFixed(1)}h)`
              : ` (${cat.requiredWorkers}w × ₹${cat.wage})`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(cat.id)}
            id={`edit-category-${cat.id}`}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(cat.id)}
            aria-label={`Remove ${cat.name} category`}
            id={`remove-category-${cat.id}`}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

// ─── Category editor form ─────────────────────────────────────────────────────

interface CategoryEditorProps {
  draft: Omit<WorkCategory, "id">;
  onChange: (patch: Partial<Omit<WorkCategory, "id">>) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

function CategoryEditor({ draft, onChange, onSave, onCancel, isEditing }: CategoryEditorProps) {
  const nameId = useId();
  const descId = useId();
  const wageId = useId();

  const canSave = draft.name.trim().length >= 2 && draft.requiredWorkers >= 1 && draft.wage > 0;

  return (
    <div className="animate-step-in rounded-2xl border-2 border-primary/40 bg-primary/5 p-5">
      <h4 className="mb-4 flex items-center gap-2 font-semibold text-primary">
        <Users className="size-4" />
        {isEditing ? "Edit category" : "New work category"}
      </h4>

      <div className="grid gap-4">
        {/* Icon picker */}
        <div className="grid gap-2">
          <Label className="text-sm font-medium">Icon</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => onChange({ icon })}
                className={`h-10 w-10 rounded-xl border-2 text-xl transition-all duration-150 hover:scale-110 ${draft.icon === icon
                  ? "border-primary bg-primary/15 shadow-sm"
                  : "border-border hover:border-primary/50"
                  }`}
                aria-label={`Select icon ${icon}`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Category name */}
        <div className="grid gap-2">
          <Label htmlFor={nameId} className="text-sm font-medium">
            Category name <span className="text-destructive">*</span>
          </Label>
          <Input
            id={nameId}
            placeholder="e.g. Food Serving, Liquor Serving, Starters…"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-11"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="grid gap-2">
          <Label htmlFor={descId} className="text-sm font-medium">
            Description <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id={descId}
            placeholder="Brief role description for workers"
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="h-11"
          />
        </div>

        {/* Workers count + Wage side by side */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-sm font-medium">
              Workers needed <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 text-lg"
                onClick={() =>
                  onChange({ requiredWorkers: Math.max(1, draft.requiredWorkers - 1) })
                }
                disabled={draft.requiredWorkers <= 1}
                aria-label="Decrease worker count"
              >
                −
              </Button>
              <Input
                type="number"
                min={1}
                max={999}
                className="h-11 text-center text-xl font-bold"
                value={draft.requiredWorkers}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1 && v <= 999) onChange({ requiredWorkers: v });
                }}
                aria-label="Number of workers"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 text-lg"
                onClick={() =>
                  onChange({ requiredWorkers: Math.min(999, draft.requiredWorkers + 1) })
                }
                disabled={draft.requiredWorkers >= 999}
                aria-label="Increase worker count"
              >
                +
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={wageId} className="text-sm font-medium">
              Wage (₹) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                ₹
              </span>
              <Input
                id={wageId}
                type="number"
                min={1}
                step={50}
                placeholder="1200"
                value={draft.wage}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v > 0) onChange({ wage: v });
                }}
                className="h-11 pl-8 font-bold"
              />
            </div>
            {/* Wage type toggle */}
            <div className="flex rounded-lg border border-border bg-muted p-0.5">
              {(["per-shift", "per-hour"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange({ wageType: t })}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${draft.wageType === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {t === "per-shift" ? "Per Shift" : "Per Hour"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="grid gap-2">
          <Label className="text-sm font-medium">
            Role requirements <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            placeholder="e.g. Food handling experience, must be 18+"
            value={draft.requirements}
            onChange={(e) => onChange({ requirements: e.target.value })}
            className="h-11"
          />
        </div>

        {/* Save / Cancel */}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="hero"
            size="sm"
            onClick={onSave}
            disabled={!canSave}
            className="flex-1"
            id="save-category-btn"
          >
            <Check className="size-4" />
            {isEditing ? "Update category" : "Add category"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel} className="shrink-0">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function PostJobPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createJob = useCreateJob();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [form, setForm] = useState<Form>(INITIAL_FORM);
  const [published, setPublished] = useState(false);

  // Category editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const set = useCallback(
    <K extends keyof Form>(key: K, value: Form[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    [],
  );

  const today = new Date().toISOString().split("T")[0]!;

  // Auto-set date to today when rapid job is toggled on
  useEffect(() => {
    if (form.isRapidJob && form.date !== today) set("date", today);
  }, [form.isRapidJob, form.date, today, set]);

  // ── Category editor handlers ────────────────────────────────────────────────

  function openNewEditor() {
    setForm((f) => ({ ...f, categoryDraft: { ...blankCategory } }));
    setEditingId(null);
    setEditorOpen(true);
  }

  function openEditEditor(id: string) {
    const cat = form.workCategories.find((c) => c.id === id);
    if (!cat) return;
    setForm((f) => ({
      ...f,
      categoryDraft: {
        name: cat.name,
        description: cat.description,
        requiredWorkers: cat.requiredWorkers,
        wage: cat.wage,
        wageType: cat.wageType,
        requirements: cat.requirements,
        icon: cat.icon,
      },
    }));
    setEditingId(id);
    setEditorOpen(true);
  }

  function saveCategory() {
    const draft = form.categoryDraft;
    if (editingId) {
      // Update existing
      setForm((f) => ({
        ...f,
        workCategories: f.workCategories.map((c) =>
          c.id === editingId ? { ...draft, id: editingId } : c,
        ),
        categoryDraft: { ...blankCategory },
      }));
    } else {
      // Add new
      setForm((f) => ({
        ...f,
        workCategories: [...f.workCategories, { ...draft, id: genId() }],
        categoryDraft: { ...blankCategory },
      }));
    }
    setEditorOpen(false);
    setEditingId(null);
  }

  function removeCategory(id: string) {
    setForm((f) => ({
      ...f,
      workCategories: f.workCategories.filter((c) => c.id !== id),
    }));
    if (editingId === id) {
      setEditorOpen(false);
      setEditingId(null);
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  function getStepErrors(): string[] {
    const errors: string[] = [];
    if (step === 0) {
      if (form.title.trim().length < 3) errors.push("Job title must be at least 3 characters");
      if (!form.category) errors.push("Please select a job category");
      if (form.description.trim().length < 6) errors.push("Job description must be at least 6 characters");
    }
    if (step === 1) {
      if (form.venueName.trim().length < 2) errors.push("Venue name is required");
      if (form.area.trim().length < 2) errors.push("Area / locality is required");
      if (form.city.trim().length < 2) errors.push("City is required");
      if (!form.date) errors.push("Date is required");
      if (!form.startTime) errors.push("Start time is required");
      if (!form.endTime) errors.push("End time is required");
    }
    if (step === 2) {
      if (form.workCategories.length === 0)
        errors.push("Add at least one work category");
    }
    return errors;
  }

  const stepErrors = getStepErrors();

  const stepValid = [
    form.title.trim().length > 2 && !!form.category && form.description.trim().length > 5,
    form.venueName.trim().length > 1 &&
    form.area.trim().length > 1 &&
    form.city.trim().length > 1 &&
    !!form.date &&
    !!form.startTime &&
    !!form.endTime,
    form.workCategories.length > 0,
    true, // facilities optional
    true, // requirements optional
    true, // review
  ][step] ?? true;

  const go = useCallback(
    (next: number) => {
      setDir(next > step ? "fwd" : "back");
      setStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [step],
  );

  const progress = published ? 100 : ((step + 1) / TOTAL_STEPS) * 100;

  // ── Submit to Supabase ──────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!user?.id) {
      toast.error("Please log in to post a job");
      return;
    }

    try {
      const jobId = await createJob.mutateAsync({
        job: {
          employerId: user.id,
          jobTitle: form.title,
          category: form.category as any,
          description: form.description,
          location: {
            venueName: form.venueName,
            fullAddress: form.fullAddress,
            area: form.area,
            city: form.city,
            landmark: form.landmark || undefined,
          },
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          jobType: form.jobType as any,
          isRapidJob: form.isRapidJob,
          rapidJobExpiresAt: form.isRapidJob
            ? calculateRapidJobExpiry(parseInt(form.rapidJobHours))
            : undefined,
          facilities: form.facilities.length > 0 ? form.facilities : undefined,
          requirements: {
            experience: form.experience || undefined,
            skills: form.skills.length > 0 ? form.skills : undefined,
            dressCode: form.dressCode || undefined,
            documentsRequired: form.documentsRequired ? [form.documentsRequired] : undefined,
            languages: form.languages ? [form.languages] : undefined,
          },
          instructions: {
            beforeArrival: form.beforeArrivalItems.length > 0 ? form.beforeArrivalItems : undefined,
            duringShift: form.duringShiftItems.length > 0 ? form.duringShiftItems : undefined,
          },
        },
        categories: form.workCategories.map(cat => ({
          name: cat.name,
          description: cat.description || undefined,
          requiredWorkers: cat.requiredWorkers,
          wage: cat.wage,
          requirements: cat.requirements ? { notes: cat.requirements } : undefined,
        })),
      });

      toast.success("Job published!", {
        description: `${totalWorkers(form.workCategories)} positions across ${form.workCategories.length} categories are now live.`,
      });
      setPublished(true);
      
      // Navigate to the job after a short delay
      setTimeout(() => {
        navigate({ to: `/hire/${jobId}` });
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Failed to publish job", { description: msg });
    }
  }

  // ── Published success screen ────────────────────────────────────────────────

  if (published) {
    const workers = totalWorkers(form.workCategories);
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-24 text-center lg:px-8">
        <span className="relative flex size-24 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-gold/30" />
          <span className="absolute inset-0 rounded-full bg-gold/15" />
          <span className="animate-bounce-in flex size-20 items-center justify-center rounded-full bg-[image:linear-gradient(135deg,var(--gold),var(--brand))] shadow-gold">
            <Check className="size-10 text-gold-foreground" strokeWidth={3} />
          </span>
        </span>
        <h1 className="animate-rise mt-8 text-4xl sm:text-5xl">Job published!</h1>
        <p className="animate-rise mt-4 text-muted-foreground">
          <span className="font-semibold text-foreground">{form.title}</span> is live —{" "}
          {workers} position{workers !== 1 ? "s" : ""} across {form.workCategories.length} categor
          {form.workCategories.length !== 1 ? "ies" : "y"}. Verified workers near{" "}
          {form.area}, {form.city} are being notified.
        </p>

        {/* Category summary */}
        {form.workCategories.length > 0 && (
          <div className="animate-rise mt-8 w-full max-w-sm rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Workforce breakdown
            </h2>
            <ul className="space-y-2">
              {form.workCategories.map((cat) => (
                <li key={cat.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span className="font-medium">{cat.name}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {cat.requiredWorkers}×{" "}
                    <span className="font-semibold text-primary">₹{cat.wage.toLocaleString("en-IN")}</span>
                  </span>
                </li>
              ))}
              <li className="border-t border-border pt-2 font-bold">
                <span className="flex items-center gap-2">
                  <span>👥</span>
                  <span>Total</span>
                </span>
                <span className="text-primary">{workers} workers</span>
              </li>
            </ul>
          </div>
        )}

        <div className="animate-rise mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="hero" size="lg" asChild>
            <Link to="/hire">
              View dashboard <ArrowRight />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setForm(INITIAL_FORM);
              setStep(0);
              setPublished(false);
            }}
          >
            Post another job
          </Button>
        </div>
      </div>
    );
  }

  // ── Main wizard ─────────────────────────────────────────────────────────────

  const shiftDuration =
    form.startTime && form.endTime ? calculateDuration(form.startTime, form.endTime) : null;

  const workers = totalWorkers(form.workCategories);
  const payout = totalPayout(form.workCategories, form.startTime, form.endTime);

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
      {/* Page header */}
      <p className="text-sm font-semibold text-primary">Post a job</p>
      <h1 className="mt-1 text-4xl sm:text-5xl">Post a job</h1>
      <p className="mt-3 text-muted-foreground">
        Six quick steps. Verified workers get notified the moment you publish.
      </p>

      {/* Rapid Job Toggle */}
      <div
        className={`mt-8 overflow-hidden rounded-2xl border-2 transition-all duration-300 ${form.isRapidJob
          ? "border-orange-500 bg-gradient-to-br from-orange-500/10 to-orange-500/5 shadow-lg"
          : "border-border bg-muted/50"
          }`}
      >
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              role="switch"
              aria-checked={form.isRapidJob}
              onClick={() => set("isRapidJob", !form.isRapidJob)}
              className={`relative flex h-7 w-14 shrink-0 items-center rounded-full border-2 transition-all duration-200 ${form.isRapidJob ? "border-orange-500 bg-orange-500" : "border-border bg-muted"
                }`}
              id="rapid-job-toggle"
            >
              <span
                className={`block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.isRapidJob ? "translate-x-7" : "translate-x-0.5"
                  }`}
              />
            </button>

            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <Zap
                  className={`size-5 ${form.isRapidJob ? "fill-current text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-lg font-bold ${form.isRapidJob ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}
                >
                  Rapid Job
                </span>
                {form.isRapidJob && (
                  <span className="animate-pulse rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">
                    URGENT
                  </span>
                )}
              </div>
              <p
                className={`mt-1 text-sm ${form.isRapidJob ? "text-orange-600/80 dark:text-orange-400/80" : "text-muted-foreground"}`}
              >
                {form.isRapidJob
                  ? "Priority visibility · Auto-expires if not filled · Must start today"
                  : "Get priority visibility and urgent worker notifications"}
              </p>
            </div>

            {form.isRapidJob && (
              <div className="flex items-center gap-2 rounded-xl border-2 border-orange-500/50 bg-orange-500/10 p-1">
                {["1", "2"].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => set("rapidJobHours", h)}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${form.rapidJobHours === h
                      ? "bg-orange-500 text-white shadow-md"
                      : "text-orange-600 dark:text-orange-400 hover:bg-orange-500/20"
                      }`}
                  >
                    {h} hour{h === "1" ? "" : "s"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-9">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[image:linear-gradient(90deg,var(--brand),var(--gold))] shadow-brand transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Step dots */}
        <ol className="mt-4 flex gap-1 overflow-x-auto pb-1" aria-label="Form progress">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex flex-1 flex-col items-start gap-1.5 min-w-0">
              <div className="flex w-full items-center gap-1">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300 ${i < step
                    ? "border-success bg-success text-success-foreground"
                    : i === step
                      ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary/20"
                      : "border-border bg-background text-muted-foreground"
                    }`}
                >
                  {i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
              </div>
              <span
                className={`truncate text-xs font-medium leading-tight ${i === step ? "text-foreground" : "text-muted-foreground"
                  }`}
              >
                {s.short}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Form card */}
      <div
        className={`mt-8 overflow-hidden rounded-3xl border-2 bg-surface p-7 transition-all duration-300 lg:p-9 ${form.isRapidJob
          ? "border-orange-500/40 shadow-[0_0_30px_rgba(255,107,53,0.15)]"
          : "border-border"
          }`}
      >
        <div
          key={step}
          className={dir === "fwd" ? "animate-step-in" : "animate-step-in-back"}
        >
          {/* ═══════════════════ STEP 1 — BASICS ═══════════════════ */}
          {step === 0 && (
            <section className="grid gap-8" aria-label="Basic information">
              <div className="text-center">
                <h2 className="text-3xl">What job are you posting?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start with the basics — title, category, and a brief description.
                </p>
              </div>

              <div className="grid gap-6">
                {/* Job title */}
                <div className="grid gap-3">
                  <Label htmlFor="job-title" className="text-base font-semibold">
                    Job title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="job-title"
                    placeholder="e.g. Wedding Event Staff — Grand Sapphire Banquets"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    className="h-14 text-base"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Be specific — include the event type and role if applicable
                  </p>
                </div>

                {/* Job description */}
                <div className="grid gap-3">
                  <Label htmlFor="job-description" className="text-base font-semibold">
                    Job description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="job-description"
                    rows={4}
                    placeholder="Describe what workers will do, the environment, and any important context…"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    className="resize-none text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.description.length} characters · Clear descriptions attract the right workers
                  </p>
                </div>

                {/* Category */}
                <div className="grid gap-3">
                  <Label className="text-base font-semibold">
                    Job category <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {JOB_CATEGORIES_LIST.map((c) => {
                      const isSelected = form.category === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => set("category", c)}
                          aria-pressed={isSelected}
                          className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all duration-200 ${isSelected
                            ? "border-primary bg-primary/10 shadow-md"
                            : "border-border hover:border-primary/50 hover:shadow-sm"
                            }`}
                        >
                          <div className="relative z-10">
                            <p
                              className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}
                            >
                              {JOB_CATEGORY_LABELS[c as keyof typeof JOB_CATEGORY_LABELS]}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Business / event type + job type */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="business-type" className="font-medium">
                      Business / Event type{" "}
                      <span className="text-xs text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="business-type"
                      placeholder="e.g. Wedding, Corporate event, Warehouse"
                      value={form.businessType}
                      onChange={(e) => set("businessType", e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-medium">Job type</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(JobType).map((type) => (
                        <button
                          key={type}
                          type="button"
                          aria-pressed={form.jobType === type}
                          onClick={() => set("jobType", type)}
                          className={`rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-all duration-150 hover:scale-[1.02] ${form.jobType === type
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border hover:border-primary/50"
                            }`}
                        >
                          {JOB_TYPE_LABELS[type as keyof typeof JOB_TYPE_LABELS]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═══════════════════ STEP 2 — DATE, TIME & LOCATION ═══════════════════ */}
          {step === 1 && (
            <section className="grid gap-8" aria-label="Date, time and location">
              <div className="text-center">
                <h2 className="text-3xl">Where and when?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Where will workers report, and when does the shift start?
                </p>
              </div>

              <div className="grid gap-7">
                {/* Location */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Location</h3>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="venue-name" className="font-semibold">
                        Venue name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="venue-name"
                        placeholder="e.g. Grand Sapphire Banquet Hall"
                        value={form.venueName}
                        onChange={(e) => set("venueName", e.target.value)}
                        className="h-12 text-base"
                        autoFocus
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="area">
                          Area / Locality <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="area"
                          placeholder="e.g. Andheri East"
                          value={form.area}
                          onChange={(e) => set("area", e.target.value)}
                          className="h-11"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="city">
                          City <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="city"
                          placeholder="e.g. Mumbai"
                          value={form.city}
                          onChange={(e) => set("city", e.target.value)}
                          className="h-11"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="full-address">Street address</Label>
                      <Input
                        id="full-address"
                        placeholder="e.g. 123 Main Road, Near City Mall"
                        value={form.fullAddress}
                        onChange={(e) => set("fullAddress", e.target.value)}
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional — helps workers find the exact spot
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="landmark">Nearby landmark</Label>
                      <Input
                        id="landmark"
                        placeholder="e.g. Opposite Metro Station, Behind City Mall"
                        value={form.landmark}
                        onChange={(e) => set("landmark", e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Schedule */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Schedule</h3>
                  </div>

                  <div className="grid gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="date" className="font-semibold">
                        Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={form.date}
                        onChange={(e) => set("date", e.target.value)}
                        className="h-12 text-base"
                        min={today}
                        disabled={form.isRapidJob}
                      />
                      {form.isRapidJob && (
                        <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
                          <Zap className="size-4 text-orange-600 dark:text-orange-400" />
                          <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                            Rapid jobs must start today
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      {(["startTime", "endTime"] as const).map((field) => (
                        <div key={field} className="grid gap-2">
                          <Label htmlFor={field} className="font-semibold">
                            {field === "startTime" ? "Start time" : "End time"}{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              id={field}
                              type="time"
                              value={form[field]}
                              onChange={(e) => set(field, e.target.value)}
                              className="h-12 text-base"
                            />
                            <Clock className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>

                    {shiftDuration !== null && (
                      <div className="animate-bounce-in rounded-xl border border-primary/30 bg-primary/5 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                            <Clock className="size-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Shift duration</p>
                            <p className="text-xl font-bold text-primary">
                              {Math.floor(shiftDuration / 60)}h {shiftDuration % 60 > 0 ? `${shiftDuration % 60}m` : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═══════════════════ STEP 3 — WORK CATEGORIES ═══════════════════ */}
          {step === 2 && (
            <section className="grid gap-8" aria-label="Work categories">
              <div className="text-center">
                <h2 className="text-3xl">Build Your Workforce</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tell workers what roles are available and how many people you need.
                </p>
              </div>

              {/* Live totals bar */}
              {form.workCategories.length > 0 && (
                <div className="animate-bounce-in rounded-2xl border border-primary/30 bg-[image:linear-gradient(135deg,var(--brand)/8%,var(--gold)/5%)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Users className="size-6" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Total positions
                        </p>
                        <p className="text-3xl font-bold text-primary">
                          <AnimatedCounter value={workers} />
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Est. payout
                      </p>
                      <p className="text-2xl font-bold text-success">
                        ₹<AnimatedCounter value={Math.round(payout)} />
                      </p>
                      {shiftDuration && (
                        <p className="text-xs text-muted-foreground">
                          {form.workCategories.some((c) => c.wageType === "per-hour")
                            ? `incl. ${(shiftDuration / 60).toFixed(1)}h`
                            : "per shift"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Breakdown equation */}
                  {form.workCategories.length > 1 && (
                    <p className="mt-3 text-sm font-medium text-muted-foreground">
                      {form.workCategories.map((c) => c.requiredWorkers).join(" + ")} ={" "}
                      <span className="font-bold text-primary">{workers} workers</span>
                    </p>
                  )}
                </div>
              )}

              {/* Category cards grid */}
              {form.workCategories.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {form.workCategories.map((cat, i) => (
                    <CategoryCard
                      key={cat.id}
                      cat={cat}
                      index={i}
                      onEdit={openEditEditor}
                      onRemove={removeCategory}
                      startTime={form.startTime}
                      endTime={form.endTime}
                    />
                  ))}
                </div>
              )}

              {/* Category editor panel */}
              {editorOpen && (
                <CategoryEditor
                  draft={form.categoryDraft}
                  onChange={(patch) =>
                    setForm((f) => ({ ...f, categoryDraft: { ...f.categoryDraft, ...patch } }))
                  }
                  onSave={saveCategory}
                  onCancel={() => {
                    setEditorOpen(false);
                    setEditingId(null);
                  }}
                  isEditing={editingId !== null}
                />
              )}

              {/* Add category button */}
              {!editorOpen && (
                <button
                  type="button"
                  onClick={openNewEditor}
                  id="add-category-btn"
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 py-5 text-primary transition-all duration-200 hover:border-primary hover:bg-primary/10 hover:shadow-brand"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 transition-transform duration-200 group-hover:scale-110">
                    <Plus className="size-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Add Work Category</p>
                    <p className="text-xs text-primary/70">
                      {form.workCategories.length === 0
                        ? "e.g. Food Serving, Liquor Serving, Starters Serving…"
                        : `${form.workCategories.length} categor${form.workCategories.length !== 1 ? "ies" : "y"} added`}
                    </p>
                  </div>
                </button>
              )}

              {/* Empty state hint */}
              {form.workCategories.length === 0 && !editorOpen && (
                <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    💡 <strong>Tip:</strong> You can create multiple categories for the same job. For
                    example: Food Serving (5 workers), Liquor Serving (3 workers).
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ═══════════════════ STEP 4 — FACILITIES ═══════════════════ */}
          {step === 3 && (
            <section className="grid gap-8" aria-label="Facilities">
              <div className="text-center">
                <h2 className="text-3xl">What will you provide?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Facilities attract more workers and help them prepare.
                </p>
              </div>

              <div className="grid gap-5">
                {/* Preset facilities */}
                <div className="flex flex-wrap gap-2">
                  {FACILITY_OPTIONS.map(({ label, icon: Icon }) => {
                    const isSelected = form.facilities.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          set(
                            "facilities",
                            isSelected
                              ? form.facilities.filter((f) => f !== label)
                              : [...form.facilities, label],
                          )
                        }
                        className={`group flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] ${isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-md"
                          : "border-border bg-background hover:border-primary/50"
                          }`}
                      >
                        <Icon className="size-4" />
                        {label}
                        {isSelected && <Check className="size-4" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom facilities */}
                {form.facilities.filter(
                  (f) => !FACILITY_OPTIONS.some((o) => o.label === f),
                ).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.facilities
                        .filter((f) => !FACILITY_OPTIONS.some((o) => o.label === f))
                        .map((custom) => (
                          <div
                            key={custom}
                            className="flex items-center gap-2 rounded-full border-2 border-gold bg-gold/10 px-4 py-2.5 text-sm font-medium text-gold-foreground"
                          >
                            <Sparkles className="size-4" />
                            {custom}
                            <button
                              type="button"
                              onClick={() =>
                                set(
                                  "facilities",
                                  form.facilities.filter((f) => f !== custom),
                                )
                              }
                              className="rounded-full p-0.5 transition-colors hover:bg-gold/20"
                              aria-label={`Remove ${custom}`}
                            >
                              <X className="size-3.5" strokeWidth={3} />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                {/* Add custom */}
                <div className="grid gap-2">
                  <Label htmlFor="custom-facility" className="text-sm font-medium">
                    Add custom facility
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="custom-facility"
                      placeholder="e.g. Snacks, Break room, Medical kit…"
                      value={form.customFacility}
                      onChange={(e) => set("customFacility", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && form.customFacility.trim()) {
                          e.preventDefault();
                          const t = form.customFacility.trim();
                          if (!form.facilities.includes(t)) {
                            set("facilities", [...form.facilities, t]);
                            set("customFacility", "");
                          }
                        }
                      }}
                      className="h-11"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11 shrink-0"
                      disabled={!form.customFacility.trim()}
                      onClick={() => {
                        const t = form.customFacility.trim();
                        if (t && !form.facilities.includes(t)) {
                          set("facilities", [...form.facilities, t]);
                          set("customFacility", "");
                        }
                      }}
                      aria-label="Add custom facility"
                    >
                      <Plus className="size-5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Press Enter or click + to add · {form.facilities.length} selected
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ═══════════════════ STEP 5 — REQUIREMENTS ═══════════════════ */}
          {step === 4 && (
            <section className="grid gap-8" aria-label="Requirements">
              <div className="text-center">
                <h2 className="text-3xl">What should workers know?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Help workers know if they qualify. All fields are optional.
                </p>
              </div>

              <div className="grid gap-7">
                {/* Requirements */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Worker Requirements</h3>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="grid gap-5">
                      <div className="grid gap-2">
                        <Label htmlFor="experience">Experience level</Label>
                        <Input
                          id="experience"
                          placeholder="e.g. Entry level, 2+ years, Professional"
                          value={form.experience}
                          onChange={(e) => set("experience", e.target.value)}
                          className="h-11"
                        />
                      </div>

                      {/* Skills tag input */}
                      <div className="grid gap-3">
                        <Label>Required skills</Label>
                        {form.skills.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {form.skills.map((skill, i) => (
                              <div
                                key={`${skill}-${i}`}
                                className="flex items-center gap-2 rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                              >
                                {skill}
                                <button
                                  type="button"
                                  onClick={() =>
                                    set(
                                      "skills",
                                      form.skills.filter((_, idx) => idx !== i),
                                    )
                                  }
                                  className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                                  aria-label={`Remove skill ${skill}`}
                                >
                                  <X className="size-3.5" strokeWidth={3} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            id="skill-input"
                            placeholder="e.g. Food handling, Customer service…"
                            value={form.skillInput}
                            onChange={(e) => set("skillInput", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && form.skillInput.trim()) {
                                e.preventDefault();
                                const t = form.skillInput.trim();
                                if (!form.skills.includes(t)) {
                                  set("skills", [...form.skills, t]);
                                  set("skillInput", "");
                                }
                              }
                            }}
                            className="h-11"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11 shrink-0"
                            disabled={!form.skillInput.trim()}
                            onClick={() => {
                              const t = form.skillInput.trim();
                              if (t && !form.skills.includes(t)) {
                                set("skills", [...form.skills, t]);
                                set("skillInput", "");
                              }
                            }}
                          >
                            <Plus className="size-5" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Press Enter or + to add · {form.skills.length} skill{form.skills.length !== 1 ? "s" : ""} added
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor="dress-code">Dress code</Label>
                          <Input
                            id="dress-code"
                            placeholder="e.g. Formal black and white"
                            value={form.dressCode}
                            onChange={(e) => set("dressCode", e.target.value)}
                            className="h-11"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="languages">Languages</Label>
                          <Input
                            id="languages"
                            placeholder="e.g. Hindi, English, Marathi"
                            value={form.languages}
                            onChange={(e) => set("languages", e.target.value)}
                            className="h-11"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="documents">Documents needed</Label>
                        <Input
                          id="documents"
                          placeholder="e.g. Government ID, Bank details"
                          value={form.documentsRequired}
                          onChange={(e) => set("documentsRequired", e.target.value)}
                          className="h-11"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Instructions */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ListChecks className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold">Instructions for Workers</h3>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    {(
                      [
                        {
                          key: "beforeArrivalItems" as const,
                          inputKey: "beforeArrivalInput" as const,
                          label: "Before Arrival",
                          placeholder: "e.g. Report 15 minutes early",
                        },
                        {
                          key: "duringShiftItems" as const,
                          inputKey: "duringShiftInput" as const,
                          label: "During Shift",
                          placeholder: "e.g. Follow supervisor's directions",
                        },
                      ] as const
                    ).map(({ key, inputKey, label, placeholder }) => (
                      <div key={key} className="rounded-2xl border border-border bg-card p-5">
                        <h4 className="mb-3 font-semibold">{label}</h4>
                        {form[key].length > 0 && (
                          <ul className="mb-3 space-y-2">
                            {form[key].map((item, i) => (
                              <li
                                key={i}
                                className="group flex items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-sm"
                              >
                                <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={3} />
                                <span className="flex-1">{item}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    set(
                                      key,
                                      (form[key] as string[]).filter((_, idx) => idx !== i),
                                    )
                                  }
                                  className="rounded-full p-1 opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                                  aria-label="Remove instruction"
                                >
                                  <X className="size-3.5" strokeWidth={3} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="grid gap-2">
                          <Input
                            placeholder={placeholder}
                            value={form[inputKey]}
                            onChange={(e) => set(inputKey, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && form[inputKey].trim()) {
                                e.preventDefault();
                                set(key, [...(form[key] as string[]), form[inputKey].trim()]);
                                set(inputKey, "");
                              }
                            }}
                            className="h-10"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!form[inputKey].trim()}
                            onClick={() => {
                              if (form[inputKey].trim()) {
                                set(key, [...(form[key] as string[]), form[inputKey].trim()]);
                                set(inputKey, "");
                              }
                            }}
                            className="w-full"
                          >
                            <Plus className="size-4" /> Add instruction
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional notes */}
                <div className="grid gap-2">
                  <Label htmlFor="notes" className="font-semibold">
                    Additional notes{" "}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Any other important information for workers…"
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    className="resize-none"
                  />
                </div>
              </div>
            </section>
          )}

          {/* ═══════════════════ STEP 6 — REVIEW ═══════════════════ */}
          {step === 5 && (
            <section className="grid gap-8" aria-label="Review and publish">
              <div className="text-center">
                <h2 className="text-3xl">Review &amp; Publish</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Here's how your job will appear to workers.
                </p>
              </div>

              {/* Live preview card */}
              <div className="mx-auto w-full max-w-md">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Live preview
                </p>

                <article
                  className={`flex flex-col rounded-2xl border p-6 shadow-md ${form.isRapidJob
                    ? "border-orange-500/40 bg-gradient-to-br from-orange-500/5 to-card"
                    : "border-border bg-card"
                    }`}
                >
                  {form.isRapidJob && (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex animate-pulse items-center gap-1.5 rounded-lg border border-orange-500 bg-orange-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                        <Zap className="size-3 fill-current" />
                        Urgent · Expires in {form.rapidJobHours}h
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{form.title || "Your Job Title"}</h3>
                      <span className="mt-1 inline-block rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {JOB_CATEGORY_LABELS[form.category as keyof typeof JOB_CATEGORY_LABELS]}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-sm font-semibold">
                      <Star className="size-3.5 fill-gold text-gold" />
                      4.8
                    </span>
                  </div>

                  {/* Categories summary in preview */}
                  {form.workCategories.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      {form.workCategories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2">
                            <span>{cat.icon}</span>
                            <span className="font-medium">{cat.name}</span>
                            <span className="text-muted-foreground">×{cat.requiredWorkers}</span>
                          </span>
                          <span className="font-semibold text-primary">
                            ₹{cat.wage.toLocaleString("en-IN")}
                            <span className="text-xs font-normal text-muted-foreground">
                              /{cat.wageType === "per-hour" ? "hr" : "shift"}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4 shrink-0" />
                    {form.date
                      ? new Date(form.date + "T00:00").toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })
                      : "Date TBD"}{" "}
                    · {form.startTime || "??"} – {form.endTime || "??"}
                    {shiftDuration ? ` · ${Math.floor(shiftDuration / 60)}h` : ""}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0" />
                    {form.venueName || "Venue"}, {form.area || "Area"}, {form.city || "City"}
                  </p>

                  {form.facilities.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {form.facilities.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
                        >
                          <CheckCircle2 className="size-3" />
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </div>

              {/* Summary detail panel */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <FileText className="size-5 text-primary" />
                  Workforce Summary
                </h3>

                {/* Category breakdown */}
                <div className="mt-5 space-y-3">
                  {form.workCategories.map((cat) => {
                    const catPayout =
                      cat.wageType === "per-hour" && shiftDuration
                        ? cat.wage * cat.requiredWorkers * (shiftDuration / 60)
                        : cat.wage * cat.requiredWorkers;
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{cat.icon}</span>
                          <div>
                            <p className="font-semibold">{cat.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {cat.requiredWorkers} worker{cat.requiredWorkers !== 1 ? "s" : ""} ×
                              ₹{cat.wage.toLocaleString("en-IN")}/{cat.wageType === "per-hour" ? "hr" : "shift"}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-primary">
                          ₹{Math.round(catPayout).toLocaleString("en-IN")}
                        </p>
                      </div>
                    );
                  })}

                  {/* Total row */}
                  <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-success/15">
                        <Users className="size-5 text-success" />
                      </div>
                      <div>
                        <p className="font-bold">Total</p>
                        <p className="text-xs text-muted-foreground">
                          {form.workCategories.map((c) => c.requiredWorkers).join(" + ")} = <strong>{workers}</strong> workers
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-success">
                      ₹{Math.round(payout).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Other details */}
                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Location
                    </dt>
                    <dd className="mt-1 text-sm font-medium">{form.venueName || "Not set"}</dd>
                    <dd className="text-sm text-muted-foreground">
                      {form.fullAddress || form.area}, {form.city}
                    </dd>
                    {form.landmark && (
                      <dd className="text-xs text-muted-foreground">Near {form.landmark}</dd>
                    )}
                  </div>
                  {form.experience && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Experience
                      </dt>
                      <dd className="mt-1 text-sm">{form.experience}</dd>
                    </div>
                  )}
                  {form.dressCode && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Dress Code
                      </dt>
                      <dd className="mt-1 text-sm">{form.dressCode}</dd>
                    </div>
                  )}
                </dl>

                {(form.skills.length > 0 || form.beforeArrivalItems.length > 0 || form.duringShiftItems.length > 0) && (
                  <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                    {form.skills.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Skills required
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {form.skills.map((s) => (
                            <span
                              key={s}
                              className="rounded-lg border border-border bg-muted px-2.5 py-0.5 text-xs"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {form.beforeArrivalItems.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Before arrival
                        </p>
                        <ul className="mt-2 space-y-1">
                          {form.beforeArrivalItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={3} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Publish info banner */}
              <div
                className={`rounded-2xl border p-5 ${form.isRapidJob
                  ? "border-orange-500/30 bg-orange-500/5"
                  : "border-primary/20 bg-primary/5"
                  }`}
              >
                <div className="flex items-start gap-3">
                  {form.isRapidJob ? (
                    <Zap className="size-5 shrink-0 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <Sparkles className="size-5 shrink-0 text-primary" />
                  )}
                  <div>
                    <p
                      className={`font-medium ${form.isRapidJob ? "text-orange-600 dark:text-orange-400" : "text-primary"}`}
                    >
                      {form.isRapidJob ? "Urgent Job — Priority Notifications" : "Ready to publish"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {form.isRapidJob
                        ? `All verified workers within 5 km will get instant push notifications. Job expires in ${form.rapidJobHours} hour${form.rapidJobHours !== "1" ? "s" : ""} if not filled.`
                        : "Verified workers within 5 km will get an instant notification when you publish."}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Validation errors */}
        {!stepValid && stepErrors.length > 0 && (
          <div className="mt-6 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Please fix the following:</p>
                <ul className="mt-2 space-y-1 text-sm text-destructive/90">
                  {stepErrors.map((err, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5">•</span>
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-9 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => go(step - 1)}
            disabled={step === 0}
            id="prev-step-btn"
          >
            <ArrowLeft /> Back
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button
              type="button"
              variant="hero"
              size="lg"
              disabled={!stepValid}
              onClick={() => go(step + 1)}
              id="next-step-btn"
            >
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button
              type="button"
              variant="hero"
              size="lg"
              disabled={!stepValid || createJob.isPending}
              onClick={handleSubmit}
              id="publish-job-btn"
              className={form.isRapidJob ? "urgent-button" : ""}
            >
              {createJob.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  {form.isRapidJob ? "Publish Rapid Job" : "Publish job"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera, Loader2, MapPin, User, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/complete-profile")({
  head: () => ({
    meta: [
      { title: "Set Up Your Profile — QuickWork" },
      {
        name: "description",
        content: "Tell us a bit about yourself to get started on QuickWork.",
      },
    ],
  }),
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const { user, completeProfile, clearPendingAction } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
    } else if (user.profileComplete) {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  if (!user || user.profileComplete) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      toast.error("Please fill in your name and location.");
      return;
    }

    setLoading(true);
    try {
      await completeProfile({ name: name.trim(), location: location.trim() });
      toast.success("Profile set up! Welcome to QuickWork.");
      clearPendingAction();
      setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 600);
    } catch {
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-14 lg:px-8">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] shadow-brand">
          <Zap className="size-6 text-primary-foreground" />
        </span>
        <span className="font-display text-xl font-bold tracking-tight">QuickWork</span>
      </div>

      {/* Heading */}
      <div className="mt-10">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Set up your profile</h1>
        <p className="mt-3 text-muted-foreground">
          Just a few quick details. You can post jobs and find work from the same account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        {/* Photo */}
        <div className="grid gap-2">
          <Label htmlFor="photo">
            Profile photo <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex items-center gap-4">
            <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="size-full object-cover" />
              ) : (
                <Camera className="size-7 text-muted-foreground" />
              )}
            </div>
            <div>
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("photo")?.click()}
              >
                <Camera className="size-4" />
                Upload photo
              </Button>
              <p className="mt-1.5 text-xs text-muted-foreground">PNG, JPG up to 5 MB</p>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="grid gap-2">
          <Label htmlFor="name">
            Full name <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10"
              autoFocus
              required
            />
          </div>
        </div>

        {/* Location */}
        <div className="grid gap-2">
          <Label htmlFor="location">
            Location <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="location"
              placeholder="e.g. Andheri East, Mumbai"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-10"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Used to show nearby jobs and match your posts with local workers.
          </p>
        </div>

        {/* What you can do — reassurance block */}
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-semibold">With one account you can:</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                ✓
              </span>
              Browse and apply for shifts near you
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                ✓
              </span>
              Post a job and hire verified workers
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                ✓
              </span>
              Switch between hiring and working any time
            </li>
          </ul>
        </div>

        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="w-full"
          disabled={loading || !name.trim() || !location.trim()}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Get started →"}
        </Button>
      </form>
    </div>
  );
}

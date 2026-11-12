/**
 * Login modal — Phone+OTP, Google OAuth, Email+OTP.
 * No upfront role choice. After auth, checks user.profileComplete:
 * - false → navigate to /complete-profile
 * - true  → close modal and resume pendingAction
 */
import { Check, Loader2, Mail, Phone, Zap } from "lucide-react";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMethod = "phone" | "google" | "email";
type Step = "method" | "otp";

// ─── Google Icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// ─── OTP Input ────────────────────────────────────────────────────────────────

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useMemo(
    () => Array.from({ length: 6 }, () => React.createRef<HTMLInputElement>()),
    [],
  );

  function handleChange(i: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = value.split("");
    next[i] = digit;
    const updated = next.join("").padEnd(6, "").slice(0, 6);
    onChange(updated);
    if (digit && i < 5) refs[i + 1]?.current?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      refs[i - 1]?.current?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, "").slice(0, 6));
      refs[Math.min(pasted.length, 5)]?.current?.focus();
      e.preventDefault();
    }
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            "h-12 w-full rounded-xl border border-border bg-background text-center text-lg font-semibold transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
            value[i] && "border-primary bg-primary/5",
          )}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function LoginModal() {
  const {
    loginModalOpen,
    closeLoginModal,
    pendingAction,
    loginWithPhone,
    loginWithGoogle,
    loginWithEmail,
    sendPhoneOTP,
    sendEmailOTP,
  } = useAuth();

  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<AuthMethod | null>(null);

  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (loginModalOpen) {
      setStep("method");
      setMethod(null);
      setPhoneInput("");
      setEmailInput("");
      setOtpInput("");
      setOtpSent(false);
      setError(null);
      setLoading(false);
    }
  }, [loginModalOpen]);

  // Close on Escape
  useEffect(() => {
    if (!loginModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLoginModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loginModalOpen, closeLoginModal]);

  if (!loginModalOpen) return null;

  const pendingLabel: Record<string, string> = {
    "book-shift": "Log in to book this shift",
    "post-shift": "Log in to post a shift",
    message: "Log in to send a message",
    dashboard: "Log in to your account",
  };

  const headline =
    pendingAction?.type && pendingLabel[pendingAction.type]
      ? pendingLabel[pendingAction.type]
      : "Welcome to QuickWork";

  // ── Send OTP ──────────────────────────────────────────────────────────────
  async function handleSendOTP() {
    setError(null);
    setLoading(true);
    try {
      if (method === "phone") {
        if (!phoneInput || phoneInput.length < 10) {
          setError("Please enter a valid phone number.");
          setLoading(false);
          return;
        }
        await sendPhoneOTP(phoneInput);
        setOtpSent(true);
        setStep("otp");
      } else if (method === "email") {
        if (!emailInput || !emailInput.includes("@")) {
          setError("Please enter a valid email address.");
          setLoading(false);
          return;
        }
        await sendEmailOTP(emailInput);
        setOtpSent(true);
        setStep("otp");
      }
    } catch {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Verify OTP & complete auth ────────────────────────────────────────────
  async function handleVerifyOTP() {
    setError(null);
    setLoading(true);
    try {
      let user;
      if (method === "phone") {
        user = await loginWithPhone(phoneInput, otpInput);
      } else if (method === "email") {
        user = await loginWithEmail(emailInput, otpInput);
      }
      if (user) {
        if (!user.profileComplete) {
          navigate({ to: "/complete-profile" });
        }
      }
    } catch {
      setError("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      if (!user.profileComplete) {
        navigate({ to: "/complete-profile" });
      }
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm animate-rise"
        aria-hidden="true"
        onClick={closeLoginModal}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 animate-bounce-in rounded-3xl border border-border bg-card p-8 shadow-lift sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] shadow-brand">
            <Zap className="size-5 text-primary-foreground" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">QuickWork</span>
        </div>

        <h2 id="login-modal-title" className="mt-5 font-display text-2xl font-bold">
          {headline}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === "method"
            ? "Post jobs or find work — one account does both."
            : "Enter the code we sent you."}
        </p>

        {/* ── Step: Method selection ── */}
        {step === "method" && (
          <div className="mt-6 space-y-3">
            {/* Phone */}
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 border-border hover:border-primary"
              onClick={() => {
                setMethod("phone");
                setStep("otp");
              }}
            >
              <Phone className="size-5 text-primary" />
              Continue with Phone
            </Button>

            {/* Google */}
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 border-border hover:border-primary"
              onClick={handleGoogle}
              disabled={loading}
            >
              {loading && method === null ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </Button>

            {/* Email */}
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 border-border hover:border-primary"
              onClick={() => {
                setMethod("email");
                setStep("otp");
              }}
            >
              <Mail className="size-5 text-primary" />
              Continue with Email
            </Button>

            <p className="pt-2 text-center text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <a href="#" className="underline underline-offset-2 hover:text-foreground">
                Terms
              </a>{" "}
              &{" "}
              <a href="#" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        )}

        {/* ── Step: Phone input (before OTP sent) ── */}
        {step === "otp" && method === "phone" && !otpSent && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Mobile number</Label>
              <div className="flex gap-2">
                <span className="flex h-11 items-center rounded-xl border border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
                  +91
                </span>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="h-11"
                  autoFocus
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              variant="hero"
              size="lg"
              className="w-full"
              onClick={handleSendOTP}
              disabled={loading || phoneInput.length < 10}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Send OTP"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep("method");
                setMethod(null);
                setError(null);
              }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Step: Email input (before OTP sent) ── */}
        {step === "otp" && method === "email" && !otpSent && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="h-11"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              variant="hero"
              size="lg"
              className="w-full"
              onClick={handleSendOTP}
              disabled={loading || !emailInput.includes("@")}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Send OTP"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep("method");
                setMethod(null);
                setError(null);
              }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
          </div>
        )}

        {/* ── Step: OTP entry ── */}
        {step === "otp" && otpSent && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-foreground">
                {method === "phone" ? `+91 ${phoneInput}` : emailInput}
              </span>
            </p>

            <OtpInput value={otpInput} onChange={setOtpInput} />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              variant="hero"
              size="lg"
              className="w-full"
              onClick={handleVerifyOTP}
              disabled={loading || otpInput.replace(/\s/g, "").length < 6}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Check className="size-4" /> Verify & continue
                </>
              )}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setOtpInput("");
                  setError(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Change {method === "phone" ? "number" : "email"}
              </button>
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading}
                className="font-semibold text-primary hover:underline disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

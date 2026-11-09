import { Link, useRouter } from "@tanstack/react-router";
import {
  Bell,
  BriefcaseBusiness,
  ClipboardList,
  LogOut,
  Menu,
  Search,
  User,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { getAvatarDisplay } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";

// ─── Search bar ───────────────────────────────────────────────────────────────

function SearchBar({ className }: { className?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={cn(
        "relative flex items-center transition-all duration-200",
        focused ? "w-64" : "w-44",
        className,
      )}
    >
      <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
      <input
        type="search"
        placeholder="Search shifts, roles…"
        aria-label="Search shifts and roles"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="h-9 w-full rounded-xl border border-border bg-background/70 pl-9 pr-3.5 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur-sm transition-all duration-200 focus:border-primary/60 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      />
    </div>
  );
}

// ─── Avatar + notification button (logged-in state) ───────────────────────────

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative flex items-center gap-2" ref={ref}>
      {/* Notifications bell */}
      <button
        type="button"
        aria-label="Notifications"
        className="relative flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all duration-200 hover:border-primary hover:text-primary hover:scale-[1.03]"
      >
        <Bell className="size-4" />
        {/* Unread dot */}
        <span
          className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary"
          aria-hidden="true"
        />
      </button>

      {/* Avatar */}
      <button
        type="button"
        aria-label="Open profile menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-lg bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] font-display text-sm font-bold text-primary-foreground shadow-brand transition-all duration-200 hover:scale-[1.03] hover:shadow-brand-lg"
      >
        {getAvatarDisplay(user.avatar, user.name)}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 animate-rise rounded-2xl border border-border bg-card p-2 shadow-lift">
          <div className="px-3 py-2">
            <p className="font-semibold text-sm truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email ?? user.phone}</p>
          </div>
          <div className="my-1.5 h-px bg-border" />
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <User className="size-4" /> My profile
          </Link>
          <Link
            to="/my-applications"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ClipboardList className="size-4" /> My Applications
          </Link>
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <BriefcaseBusiness className="size-4" /> Dashboard
          </Link>
          <div className="my-1.5 h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export function Navbar() {
  const { isLoggedIn, openLoginModal } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    return router.subscribe("onBeforeLoad", () => setMobileOpen(false));
  }, [router]);

  function handlePostJob(e: React.MouseEvent) {
    if (!isLoggedIn) {
      e.preventDefault();
      openLoginModal({ type: "post-shift" });
    }
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-200",
          scrolled
            ? "border-b border-border bg-background/80 backdrop-blur-xl shadow-lift"
            : "border-b border-transparent",
        )}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5 lg:px-8">
          {/* ── Logo ── */}
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="QuickWork home">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] shadow-brand">
              <Zap className="size-5 text-primary-foreground" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight hidden sm:block">
              QuickWork
            </span>
          </Link>

          {/* ── Center nav (desktop) ── */}
          <ul className="hidden flex-1 items-center justify-center gap-1 md:flex">
            <li>
              <Link
                to="/work"
                activeProps={{ className: "bg-accent text-primary" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 hover:text-primary"
              >
                Find Work
              </Link>
            </li>
            <li>
              <Link
                to="/hire"
                activeProps={{ className: "bg-accent text-primary" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 hover:text-primary"
                onClick={(e) => {
                  if (!isLoggedIn) {
                    e.preventDefault();
                    openLoginModal({ type: "post-shift" });
                  }
                }}
              >
                Post a Job
              </Link>
            </li>
            {isLoggedIn && (
              <li>
                <Link
                  to="/dashboard"
                  activeProps={{ className: "bg-accent text-primary" }}
                  inactiveProps={{ className: "text-muted-foreground" }}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 hover:text-primary"
                >
                  Dashboard
                </Link>
              </li>
            )}
          </ul>

          {/* ── Right cluster ── */}
          <div className="ml-auto flex items-center gap-2">
            {/* Search — hidden on small mobile, visible from sm */}
            <SearchBar className="hidden sm:flex" />

            <ThemeToggle />

            {isLoggedIn ? (
              <UserMenu />
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => openLoginModal()}
                >
                  Log in
                </Button>
                <Button
                  variant="hero"
                  size="sm"
                  onClick={() => openLoginModal({ type: "dashboard" })}
                >
                  Sign up
                </Button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border transition-colors hover:border-primary md:hidden"
            >
              {mobileOpen ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
            </button>
          </div>
        </nav>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="border-t border-border bg-background/95 px-5 py-3 backdrop-blur-xl md:hidden">
            {/* Mobile search */}
            <div className="mb-3">
              <SearchBar className="w-full" />
            </div>
            <ul className="flex flex-col">
              <li>
                <Link
                  to="/work"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-3 text-sm font-medium"
                >
                  Find Work
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={(e) => {
                    setMobileOpen(false);
                    if (!isLoggedIn) {
                      openLoginModal({ type: "post-shift" });
                    } else {
                      router.navigate({ to: "/hire" });
                    }
                  }}
                  className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium"
                >
                  Post a Job
                </button>
              </li>
              {isLoggedIn && (
                <>
                  <li>
                    <Link
                      to="/my-applications"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg px-3 py-3 text-sm font-medium"
                    >
                      My Applications
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg px-3 py-3 text-sm font-medium"
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg px-3 py-3 text-sm font-medium"
                    >
                      Profile
                    </Link>
                  </li>
                </>
              )}
            </ul>
            {!isLoggedIn && (
              <div className="mt-2 flex gap-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setMobileOpen(false);
                    openLoginModal();
                  }}
                >
                  Log in
                </Button>
                <Button
                  variant="hero"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setMobileOpen(false);
                    openLoginModal({ type: "dashboard" });
                  }}
                >
                  Sign up
                </Button>
              </div>
            )}
          </div>
        )}
      </header>
    </>
  );
}

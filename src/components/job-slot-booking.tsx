/**
 * Component for booking slots with the transaction‑safe model.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Check, Lock, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useBookingTransaction, type Slot } from "@/lib/booking-model";

// ─── Slot Status Badge ───────────────────────────────────────────────────────

function SlotStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    available: {
      label: 'Available',
      color: 'bg-success/15 text-success border-success/30',
      icon: <Check className="size-3" />,
    },
    locked: {
      label: 'Locked',
      color: 'bg-warning/15 text-warning border-warning/30',
      icon: <Lock className="size-3" />,
    },
    booked: {
      label: 'Booked',
      color: 'bg-destructive/15 text-destructive border-destructive/30',
      icon: <User className="size-3" />,
    },
    expired: {
      label: 'Expired',
      color: 'bg-muted text-muted-foreground border-muted',
      icon: <X className="size-3" />,
    },
  };

  const cfg = config[status] ?? config['available']!;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Slot Booking Component ─────────────────────────────────────────────────

interface JobSlotBookingProps {
  /** Job ID */
  jobId: string;
  /** Job title */
  jobTitle: string;
  /** Category ID */
  categoryId: string;
  /** Category name */
  categoryName: string;
  /** Wage per shift */
  wage: number;
  /** All slots in this category */
  slots: Slot[];
  /** Callback when booking succeeds */
  onBookingSuccess?: (slotId: string) => void;
}

export function JobSlotBooking({
  jobId,
  jobTitle,
  categoryId,
  categoryName,
  wage,
  slots,
  onBookingSuccess,
}: JobSlotBookingProps) {
  const { user, isLoggedIn, openLoginModal } = useAuth();
  const { attemptBooking, isSlotBookable } = useBookingTransaction();
  
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  async function handleBookSlot(slotId: string) {
    if (!isLoggedIn || !user) {
      // Gate: open login modal with pending action
      openLoginModal({ 
        type: "book-shift", 
        payload: { jobId, slotId, categoryId } 
      });
      return;
    }

    setBookingSlotId(slotId);
    setBookingInProgress(true);

    const result = await attemptBooking(slotId, user.id);

    if (result.success) {
      toast.success(`Booked slot for ${categoryName} at ${jobTitle}`);
      onBookingSuccess?.(slotId);
    } else {
      const errorMessage = result.error || 'Booking failed. Please try again.';
      toast.error(errorMessage);
    }

    setBookingInProgress(false);
    setBookingSlotId(null);
  }

  const availableSlots = slots.filter(s => s.status === 'available');
  const bookedSlots = slots.filter(s => s.status === 'booked');
  const lockedSlots = slots.filter(s => s.status === 'locked');

  return (
    <div className="rounded-xl border border-border p-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">{categoryName}</h4>
          <p className="text-sm text-muted-foreground">
            ₹{wage} / shift • {slots.length} total slots • {availableSlots.length} available
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <div className="flex gap-1">
            {availableSlots.length > 0 && <SlotStatusBadge status="available" />}
            {lockedSlots.length > 0 && <SlotStatusBadge status="locked" />}
            {bookedSlots.length > 0 && <SlotStatusBadge status="booked" />}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {slots.map(slot => {
          const bookable = isSlotBookable(slot.id);
          const isSelected = bookingSlotId === slot.id;
          
          return (
            <div
              key={slot.id}
              className={`rounded-lg border p-3 transition-all duration-200 ${
                slot.status === 'booked'
                  ? 'border-destructive/30 bg-destructive/5'
                  : slot.status === 'locked'
                  ? 'border-warning/30 bg-warning/5'
                  : slot.status === 'available'
                  ? 'border-success/30 bg-success/5 hover:border-success/50 hover:bg-success/10'
                  : 'border-muted bg-muted'
              } ${isSelected ? 'ring-2 ring-primary' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">Slot #{slot.id.slice(-4)}</div>
                <SlotStatusBadge status={slot.status} />
              </div>
              
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {slot.lockedAt && (
                  <div className="flex items-center gap-1">
                    <Lock className="size-3" />
                    Locked at {new Date(slot.lockedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                {slot.bookedBy && (
                  <div className="flex items-center gap-1">
                    <User className="size-3" />
                    Booked
                  </div>
                )}
              </div>
              
              <Button
                variant={slot.status === 'available' ? 'hero' : 'outline'}
                size="sm"
                className="mt-3 w-full"
                disabled={
                  !bookable.bookable ||
                  bookingInProgress ||
                  slot.status === 'booked'
                }
                onClick={() => handleBookSlot(slot.id)}
              >
                {slot.status === 'available' && 'Book Slot'}
                {slot.status === 'locked' && 'Locked'}
                {slot.status === 'booked' && 'Booked'}
                {slot.status === 'expired' && 'Expired'}
              </Button>
              
              {!isLoggedIn && slot.status === 'available' && (
                <p className="mt-2 text-xs text-warning">
                  Log in to book
                </p>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Available: {availableSlots.length} • Locked: {lockedSlots.length} • Booked: {bookedSlots.length}
        </div>
        <div className="text-xs">
          Locks expire in 2 minutes
        </div>
      </div>
    </div>
  );
}

// ─── Simplified Booking Button (for existing UI) ────────────────────────────

interface SimpleBookingButtonProps {
  jobId: string;
  slotId: string;
  categoryName: string;
  jobTitle: string;
  wage: number;
  disabled?: boolean;
  variant?: 'hero' | 'outline' | 'secondary';
}

export function SimpleBookingButton({
  jobId,
  slotId,
  categoryName,
  jobTitle,
  wage,
  disabled = false,
  variant = 'hero',
}: SimpleBookingButtonProps) {
  const { user, isLoggedIn, openLoginModal } = useAuth();
  const { attemptBooking } = useBookingTransaction();
  
  const [bookingInProgress, setBookingInProgress] = useState(false);

  async function handleClick() {
    if (!isLoggedIn || !user) {
      openLoginModal({ 
        type: "book-shift", 
        payload: { jobId, slotId } 
      });
      return;
    }

    setBookingInProgress(true);
    
    const result = await attemptBooking(slotId, user.id);
    
    if (result.success) {
      toast.success(`Booked ${categoryName} slot at ${jobTitle}`);
    } else {
      const errorMessage = result.error || 'Booking failed. Please try again.';
      toast.error(errorMessage);
    }
    
    setBookingInProgress(false);
  }

  return (
    <Button
      variant={variant}
      size="lg"
      disabled={disabled || bookingInProgress}
      onClick={handleClick}
      className="w-full"
    >
      {bookingInProgress ? 'Booking...' : 'Book This Slot'}
    </Button>
  );
}
"use client";

import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ComponentProps,
  type HTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

function formatTimestamp(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface ScrubBarContextValue {
  duration: number;
  value: number;
  progress: number;
  onScrub?: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

const ScrubBarContext = createContext<ScrubBarContextValue | null>(null);

function useScrubBarContext() {
  const context = useContext(ScrubBarContext);
  if (!context) {
    throw new Error("useScrubBarContext must be used within a ScrubBar.Root");
  }
  return context;
}

interface ScrubBarContainerProps extends HTMLAttributes<HTMLDivElement> {
  duration: number;
  value: number;
  onScrub?: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

function ScrubBarContainer({
  duration,
  value,
  onScrub,
  onScrubStart,
  onScrubEnd,
  children,
  className,
  ...props
}: ScrubBarContainerProps) {
  const progress = duration > 0 ? (value / duration) * 100 : 0;

  const contextValue: ScrubBarContextValue = {
    duration,
    value,
    progress,
    onScrub,
    onScrubStart,
    onScrubEnd,
  };

  return (
    <ScrubBarContext.Provider value={contextValue}>
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </ScrubBarContext.Provider>
  );
}
ScrubBarContainer.displayName = "ScrubBarContainer";

type ScrubBarTrackProps = HTMLAttributes<HTMLDivElement>;

function ScrubBarTrack({ className, children, ...props }: ScrubBarTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { duration, onScrub, onScrubStart, onScrubEnd, value } =
    useScrubBarContext();

  const getTimeFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || !duration) return null;
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const clamped = Math.min(Math.max(ratio, 0), 1);
      return duration * clamped;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return;
      event.preventDefault();
      onScrubStart?.();
      const time = getTimeFromClientX(event.clientX);
      if (time != null) {
        onScrub?.(time);
      }

      const handleMove = (moveEvent: PointerEvent) => {
        const nextTime = getTimeFromClientX(moveEvent.clientX);
        if (nextTime != null) {
          onScrub?.(nextTime);
        }
      };

      const handleUp = () => {
        onScrubEnd?.();
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp, { once: true });
    },
    [duration, getTimeFromClientX, onScrub, onScrubEnd, onScrubStart]
  );

  const clampedValue = Math.min(Math.max(value, 0), duration || 0);

  return (
    <div
      ref={trackRef}
      className={cn("relative w-full cursor-pointer", className)}
      onPointerDown={handlePointerDown}
      data-scrub-value={clampedValue}
      {...props}
    >
      {children}
    </div>
  );
}
ScrubBarTrack.displayName = "ScrubBarTrack";

type ScrubBarProgressProps = Omit<ComponentProps<typeof Progress>, "value">;

function ScrubBarProgress({ className, ...props }: ScrubBarProgressProps) {
  const { progress } = useScrubBarContext();

  return (
    <Progress value={progress} className={cn("h-2", className)} {...props} />
  );
}
ScrubBarProgress.displayName = "ScrubBarProgress";

type ScrubBarThumbProps = HTMLAttributes<HTMLDivElement>;

function ScrubBarThumb({ className, children, ...props }: ScrubBarThumbProps) {
  const { progress } = useScrubBarContext();
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary",
        className
      )}
      style={{ left: `${progress}%` }}
      {...props}
    >
      {children}
    </div>
  );
}
ScrubBarThumb.displayName = "ScrubBarThumb";

interface ScrubBarTimeLabelProps extends HTMLAttributes<HTMLSpanElement> {
  time: number;
  format?: (time: number) => string;
}

function ScrubBarTimeLabel({
  className,
  time,
  format = formatTimestamp,
  ...props
}: ScrubBarTimeLabelProps) {
  return (
    <span className={cn("text-xs text-muted-foreground", className)} {...props}>
      {format(time)}
    </span>
  );
}
ScrubBarTimeLabel.displayName = "ScrubBarTimeLabel";

export {
  ScrubBarContainer,
  ScrubBarTrack,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTimeLabel,
};
